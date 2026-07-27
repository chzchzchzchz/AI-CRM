import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, History, Minus } from "lucide-react";

/**
 * How this account has moved since the last time anyone looked.
 *
 * Every brief is snapshotted with a standardized metrics row, so an account's trajectory
 * has always been diffable — `intel.briefHistory` computes the per-generation deltas and
 * nothing called it. "Intent 92" tells a rep where the account is; "intent 92, up 31
 * since the last brief, and two new stakeholders" tells them whether to act today.
 */

const METRICS: Array<{ key: string; label: string; money?: boolean }> = [
  { key: "intentScore", label: "Intent" },
  { key: "contacts", label: "Contacts" },
  { key: "calls", label: "Calls" },
  { key: "pipelineValue", label: "Pipeline", money: true },
  { key: "weightedPipeline", label: "Weighted", money: true },
  { key: "openActionItems", label: "Open items" },
];

function fmt(n: number, money?: boolean): string {
  const abs = Math.abs(n);
  if (!money) return String(abs);
  return abs >= 1000 ? `$${Math.round(abs / 1000)}k` : `$${abs}`;
}

function when(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/** A delta with direction. Zero renders as a dash, not a green "+0". */
function Delta({ value, money }: { value: number | null; money?: boolean }) {
  if (value === null || value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-2xs text-ink-subtle">
        <Minus className="size-3" />
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums text-2xs font-medium",
        up ? "text-positive" : "text-critical"
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {fmt(value, money)}
    </span>
  );
}

export function AccountTrajectory({ accountId }: { accountId: number }) {
  const { data, isLoading } = trpc.intel.briefHistory.useQuery(
    { accountId, limit: 6 },
    { enabled: accountId > 0, refetchOnWindowFocus: false }
  );

  // The oldest snapshot has nothing to compare against, so it carries no deltas and
  // would render as a row of dashes. Showing it as history rather than as change.
  const withChanges = (data ?? []).filter(s => s.changes);

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <History className="size-4 text-accent" />
          Trajectory
        </CardTitle>
        <CardDescription>
          How this account moved between briefs — the numbers, not the prose.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !withChanges.length ? (
          <EmptyState
            icon={History}
            title={data?.length ? "Only one brief so far" : "No history yet"}
            description={
              data?.length
                ? "Movement appears once a second brief has been generated from changed signals."
                : "A brief is snapshotted each time the underlying signals change."
            }
            compact
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {withChanges.map(snap => (
              <li key={snap.signalHash} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-2xs text-ink-muted">{when(snap.generatedAt)}</span>
                  <span className="text-2xs text-ink-subtle">
                    v<span className="tabular-nums">{snap.version}</span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {METRICS.map(m => {
                    const d = (snap.changes as Record<string, number | null>)?.[m.key] ?? null;
                    if (d === null || d === 0) return null;
                    return (
                      <span key={m.key} className="flex items-center gap-1 text-2xs">
                        <span className="text-ink-muted">{m.label}</span>
                        <Delta value={d} money={m.money} />
                      </span>
                    );
                  })}
                  {/* Every metric flat is itself worth saying — a brief regenerated with
                      nothing moving means the account is quiet, not that data is missing. */}
                  {METRICS.every(
                    m => !((snap.changes as Record<string, number | null>)?.[m.key] ?? 0)
                  ) && <span className="text-2xs text-ink-subtle">No tracked metric moved</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
