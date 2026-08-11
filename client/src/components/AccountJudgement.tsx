import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronDown,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

/**
 * "What to do next" — the last third of the daily loop.
 *
 * The intelligence engine has always produced a structured judgement: a situation
 * read, why-now points, ranked actions, and risks, each carrying the specific
 * signal it rests on. Until now the UI only ever received that flattened into a
 * markdown blob, so an *action* could not be shown as an action — it was a line
 * of prose in the middle of a document a rep had to read to the end.
 *
 * This renders the structure directly. Evidence stays attached to every claim
 * because it is the reason to trust the claim; a recommendation whose basis you
 * cannot check is worse than no recommendation.
 */

type Priority = "high" | "medium" | "low" | (string & {});

function priorityMeta(priority: Priority): {
  variant: "critical" | "caution" | "positive" | "secondary";
  label: string;
} {
  switch (String(priority).toLowerCase()) {
    case "high":
      return { variant: "critical", label: "High" };
    case "medium":
      return { variant: "caution", label: "Medium" };
    case "low":
      return { variant: "positive", label: "Low" };
    default:
      return { variant: "secondary", label: String(priority || "—") };
  }
}

/** Evidence is the load-bearing part, so it is quoted rather than paraphrased. */
function Evidence({ children }: { children: string }) {
  return (
    <p className="mt-1.5 border-l-2 border-border-subtle pl-2.5 text-2xs leading-relaxed text-ink-subtle">
      {children}
    </p>
  );
}

export function AccountJudgement({ accountId }: { accountId: number }) {
  const [showFullBrief, setShowFullBrief] = useState(false);

  const brief = trpc.intel.accountBrief.useQuery(
    { accountId },
    { enabled: accountId > 0, refetchOnWindowFocus: false }
  );

  const judgement = brief.data?.judgement ?? null;
  const dropped = brief.data?.droppedClaims ?? [];

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <Sparkles className="size-4 text-accent" />
              What to do next
            </span>
            <span className="mt-1 block text-xs font-normal text-ink-muted">
              Judgement from this account&apos;s own signals. Every claim cites the signal
              it rests on.
            </span>
          </span>

          <span className="flex shrink-0 flex-wrap items-center gap-2">
            {brief.data?.cached && (
              <span className="rounded-sm bg-muted px-2 py-1 text-2xs text-ink-muted">
                Cached
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Regenerate brief"
              onClick={() => brief.refetch()}
              disabled={brief.isFetching}
            >
              <RefreshCw className={cn("size-4", brief.isFetching && "animate-spin")} />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {brief.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-9/12" />
            <div className="pt-2">
              <Skeleton className="h-14 w-full" />
            </div>
          </div>
        ) : brief.isError ? (
          <EmptyState
            icon={AlertTriangle}
            title="Brief unavailable"
            description={brief.error.message}
            compact
          />
        ) : !brief.data ? (
          <EmptyState
            icon={Sparkles}
            title="No brief yet"
            description="Nothing has been generated for this account."
            compact
          />
        ) : (
          <>
            {/* Situation — the opening read, one paragraph. */}
            {judgement?.situation && (
              <p className="text-sm leading-relaxed text-foreground">
                {judgement.situation}
              </p>
            )}

            {/* Degraded is stated, never hidden: a brief with no model behind it is
                still useful, but the reader must know which one they are holding. */}
            {brief.data.degraded && (
              <div className="flex items-start gap-2 rounded-sm border border-caution/30 bg-caution-subtle p-3">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-caution" />
                <p className="text-xs leading-relaxed text-foreground">
                  No model was reachable, so this account has facts but no interpretation.
                  The figures below are read directly from your data.
                  {" "}
                  <span className="text-ink-muted">
                    To turn interpretation on, set <code className="font-mono">OPENROUTER_API_KEY</code> in
                    {" "}<code className="font-mono">.env</code>, or run a local model with
                    {" "}<code className="font-mono">ollama serve</code>. See SETUP.md.
                  </span>
                </p>
              </div>
            )}

            {/* Why now */}
            {!!judgement?.whyNow?.length && (
              <section>
                <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  Why now
                </h3>
                <ul className="space-y-3">
                  {judgement.whyNow.map((w, i) => (
                    <li key={i}>
                      <p className="text-sm font-medium text-foreground">{w.point}</p>
                      {w.evidence && <Evidence>{w.evidence}</Evidence>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Next actions — the point of the whole page. Ranked, each executable. */}
            {!!judgement?.actions?.length && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  <Target className="size-3" />
                  Next actions
                </h3>
                <ol className="space-y-2.5">
                  {judgement.actions.map((a, i) => {
                    const p = priorityMeta(a.priority);
                    return (
                      <li
                        key={i}
                        className="rounded-sm border border-border-subtle bg-surface-raised p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="min-w-0 text-sm font-medium text-foreground">
                            <span
                              data-numeric
                              className="mr-1.5 tabular-nums text-ink-subtle"
                            >
                              {i + 1}.
                            </span>
                            {a.action}
                          </p>
                          <Badge variant={p.variant} size="sm">
                            {p.label}
                          </Badge>
                        </div>
                        {a.rationale && (
                          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                            {a.rationale}
                          </p>
                        )}
                        {a.evidence && <Evidence>{a.evidence}</Evidence>}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* Risks */}
            {!!judgement?.risks?.length && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  <AlertTriangle className="size-3" />
                  Risks
                </h3>
                <ul className="space-y-3">
                  {judgement.risks.map((r, i) => (
                    <li key={i}>
                      <p className="text-sm font-medium text-foreground">{r.risk}</p>
                      {r.evidence && <Evidence>{r.evidence}</Evidence>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* A thin brief should never be mistaken for a quiet account. If validation
                removed statements, say how many and why. */}
            {dropped.length > 0 && (
              <div className="rounded-sm border border-border-subtle bg-muted p-3">
                <p className="flex items-center gap-1.5 text-2xs font-medium text-ink-muted">
                  <ShieldCheck className="size-3 text-positive" />
                  {dropped.length} generated statement{dropped.length === 1 ? "" : "s"}{" "}
                  removed — could not be verified against your data
                </p>
                <ul className="mt-1.5 space-y-1">
                  {dropped.map((d, i) => (
                    <li key={i} className="text-2xs text-ink-subtle">
                      <span className="text-ink-muted">{d.section}</span>: {d.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* The full document stays one click away — the facts tables, stakeholder
                map, pipeline and data gaps are all in it. It just isn't the first thing
                a rep should have to read. */}
            <div className="border-t border-border-subtle pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullBrief(v => !v)}
                aria-expanded={showFullBrief}
              >
                <FileText className="mr-1.5 size-3.5" />
                {showFullBrief ? "Hide" : "Read"} full brief
                <ChevronDown
                  className={cn(
                    "ml-1 size-3.5 transition-transform duration-150",
                    showFullBrief && "rotate-180"
                  )}
                />
              </Button>

              {showFullBrief && (
                <div className="prose prose-sm dark:prose-invert mt-3 max-w-none prose-headings:font-semibold prose-a:text-accent">
                  <SafeStreamdown>{brief.data.markdown}</SafeStreamdown>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
