import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export default function SixsenseSync() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const { data: syncStatus, refetch: refetchStatus } = trpc.sixsense.getSyncStatus.useQuery();
  const syncAllMutation = trpc.sixsense.syncAllAccounts.useMutation();

  const handleSyncAll = async (limit: number) => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const result = await syncAllMutation.mutateAsync({ limit });
      setSyncResult(result);
      refetchStatus();
    } catch (error) {
      setSyncResult({
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">6sense Integration</h1>
        <p className="text-muted-foreground">
          Sync account data with 6sense Company Identification API to get real-time intent scores,
          buying stages, and firmographics.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Sync Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
            <CardDescription>Current synchronization status with 6sense</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{syncStatus?.total || 0}</div>
                <div className="text-sm text-muted-foreground">Total Accounts</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {syncStatus?.synced || 0}
                </div>
                <div className="text-sm text-muted-foreground">Synced</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {syncStatus?.unsynced || 0}
                </div>
                <div className="text-sm text-muted-foreground">Unsynced</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Manual Sync Card */}
        <Card>
          <CardHeader>
            <CardTitle>Manual Sync</CardTitle>
            <CardDescription>
              Trigger a manual sync to update account data from 6sense. Rate limits apply (100ms between requests).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => handleSyncAll(10)}
                disabled={syncing}
                className="flex-1"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync 10 Accounts
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleSyncAll(50)}
                disabled={syncing}
                variant="outline"
                className="flex-1"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync 50 Accounts
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleSyncAll(100)}
                disabled={syncing}
                variant="outline"
                className="flex-1"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync 100 Accounts
                  </>
                )}
              </Button>
            </div>

            {syncResult && (
              <Alert variant={syncResult.success ? "default" : "destructive"}>
                {syncResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>
                  <div className="font-semibold">{syncResult.message}</div>
                  {syncResult.results && (
                    <div className="mt-2 text-sm">
                      <div>✓ Synced: {syncResult.results.synced}</div>
                      <div>✗ Failed: {syncResult.results.failed}</div>
                      <div>⊘ Skipped: {syncResult.results.skipped}</div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* What Gets Synced Card */}
        <Card>
          <CardHeader>
            <CardTitle>What Gets Synced</CardTitle>
            <CardDescription>Data fields updated from 6sense Company Identification API</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Firmographics</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Company Name</li>
                  <li>• Domain</li>
                  <li>• Industry</li>
                  <li>• Employee Count</li>
                  <li>• Annual Revenue</li>
                  <li>• Location (Country, State, City, Region)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Intent & Scoring</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Intent Score (0-100)</li>
                  <li>• Buying Stage</li>
                  <li>• Profile Fit</li>
                  <li>• Segments</li>
                  <li>• 6sense Company ID</li>
                  <li>• Last Sync Timestamp</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>
              <AlertCircle className="inline mr-2 h-5 w-5" />
              Important Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • 6sense Company Identification API requires a valid domain for each account
            </p>
            <p>
              • Accounts without domains will be skipped during sync
            </p>
            <p>
              • Rate limiting: 100ms delay between requests to avoid API throttling
            </p>
            <p>
              • Intent scores and buying stages are updated in real-time from 6sense
            </p>
            <p>
              • Synced data is cached and can be refreshed manually or via scheduled jobs
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
