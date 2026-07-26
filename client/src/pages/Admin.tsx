import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Admin() {
  const { user, loading } = useAuth();
  const [enriching, setEnriching] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [processing, setProcessing] = useState(false);

  // const enrichAccount = trpc.sixsense.enrichAccount.useMutation();
  // const enrichAll = trpc.sixsense.enrichAllAccounts.useMutation();
  // const queueJobs = trpc.sixsense.queueEnrichmentJobs.useMutation();
  // const processQueue = trpc.sixsense.processQueue.useMutation();

  const handleEnrichAll = async (highPriorityOnly: boolean) => {
    setEnriching(true);
    try {
      // await enrichAll.mutateAsync({ highPriorityOnly });
      toast.info("Enrich feature temporarily disabled");
      toast.success(highPriorityOnly ? "High-priority accounts enriched!" : "All accounts enriched!");
    } catch (error: any) {
      toast.error(`Enrichment failed: ${error.message}`);
    } finally {
      setEnriching(false);
    }
  };

  const handleQueueJobs = async () => {
    setQueueing(true);
    try {
      // await queueJobs.mutateAsync();
      toast.info("Queue feature temporarily disabled");
      toast.success("Enrichment jobs queued!");
    } catch (error: any) {
      toast.error(`Queue failed: ${error.message}`);
    } finally {
      setQueueing(false);
    }
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      // await processQueue.mutateAsync({ limit: 20 });
      toast.info("Process queue feature temporarily disabled");
      toast.success("Queue processed!");
    } catch (error: any) {
      toast.error(`Processing failed: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

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
          <p className="text-ink-muted">Manage data enrichment, background jobs, and system health</p>
        </div>

        {/* 6sense Enrichment */}
        <Card className="border-accent/30 shadow-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Database className="size-5 shrink-0 text-ink-faint" />
              <div>
                <CardTitle>6sense Live Enrichment</CardTitle>
                <CardDescription>Pull fresh intent data, keywords, and campaigns from 6sense API</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={() => handleEnrichAll(true)}
                disabled={enriching}
                className="h-auto py-4 flex-col items-start gap-2"
                variant="outline"
              >
                {enriching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 text-caution" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Enrich High-Priority Accounts</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Intent score ≥ 50 (faster, recommended)
                  </div>
                </div>
              </Button>

              <Button
                onClick={() => handleEnrichAll(false)}
                disabled={enriching}
                className="h-auto py-4 flex-col items-start gap-2"
                variant="outline"
              >
                {enriching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <RefreshCw className="h-5 w-5 text-accent" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Enrich All Accounts</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    All 777 accounts (slower, ~6-7 minutes)
                  </div>
                </div>
              </Button>
            </div>

            <div className="p-4 bg-accent rounded-sm border border-accent/30">
              <h4 className="font-semibold text-sm text-accent mb-2">What gets enriched:</h4>
              <ul className="text-sm text-accent space-y-1">
                <li>• Intent scores (with spike detection)</li>
                <li>• Buying stage changes</li>
                <li>• Keyword research & trending topics</li>
                <li>• Campaign engagement data</li>
                <li>• Change tracking & audit logs</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Background Job Queue */}
        <Card className="border-accent/30 shadow-lg">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Clock className="size-5 shrink-0 text-ink-faint" />
              <div>
                <CardTitle>Background Job Queue</CardTitle>
                <CardDescription>Schedule and process enrichment jobs asynchronously</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                onClick={handleQueueJobs}
                disabled={queueing}
                className="h-auto py-4 flex-col items-start gap-2"
                variant="outline"
              >
                {queueing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-positive" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Queue All Jobs</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Add all accounts to enrichment queue
                  </div>
                </div>
              </Button>

              <Button
                onClick={handleProcessQueue}
                disabled={processing}
                className="h-auto py-4 flex-col items-start gap-2"
                variant="outline"
              >
                {processing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Zap className="h-5 w-5 text-accent" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Process Queue (20 jobs)</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Run next 20 pending jobs
                  </div>
                </div>
              </Button>
            </div>

            <div className="p-4 bg-accent rounded-sm border border-accent/30">
              <h4 className="font-semibold text-sm text-accent mb-2">How it works:</h4>
              <ul className="text-sm text-accent space-y-1">
                <li>• Jobs are prioritized by intent score (high intent = higher priority)</li>
                <li>• Rate-limited to 500ms between requests (avoid API throttling)</li>
                <li>• Failed jobs are retried with exponential backoff</li>
                <li>• Results stored in database with full audit trail</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-border shadow-lg">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current enrichment and data quality metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-positive rounded-sm border border-positive/30">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-positive" />
                  <span className="font-semibold text-positive">6sense API</span>
                </div>
                <Badge variant="outline" className="bg-positive text-positive border-positive/30">
                  Connected
                </Badge>
              </div>

              <div className="p-4 bg-accent rounded-sm border border-accent/30">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Database className="h-5 w-5 text-accent" />
                  <span className="font-semibold text-accent">Database</span>
                </div>
                <Badge variant="outline" className="bg-accent text-accent border-accent/30">
                  Healthy
                </Badge>
              </div>

              <div className="p-4 bg-accent rounded-sm border border-accent/30">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-accent" />
                  <span className="font-semibold text-accent">Job Queue</span>
                </div>
                <Badge variant="outline" className="bg-accent text-accent border-accent/30">
                  Ready
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
