import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Link } from "wouter";

/**
 * The concrete list of what is wrong with the data, and a way to fix it in place.
 *
 * Both halves already existed on the server and neither was reachable: `getAllIssues`
 * computes this list instantly with no model and no web search, and `fixIssue` writes a
 * whitelisted field. The page previously showed only counts, plus a "Fix" button with no
 * handler behind it — a control that looked like it worked.
 *
 * Deliberately separate from the AI validation below it. This pass costs nothing and is
 * always right about what is *missing*; that pass costs minutes and reasons about what is
 * *wrong*. Presenting them as one thing made the cheap answer unavailable.
 */

type Severity = "critical" | "warning" | "info";

const PAGE = 25;

const SEVERITY = {
  critical: { icon: AlertCircle, cls: "text-critical", badge: "critical" as const, label: "Critical" },
  warning: { icon: AlertTriangle, cls: "text-caution", badge: "caution" as const, label: "Warning" },
  info: { icon: Info, cls: "text-accent", badge: "default" as const, label: "Info" },
};

function severityMeta(s: string) {
  return SEVERITY[(s as Severity)] ?? SEVERITY.info;
}

export function ValidationIssues() {
  const utils = trpc.useUtils();
  const issuesQuery = trpc.validation.getAllIssues.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // A real dataset produces thousands of these. Rendering all of them is both slow and
  // useless — nobody works a 1,700-row list top to bottom — so show a workable page and
  // let the reader ask for more.
  const [limit, setLimit] = useState(PAGE);

  // Deep-verify one record rather than the whole database. The bulk passes take minutes
  // and are the only way this engine was reachable; when you are looking at a single bad
  // row, checking that row is the thing you actually want.
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, string>>({});

  const verifyAccount = trpc.validation.validateAccount.useMutation();
  const verifyContact = trpc.validation.validateContact.useMutation();

  const runVerify = async (issue: { id: string; type: string; entityId: number }) => {
    setVerifying(issue.id);
    try {
      const res =
        issue.type === "account"
          ? await verifyAccount.mutateAsync({ accountId: issue.entityId })
          : await verifyContact.mutateAsync({ contactId: issue.entityId });
      const found = res.issueCount;
      setVerdicts(v => ({
        ...v,
        [issue.id]: found
          ? `${found} issue${found === 1 ? "" : "s"} confirmed against the web`
          : "Verified — nothing contradicted by the web",
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(null);
    }
  };

  const fix = trpc.validation.fixIssue.useMutation({
    onSuccess: res => {
      if (res.success) {
        toast.success(res.message);
        setEditing(null);
        setDraft("");
        // The issue list and the summary counts are both now stale.
        utils.validation.getAllIssues.invalidate();
        utils.validation.getSummary.invalidate();
      } else {
        toast.error(res.message);
      }
    },
    onError: err => toast.error(err.message),
  });

  const all = issuesQuery.data?.issues ?? [];
  const matching = useMemo(
    () => (filter === "all" ? all : all.filter(i => i.severity === filter)),
    [all, filter]
  );
  const shown = matching.slice(0, limit);

  const counts = {
    all: issuesQuery.data?.totalIssues ?? 0,
    critical: issuesQuery.data?.criticalIssues ?? 0,
    warning: issuesQuery.data?.warningIssues ?? 0,
    info: issuesQuery.data?.infoIssues ?? 0,
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="size-4 text-accent" />
          Issues found
          {!issuesQuery.isLoading && (
            <span data-numeric className="tabular-nums text-sm font-normal text-ink-muted">
              {counts.all}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Structural checks over every account and contact. No model, no web search — this
          runs on load and is always current.
        </CardDescription>

        {counts.all > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["all", "critical", "warning", "info"] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setFilter(k);
                  setLimit(PAGE);
                }}
                aria-pressed={filter === k}
                className={cn(
                  "rounded-sm border px-2.5 py-1 text-2xs font-medium transition-colors",
                  filter === k
                    ? "border-accent/30 bg-accent-subtle text-accent"
                    : "border-border text-ink-muted hover:bg-muted"
                )}
              >
                {k === "all" ? "All" : severityMeta(k).label}{" "}
                <span className="tabular-nums">{counts[k]}</span>
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {issuesQuery.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : issuesQuery.isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't read the data"
            description={issuesQuery.error.message}
            compact
          />
        ) : !shown.length ? (
          <EmptyState
            icon={CheckCircle}
            title={counts.all === 0 ? "Nothing to fix" : "Nothing at this severity"}
            description={
              counts.all === 0
                ? "Every account and contact passed the structural checks."
                : "Try a different filter."
            }
            compact
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {shown.map(issue => {
              const meta = severityMeta(issue.severity);
              const Icon = meta.icon;
              const isEditing = editing === issue.id;
              const href =
                issue.type === "account"
                  ? `/accounts/${issue.entityId}`
                  : issue.type === "contact"
                    ? `/contacts/${issue.entityId}`
                    : null;

              return (
                <li key={issue.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("mt-0.5 size-4 shrink-0", meta.cls)} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="truncate text-sm font-medium hover:text-accent"
                          >
                            {issue.entityName}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-medium">{issue.entityName}</span>
                        )}
                        <Badge variant={meta.badge} size="sm">
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" size="sm">
                          {issue.field}
                        </Badge>
                      </div>

                      <p className="mt-0.5 text-xs text-ink-muted">{issue.issue}</p>
                      <p className="mt-0.5 text-2xs text-ink-subtle">{issue.suggestion}</p>

                      {verdicts[issue.id] && (
                        <p className="mt-1 flex items-center gap-1 text-2xs text-accent">
                          <ShieldCheck className="size-3" />
                          {verdicts[issue.id]}
                        </p>
                      )}

                      {isEditing && (
                        <form
                          className="mt-2 flex flex-wrap items-center gap-2"
                          onSubmit={e => {
                            e.preventDefault();
                            // Only reachable when `editable` is true, which the server
                            // sets solely for account/contact issues.
                            if (issue.type !== "account" && issue.type !== "contact") return;
                            fix.mutate({
                              issueId: issue.id,
                              entityType: issue.type,
                              entityId: issue.entityId,
                              field: issue.field,
                              newValue: draft.trim(),
                            });
                          }}
                        >
                          <Input
                            autoFocus
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            placeholder={`New ${issue.field}`}
                            className="h-8 max-w-xs"
                            aria-label={`New value for ${issue.field} on ${issue.entityName}`}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!draft.trim() || fix.isPending}
                          >
                            {fix.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(null);
                              setDraft("");
                            }}
                          >
                            Cancel
                          </Button>
                        </form>
                      )}
                    </div>

                    {!isEditing && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0"
                        disabled={verifying !== null}
                        title="Check this one record against the web"
                        onClick={() => runVerify(issue)}
                      >
                        {verifying === issue.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          "Verify"
                        )}
                      </Button>
                    )}

                    {!isEditing &&
                      (issue.editable ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => {
                            setEditing(issue.id);
                            setDraft("");
                          }}
                        >
                          Fix
                        </Button>
                      ) : (
                        // Not offered rather than offered-and-refused: this field is not
                        // in the server's writable set, so it has to be corrected upstream.
                        <span
                          className="flex shrink-0 items-center gap-1 text-2xs text-ink-subtle"
                          title="This field can't be edited here — correct it in the source system"
                        >
                          <Lock className="size-3" />
                          Source
                        </span>
                      ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Never truncate silently — a capped list that doesn't say so reads as "that's
            all of them". */}
        {matching.length > shown.length && (
          <div className="border-t border-border-subtle px-5 py-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + PAGE * 4)}>
              Show more —{" "}
              <span data-numeric className="tabular-nums">
                {matching.length - shown.length}
              </span>{" "}
              remaining
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
