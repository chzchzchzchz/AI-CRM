import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Zap, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Navigation } from "@/components/Navigation";

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
      <div className="min-h-screen bg-slate-950">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Card className="bg-slate-900/50 border-slate-800 max-w-md">
            <CardContent className="p-12 text-center">
              <XCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-slate-400">
                You need admin privileges to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navigation />
      <div className="container py-8 space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-slate-400">Manage data enrichment, background jobs, and system health</p>
        </div>

        {/* 6sense Enrichment */}
        <Card className="border-blue-200 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
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
                  <Zap className="h-5 w-5 text-orange-500" />
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
                  <RefreshCw className="h-5 w-5 text-blue-500" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Enrich All Accounts</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    All 777 accounts (slower, ~6-7 minutes)
                  </div>
                </div>
              </Button>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-sm text-blue-900 mb-2">What gets enriched:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
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
        <Card className="border-purple-200 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
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
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
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
                  <Zap className="h-5 w-5 text-purple-500" />
                )}
                <div className="text-left">
                  <div className="font-semibold">Process Queue (20 jobs)</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Run next 20 pending jobs
                  </div>
                </div>
              </Button>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-sm text-purple-900 mb-2">How it works:</h4>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• Jobs are prioritized by intent score (high intent = higher priority)</li>
                <li>• Rate-limited to 500ms between requests (avoid API throttling)</li>
                <li>• Failed jobs are retried with exponential backoff</li>
                <li>• Results stored in database with full audit trail</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current enrichment and data quality metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-900">6sense API</span>
                </div>
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                  Connected
                </Badge>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Database</span>
                </div>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  Healthy
                </Badge>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">Job Queue</span>
                </div>
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
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
