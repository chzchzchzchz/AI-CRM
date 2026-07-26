import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyLogo } from "@/components/ui/company-logo";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Activity } from "lucide-react";
import { Link } from "wouter";

/**
 * "What changed" — the middle third of the daily loop.
 *
 * Reads the intent time series and shows only accounts that actually *moved*
 * since the rep last looked. A list of hot accounts answers "who matters";
 * this answers "what is new", which is the reason to open the app on a
 * Tuesday rather than a Monday.
 *
 * Movement is the subject, so the delta is the largest thing in each row and
 * the absolute score is demoted to context.
 */

function relativeDay(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function WhatChanged({ limit = 6 }: { limit?: number }) {
  const { data, isLoading } = trpc.sixsense.getRecentSpikes.useQuery({ limit });

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>What changed</CardTitle>
        <CardDescription>Accounts whose intent moved in the last 30 days</CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={Activity}
            title="Nothing moved"
            description="No account's intent shifted enough to flag. That is a quiet day, not a broken feed."
            compact
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {data.map(spike => {
              const rising = spike.scoreDelta > 0;
              return (
                <li key={`${spike.accountId}-${spike.at}`}>
                  <Link
                    href={`/accounts/${spike.accountId}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
                  >
                    <CompanyLogo name={spike.accountName} size="sm" />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{spike.accountName}</div>
                      <div className="flex flex-wrap items-center gap-x-1.5 text-2xs text-ink-muted">
                        {spike.category && <span>{spike.category}</span>}
                        {spike.category && <span className="text-ink-faint">·</span>}
                        <span data-numeric className="tabular-nums">
                          {spike.previousScore} → {spike.currentScore}
                        </span>
                        <span className="text-ink-faint">·</span>
                        <span>{relativeDay(spike.at)}</span>
                      </div>
                    </div>

                    {/* The movement is the news, so it carries the visual weight. */}
                    <span
                      data-numeric
                      className={cn(
                        "flex shrink-0 items-center gap-0.5 text-sm font-semibold tabular-nums",
                        rising ? "text-critical" : "text-ink-muted"
                      )}
                      title={rising ? "Intent rising" : "Intent cooling"}
                    >
                      {rising ? (
                        <ArrowUpRight className="size-3.5" />
                      ) : (
                        <ArrowDownRight className="size-3.5" />
                      )}
                      {rising ? "+" : ""}
                      {spike.scoreDelta}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
