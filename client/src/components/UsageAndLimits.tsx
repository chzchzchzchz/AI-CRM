import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { Loader2, Gauge } from "lucide-react";

/**
 * What this workspace has used, against what it is allowed.
 *
 * Shown to the workspace's own admin, because it is their consumption and they should not
 * have to ask. A limit that is only visible at the moment it refuses you is a limit you
 * cannot plan around — the first a customer would know of a seat cap is an invitation
 * that fails with a colleague already waiting.
 *
 * "No limit" is the normal state and says so plainly. Nothing here invents a plan: no
 * deployment has limits until an operator sets one, and a blank where a number could be
 * is the honest rendering of that.
 */
export function UsageAndLimits() {
  const q = trpc.entitlements.usage.useQuery();

  if (q.error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <DataUnavailable what="usage" detail={q.error} onRetry={() => q.refetch()} />
        </CardContent>
      </Card>
    );
  }

  const period = q.data?.periodStart
    ? new Date(q.data.periodStart).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-4 w-4" />
          Usage
        </CardTitle>
        <CardDescription>
          What this workspace is using{period ? `, AI calls counted for ${period}` : ""}.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {q.isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-accent" />
          </div>
        ) : (
          <ul className="divide-y divide-border/50 rounded-md border border-border/60">
            {(q.data?.kinds ?? []).map(k => {
              const used = (q.data?.usage as any)?.[k.key] ?? 0;
              const limit = (q.data?.limits as any)?.[k.key];
              const unlimited = limit === undefined;
              // Only meaningful with a limit; a bar against infinity is decoration.
              const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100));
              const near = !unlimited && used >= limit * 0.8;
              return (
                <li key={k.key} className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{k.label}</span>
                    <span className="tabular-nums text-sm">
                      {used.toLocaleString()}
                      {unlimited ? (
                        <span className="ml-1 text-xs text-ink-muted">· no limit</span>
                      ) : (
                        <span className={`ml-1 text-xs ${near ? "text-caution" : "text-ink-muted"}`}>
                          of {limit.toLocaleString()}
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-ink-muted">{k.unit}</p>
                  {!unlimited ? (
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full ${near ? "bg-caution" : "bg-accent"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {q.data && !q.data.canSetLimits ? (
          <p className="mt-3 text-2xs text-ink-muted">
            Limits are set by whoever runs this deployment.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
