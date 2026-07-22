import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Mail, Building2, MessageSquare, Users, UserCheck, Shield } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Fetch pending user registrations
  const { data: pendingUsers, isLoading: loadingPendingUsers, refetch: refetchPendingUsers } = trpc.admin.getPendingUsers.useQuery(
    undefined,
    { enabled: user?.role === "admin" }
  );

  // Fetch all users
  const { data: allUsers, isLoading: loadingAllUsers, refetch: refetchAllUsers } = trpc.admin.getAllUsers.useQuery(
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

  // Approve user registration mutation
  const approveUserMutation = trpc.admin.approveUser.useMutation({
    onSuccess: () => {
      toast.success("User approved!");
      refetchPendingUsers();
      refetchAllUsers();
    },
    onError: (error: any) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });

  // Deny/delete user mutation
  const denyUserMutation = trpc.admin.denyUser.useMutation({
    onSuccess: () => {
      toast.success("User removed!");
      refetchPendingUsers();
      refetchAllUsers();
    },
    onError: (error: any) => {
      toast.error(`Failed to remove: ${error.message}`);
    },
  });

  // Update user role mutation
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated!");
      refetchAllUsers();
    },
    onError: (error: any) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });

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

  if (!user || user.role !== "admin") {
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

  const pendingRequestCount = requests?.filter((r: any) => r.status === "pending").length || 0;
  const pendingUserCount = pendingUsers?.length || 0;
  const totalPendingCount = pendingRequestCount + pendingUserCount;
  const approvedCount = requests?.filter((r: any) => r.status === "approved").length || 0;
  const deniedCount = requests?.filter((r: any) => r.status === "denied").length || 0;
  const totalUserCount = allUsers?.length || 0;

  return (
    <div className="min-h-screen bg-slate-950">
      <Navigation />
      <div className="container py-8 space-y-8 max-w-6xl mx-auto">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Access Requests</h1>
          <p className="text-slate-400">Review and approve user access requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Pending Approval</p>
                  <p className="text-3xl font-bold text-yellow-400">{totalPendingCount}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-400 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Total Users</p>
                  <p className="text-3xl font-bold text-cyan-400">{totalUserCount}</p>
                </div>
                <Users className="h-8 w-8 text-cyan-400 opacity-50" />
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

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-slate-800/50">
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-600">
              <Clock className="h-4 w-4 mr-2" />
              Pending Approval
              {totalPendingCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-amber-500/20 text-amber-300">
                  {totalPendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-cyan-600">
              <Users className="h-4 w-4 mr-2" />
              All Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            {/* Pending User Registrations */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <UserCheck className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Pending User Registrations</CardTitle>
                    <CardDescription>
                      {pendingUserCount === 0
                        ? "No pending user registrations"
                        : `${pendingUserCount} user${pendingUserCount !== 1 ? "s" : ""} awaiting approval`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPendingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                ) : pendingUsers?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500/50" />
                    <p>No pending user registrations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers?.map((u: any) => (
                      <div
                        key={u.id}
                        className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-white">{u.name}</h3>
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                Pending
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm text-slate-400">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span>{u.email}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-400 mt-3">
                              Registered {new Date(u.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approveUserMutation.mutate({ userId: u.id })}
                              disabled={approveUserMutation.isPending}
                            >
                              {approveUserMutation.isPending ? (
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
                              onClick={() => denyUserMutation.mutate({ userId: u.id })}
                              disabled={denyUserMutation.isPending}
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

            {/* Pending Access Requests */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Shield className="h-6 w-6 text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">Demo Access Requests</CardTitle>
                    <CardDescription>
                      {pendingRequestCount === 0
                        ? "No pending access requests"
                        : `${pendingRequestCount} request${pendingRequestCount !== 1 ? "s" : ""} awaiting approval`}
                    </CardDescription>
                  </div>
                </div>
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

                          <p className="text-xs text-slate-400 mt-3">
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

          </TabsContent>

          {/* All Users Tab */}
          <TabsContent value="users">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/20 rounded-lg">
                    <Users className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-white">All Users</CardTitle>
                    <CardDescription>Manage all registered users and their roles</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAllUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                ) : allUsers?.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allUsers?.map((u: any) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/50 rounded-lg hover:border-slate-600 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-white font-medium">{u.name || 'No name'}</p>
                            {u.isApproved ? (
                              <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                                Approved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                                Pending
                              </Badge>
                            )}
                            {u.role === 'admin' && (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-400">{u.email}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            {u.loginMethod} • Last sign in: {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Select
                            value={u.role}
                            onValueChange={(value: "user" | "admin") => 
                              updateRoleMutation.mutate({ userId: u.id, role: value })
                            }
                            disabled={u.id === user?.id}
                          >
                            <SelectTrigger className="w-24 bg-slate-800 border-slate-700 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          {!u.isApproved && (
                            <Button
                              size="sm"
                              className="gap-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => approveUserMutation.mutate({ userId: u.id })}
                              disabled={approveUserMutation.isPending}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                          )}
                          {u.id !== user?.id && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                              onClick={() => denyUserMutation.mutate({ userId: u.id })}
                              disabled={denyUserMutation.isPending}
                            >
                              <XCircle className="h-4 w-4" />
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
