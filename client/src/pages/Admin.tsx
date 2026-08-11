import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Zap, CheckCircle2, XCircle, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Admin() {
  const { user, loading } = useAuth();
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    message: string;
    results?: { total: number; synced: number; failed: number; skipped: number };
  } | null>(null);
  const [lastSpikeResult, setLastSpikeResult] = useState<{ spikesDetected: number } | null>(null);

  // Real endpoints only. There is no background job queue anywhere in this codebase
  // (client or server) — the previous version of this page had "Queue All Jobs" and
  // "Process Queue" buttons wired to commented-out mutations that just showed a
  // success toast after a fake delay. Nothing was ever queued or processed.
  const { data: status, refetch: refetchStatus } = trpc.admin.getSystemStatus.useQuery(
    undefined,
    { enabled: user?.role === "admin" }
  );
  const { data: syncStatus, refetch: refetchSyncStatus } = trpc.sixsense.getSyncStatus.useQuery(
    undefined,
    { enabled: user?.role === "admin" }
  );

  const syncAll = trpc.sixsense.syncAllAccounts.useMutation({
    onSuccess: (data) => {
      setLastSyncResult(data);
      refetchSyncStatus();
    },
    onError: (error) => {
      setLastSyncResult({ success: false, message: error.message });
    },
  });

  const detectSpikes = trpc.sixsense.detectIntentSpikes.useMutation({
    onSuccess: (data) => setLastSpikeResult({ spikesDetected: data.spikesDetected }),
  });

  // Admin access control
  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Card className="bg-card border-border max-w-md">
            <CardContent className="p-12 text-center">
              <XCircle className="h-16 w-16 text-critical mx-auto mb-4" />
              <h2 className="text-2xl font-semibold text-foreground mb-2">Access Denied</h2>
              <p className="text-ink-muted">
                You need admin privileges to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container py-1 space-y-5 max-w-6xl mx-auto">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Admin Panel</h1>
          <p className="text-ink-muted">Manage data enrichment and system health</p>
        </div>

        {/* 6sense Enrichment */}
        <Card className="border-accent/30 shadow-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Database className="size-5 shrink-0 text-ink-faint" />
              <div>
                <CardTitle>6sense Bulk Enrichment</CardTitle>
                <CardDescription>
                  Pull intent scores, buying stages, and firmographics from the 6sense
                  Company Identification API for accounts that have a domain.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4 [&>*]:min-w-0">
              <div className="text-center p-2 sm:p-3 bg-muted rounded-sm">
                <div className="text-xl sm:text-2xl font-semibold tabular-nums">{syncStatus?.total ?? 0}</div>
                <div className="text-2xs sm:text-xs text-ink-muted truncate">Total accounts</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-muted rounded-sm">
                <div className="text-xl sm:text-2xl font-semibold tabular-nums text-positive">{syncStatus?.synced ?? 0}</div>
                <div className="text-2xs sm:text-xs text-ink-muted truncate">Synced</div>
              </div>
              <div className="text-center p-2 sm:p-3 bg-muted rounded-sm">
                <div className="text-xl sm:text-2xl font-semibold tabular-nums text-caution">{syncStatus?.unsynced ?? 0}</div>
                <div className="text-2xs sm:text-xs text-ink-muted truncate">Unsynced</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => syncAll.mutate({ limit: 50 })}
                disabled={syncAll.isPending}
                className="h-auto py-4 flex-col items-start gap-2"
                variant="outline"
              >
                {syncAll.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 text-caution" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Sync next 50 accounts</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Faster — good for a spot check
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => syncAll.mutate({ limit: 200 })}
                disabled={syncAll.isPending}
                className="h-auto py-4 flex-col items-start gap-2"
                variant="outline"
              >
                {syncAll.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5 text-accent" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Sync next 200 accounts</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Rate-limited to 100ms between requests
                  </div>
                </div>
              </Button>
            </div>

            {lastSyncResult && (
              <div
                className={
                  lastSyncResult.success
                    ? "p-3 rounded-sm border border-positive/30 bg-positive-subtle text-sm"
                    : "p-3 rounded-sm border border-critical/30 bg-critical-subtle text-sm text-critical"
                }
              >
                <div className="font-medium">{lastSyncResult.message}</div>
                {lastSyncResult.results && (
                  <div className="mt-1 text-xs text-ink-muted">
                    {lastSyncResult.results.synced} synced · {lastSyncResult.results.failed} failed ·{" "}
                    {lastSyncResult.results.skipped} skipped (no domain / no match)
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-muted rounded-sm border border-border-strong">
              <h4 className="font-semibold text-sm text-foreground mb-2">What gets enriched:</h4>
              <ul className="text-sm text-ink-muted space-y-1">
                <li>• Intent scores</li>
                <li>• Buying stage</li>
                <li>• Firmographics (industry, employee count, revenue, region)</li>
                <li>• 6sense segments</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Intent Spike Detection */}
        <Card className="border-accent/30 shadow-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <TrendingUp className="size-5 shrink-0 text-ink-faint" />
              <div>
                <CardTitle>Intent Spike Detection</CardTitle>
                <CardDescription>
                  Scan the accounts you just synced for a 20+ point jump in intent score.
                  Runs on a schedule too — this triggers it now.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={() => detectSpikes.mutate()}
              disabled={detectSpikes.isPending}
              variant="outline"
            >
              {detectSpikes.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              Detect intent spikes now
            </Button>
            {lastSpikeResult && (
              <p className="text-sm text-ink-muted">
                {lastSpikeResult.spikesDetected > 0
                  ? `${lastSpikeResult.spikesDetected} intent spike${lastSpikeResult.spikesDetected === 1 ? "" : "s"} detected.`
                  : "No spikes — nothing moved enough to flag."}
              </p>
            )}
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Live configuration and data-quality checks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={
                  status?.sixsenseConfigured
                    ? "p-4 bg-positive-subtle rounded-sm border border-positive/30"
                    : "p-4 bg-caution-subtle rounded-sm border border-caution/30"
                }
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {status?.sixsenseConfigured ? (
                    <CheckCircle2 className="h-5 w-5 text-positive" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-caution" />
                  )}
                  <span className="font-semibold text-foreground">6sense API</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    status?.sixsenseConfigured
                      ? "bg-positive-subtle text-positive border-positive/30"
                      : "bg-caution-subtle text-caution border-caution/30"
                  }
                >
                  {status === undefined ? "Checking…" : status.sixsenseConfigured ? "Configured" : "Not configured"}
                </Badge>
                {status && !status.sixsenseConfigured && (
                  <p className="mt-2 text-2xs text-ink-muted">Set SIXSENSE_API_KEY to enable syncing.</p>
                )}
              </div>

              <div
                className={
                  status?.databaseHealthy
                    ? "p-4 bg-positive-subtle rounded-sm border border-positive/30"
                    : "p-4 bg-critical-subtle rounded-sm border border-critical/30"
                }
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Database className={status?.databaseHealthy ? "h-5 w-5 text-positive" : "h-5 w-5 text-critical"} />
                  <span className="font-semibold text-foreground">Database</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    status?.databaseHealthy
                      ? "bg-positive-subtle text-positive border-positive/30"
                      : "bg-critical-subtle text-critical border-critical/30"
                  }
                >
                  {status === undefined ? "Checking…" : status.databaseHealthy ? "Healthy" : "Unavailable"}
                </Badge>
              </div>

              <div className="p-4 bg-muted rounded-sm border border-border-strong">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <RefreshCw className="h-5 w-5 text-ink-faint" />
                  <span className="font-semibold text-foreground">6sense sync coverage</span>
                </div>
                <Badge variant="outline" className="border-border-strong">
                  {syncStatus ? `${syncStatus.synced} / ${syncStatus.total} synced` : "Loading…"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
