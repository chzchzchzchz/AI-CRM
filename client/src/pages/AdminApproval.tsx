import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Mail, Building2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Navigation } from "@/components/Navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function AdminApproval() {
  const { user, loading } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [denyReason, setDenyReason] = useState("");
  const [showDenyDialog, setShowDenyDialog] = useState(false);

  // Fetch pending access requests
  const { data: requests, isLoading, refetch } = trpc.admin.getPendingRequests.useQuery(
    undefined,
    { enabled: user?.role === "admin" }
  );

  // Approve request mutation
  const approveMutation = trpc.admin.approveAccessRequest.useMutation({
    onSuccess: () => {
      toast.success("Access request approved!");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  // Deny request mutation
  const denyMutation = trpc.admin.denyAccessRequest.useMutation({
    onSuccess: () => {
      toast.success("Access request denied!");
      setShowDenyDialog(false);
      setDenyReason("");
      setSelectedRequest(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to deny: ${error.message}`);
    },
  });

  // Admin access control
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navigation />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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

  const pendingCount = requests?.filter((r: any) => r.status === "pending").length || 0;
  const approvedCount = requests?.filter((r: any) => r.status === "approved").length || 0;
  const deniedCount = requests?.filter((r: any) => r.status === "denied").length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <div className="container py-8 space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Access Requests</h1>
          <p className="text-slate-400">Review and approve user access requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending</p>
                  <p className="text-3xl font-bold text-yellow-400">{pendingCount}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Approved</p>
                  <p className="text-3xl font-bold text-green-400">{approvedCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Denied</p>
                  <p className="text-3xl font-bold text-red-400">{deniedCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Requests */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>
              {pendingCount === 0
                ? "No pending requests"
                : `${pendingCount} request${pendingCount !== 1 ? "s" : ""} awaiting approval`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : requests?.filter((r: any) => r.status === "pending").length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests
                  ?.filter((r: any) => r.status === "pending")
                  .map((request: any) => (
                    <div
                      key={request.id}
                      className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{request.name}</h3>
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                              Pending
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span>{request.email}</span>
                            </div>
                            {request.company && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <span>{request.company}</span>
                              </div>
                            )}
                            {request.reason && (
                              <div className="flex items-start gap-2 mt-3">
                                <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p className="text-slate-300">{request.reason}</p>
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 mt-3">
                            Requested {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => approveMutation.mutate({ requestId: request.id })}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Approve
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowDenyDialog(true);
                            }}
                            disabled={denyMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                            Deny
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Requests History */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle>Request History</CardTitle>
            <CardDescription>All access requests (approved, denied, pending)</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
              </div>
            ) : (
              <div className="space-y-2">
                {requests?.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="text-white font-medium">{request.name}</p>
                      <p className="text-sm text-slate-400">{request.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {request.status === "pending" && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                          Pending
                        </Badge>
                      )}
                      {request.status === "approved" && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                          Approved
                        </Badge>
                      )}
                      {request.status === "denied" && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                          Denied
                        </Badge>
                      )}
                      <span className="text-xs text-slate-500">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deny Reason Dialog */}
      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Deny Access Request</DialogTitle>
            <DialogDescription className="text-slate-400">
              Provide a reason for denying this request (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-white mb-2">Request from:</p>
              <p className="text-slate-300">{selectedRequest?.name}</p>
              <p className="text-sm text-slate-400">{selectedRequest?.email}</p>
            </div>

            <Textarea
              placeholder="Reason for denial (optional)..."
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDenyDialog(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              className="gap-2 bg-red-600 hover:bg-red-700 text-white"
              onClick={() =>
                denyMutation.mutate({
                  requestId: selectedRequest.id,
                  reason: denyReason,
                })
              }
              disabled={denyMutation.isPending}
            >
              {denyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Deny Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
