import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Mail, Building2, MessageSquare, Users, UserCheck, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
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
      <div>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
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

  const pendingRequestCount = requests?.filter((r: any) => r.status === "pending").length || 0;
  const pendingUserCount = pendingUsers?.length || 0;
  const totalPendingCount = pendingRequestCount + pendingUserCount;
  const approvedCount = requests?.filter((r: any) => r.status === "approved").length || 0;
  const deniedCount = requests?.filter((r: any) => r.status === "denied").length || 0;
  const totalUserCount = allUsers?.length || 0;

  return (
    <div>
      <div className="container py-1 space-y-5 max-w-6xl mx-auto">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Access Requests</h1>
          <p className="text-ink-muted">Review and approve user access requests</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-muted text-sm">Pending Approval</p>
                  <p className="text-2xl font-semibold text-caution">{totalPendingCount}</p>
                </div>
                <Clock className="h-8 w-8 text-caution opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-muted text-sm">Total Users</p>
                  <p className="text-2xl font-semibold text-accent">{totalUserCount}</p>
                </div>
                <Users className="h-8 w-8 text-accent opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-muted text-sm">Approved</p>
                  <p className="text-2xl font-semibold text-positive">{approvedCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-positive opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-ink-muted text-sm">Denied</p>
                  <p className="text-2xl font-semibold text-critical">{deniedCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-critical opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="bg-muted">
            <TabsTrigger value="pending" className="data-[state=active]:bg-caution">
              <Clock className="h-4 w-4 mr-2" />
              Pending Approval
              {totalPendingCount > 0 && (
                <Badge variant="secondary" className="ml-2 bg-caution-subtle text-caution">
                  {totalPendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-accent">
              <Users className="h-4 w-4 mr-2" />
              All Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-6">
            {/* Pending User Registrations */}
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <UserCheck className="size-5 shrink-0 text-ink-faint" />
                  <div>
                    <CardTitle className="text-foreground">Pending User Registrations</CardTitle>
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
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </div>
                ) : pendingUsers?.length === 0 ? (
                  <div className="text-center py-8 text-ink-muted">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-positive/50" />
                    <p>No pending user registrations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers?.map((u: any) => (
                      <div
                        key={u.id}
                        className="p-4 bg-muted border border-border-strong rounded-sm hover:border-border-strong transition-colors"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-foreground">{u.name}</h3>
                              <Badge variant="outline" className="bg-caution-subtle text-caution border-caution/30">
                                Pending
                              </Badge>
                            </div>
                            <div className="space-y-2 text-sm text-ink-muted">
                              <div className="flex flex-wrap items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span>{u.email}</span>
                              </div>
                            </div>
                            <p className="text-xs text-ink-muted mt-3">
                              Registered {new Date(u.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="gap-2 bg-positive hover:bg-positive text-positive-foreground"
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
                              className="gap-2 border-critical/30 text-critical hover:bg-critical-subtle"
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
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <Shield className="size-5 shrink-0 text-ink-faint" />
                  <div>
                    <CardTitle className="text-foreground">Demo Access Requests</CardTitle>
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
                <Loader2 className="h-6 w-6 animate-spin text-accent" />
              </div>
            ) : requests?.filter((r: any) => r.status === "pending").length === 0 ? (
              <div className="text-center py-8 text-ink-muted">
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
                      className="p-4 bg-muted border border-border-strong rounded-sm hover:border-border-strong transition-colors"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">{request.name}</h3>
                            <Badge variant="outline" className="bg-caution-subtle text-caution border-caution/30">
                              Pending
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm text-ink-muted">
                            <div className="flex flex-wrap items-center gap-2">
                              <Mail className="h-4 w-4" />
                              <span>{request.email}</span>
                            </div>
                            {request.company && (
                              <div className="flex flex-wrap items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                <span>{request.company}</span>
                              </div>
                            )}
                            {request.reason && (
                              <div className="flex flex-wrap items-start gap-2 mt-3">
                                <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p className="text-ink-muted">{request.reason}</p>
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-ink-muted mt-3">
                            Requested {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            className="gap-2 bg-positive hover:bg-positive text-positive-foreground"
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
                            className="gap-2 border-critical/30 text-critical hover:bg-critical-subtle"
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
            <Card className="bg-card border-border">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-3">
                  <Users className="size-5 shrink-0 text-ink-faint" />
                  <div>
                    <CardTitle className="text-foreground">All Users</CardTitle>
                    <CardDescription>Manage all registered users and their roles</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAllUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                  </div>
                ) : allUsers?.length === 0 ? (
                  <div className="text-center py-8 text-ink-muted">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {allUsers?.map((u: any) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-4 bg-muted border border-border-strong rounded-sm hover:border-border-strong transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="text-foreground font-medium">{u.name || 'No name'}</p>
                            {u.isApproved ? (
                              <Badge variant="outline" className="bg-positive-subtle text-positive border-positive/30">
                                Approved
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-caution-subtle text-caution border-caution/30">
                                Pending
                              </Badge>
                            )}
                            {u.role === 'admin' && (
                              <Badge variant="outline" className="bg-accent-subtle text-accent border-accent/30">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-ink-muted">{u.email}</p>
                          <p className="text-xs text-ink-muted mt-1">
                            {u.loginMethod} • Last sign in: {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : 'Never'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <Select
                            value={u.role}
                            onValueChange={(value: "user" | "admin") => 
                              updateRoleMutation.mutate({ userId: u.id, role: value })
                            }
                            disabled={u.id === user?.id}
                          >
                            <SelectTrigger className="w-24 bg-muted border-border-strong text-foreground">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-muted border-border-strong">
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          {!u.isApproved && (
                            <Button
                              size="sm"
                              className="gap-1 bg-positive hover:bg-positive text-positive-foreground"
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
                              className="gap-1 border-critical/30 text-critical hover:bg-critical-subtle"
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
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Deny Access Request</DialogTitle>
            <DialogDescription className="text-ink-muted">
              Provide a reason for denying this request (optional)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Request from:</p>
              <p className="text-ink-muted">{selectedRequest?.name}</p>
              <p className="text-sm text-ink-muted">{selectedRequest?.email}</p>
            </div>

            <Textarea
              placeholder="Reason for denial (optional)..."
              value={denyReason}
              onChange={(e) => setDenyReason(e.target.value)}
              className="bg-muted border-border-strong text-foreground placeholder:text-ink-faint"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDenyDialog(false)}
              className="border-border-strong text-ink-muted hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              className="gap-2 bg-critical hover:bg-critical text-critical-foreground"
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
