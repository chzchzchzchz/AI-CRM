import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanyLogo } from "@/components/ui/company-logo";
import { FollowUpDialog, dueLabel } from "@/components/FollowUpDialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { CalendarCheck, CheckCircle2, Clock } from "lucide-react";

/**
 * "What I said I'd do" — the third thing a rep needs each morning, alongside who's hot
 * and what changed.
 *
 * Rows open an in-place panel rather than linking to the account. That is the whole
 * design: a due task whose only affordance is a link costs you your place in the list,
 * and a morning of those is a morning spent navigating.
 */
export function FollowUps({ limit = 8 }: { limit?: number }) {
  const utils = trpc.useUtils();
  const [view, setView] = useState<"due" | "upcoming">("due");

  const { data, isLoading } = trpc.followUps.list.useQuery(
    { window: view, limit },
    { refetchOnWindowFocus: false }
  );

  const [openId, setOpenId] = useState<number | null>(null);
  const selected = data?.items.find(i => i.id === openId) ?? null;

  const refresh = () => utils.followUps.list.invalidate();

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <CalendarCheck className="size-4 text-accent" />
            Your follow-ups
            {!isLoading && !!data?.dueCount && view === "due" && (
              <span data-numeric className="tabular-nums text-sm font-normal text-ink-muted">
                {data.dueCount}
              </span>
            )}
            {!!data?.overdueCount && view === "due" && (
              <Badge variant="critical" size="sm">
                <span className="tabular-nums">{data.overdueCount}</span> overdue
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {view === "due"
              ? "What you said you'd do, due today or earlier"
              : "Scheduled ahead — nothing to do about these yet"}
          </CardDescription>

          {/* The upcoming count used to be stated and unreachable: the card said
              "3 still ahead" with no way to see which three. */}
          {!!data?.upcomingCount || view === "upcoming" ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(["due", "upcoming"] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "rounded-sm border px-2.5 py-1 text-2xs font-medium transition-colors",
                    view === v
                      ? "border-accent/30 bg-accent-subtle text-accent"
                      : "border-border text-ink-muted hover:bg-muted"
                  )}
                >
                  {v === "due" ? "Due" : "Upcoming"}{" "}
                  <span className="tabular-nums">
                    {v === "due" ? (data?.dueCount ?? 0) : (data?.upcomingCount ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={CheckCircle2}
              title={view === "due" ? "Nothing due" : "Nothing scheduled"}
              description={
                view === "upcoming"
                  ? "No follow-ups dated in the future."
                  : data?.upcomingCount
                    ? `Clear for today. ${data.upcomingCount} follow-up${data.upcomingCount === 1 ? "" : "s"} scheduled ahead.`
                    : "No follow-ups logged. Add one from any account or contact."
              }
              compact
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {data.items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    {item.account ? (
                      <CompanyLogo
                        name={item.account.name}
                        website={item.account.domain}
                        size="sm"
                      />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted">
                        <Clock className="size-3.5 text-ink-subtle" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.title}</div>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-2xs text-ink-muted">
                        {item.account && <span className="truncate">{item.account.name}</span>}
                        {item.account && item.contact && <span className="text-ink-faint">·</span>}
                        {item.contact && <span className="truncate">{item.contact.name}</span>}
                      </div>
                    </div>

                    {/* Overdue is the news, so it carries the weight. */}
                    <span
                      className={cn(
                        "shrink-0 whitespace-nowrap text-2xs font-medium",
                        item.overdue ? "text-critical" : "text-ink-muted"
                      )}
                    >
                      {dueLabel(item.daysUntilDue)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <FollowUpDialog
        followUp={selected}
        open={openId !== null}
        onOpenChange={v => !v && setOpenId(null)}
        onChanged={refresh}
      />
    </>
  );
}
