import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { Loader2, Copy, Check, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

/**
 * Inviting a colleague into this workspace.
 *
 * The two paths that existed could not do it: signing up creates a NEW organization, and
 * the public access-request form has no organization to attach to. The invitation link is
 * what names the workspace, so this panel is how a customer builds a team.
 *
 * The link is shown ONCE, on purpose. Only its hash is stored, which is what makes the
 * stored row safe if a database is ever dumped — an admin who loses the link revokes it
 * and sends another, which is cheap. Saying so on screen matters: a person who assumes
 * they can come back for it will close this card and lose it silently.
 */
export function TeamInvites() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [issued, setIssued] = useState<{ email: string; acceptUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const list = trpc.invites.list.useQuery();

  const create = trpc.invites.create.useMutation({
    onSuccess: res => {
      setIssued({ email: res.email, acceptUrl: res.acceptUrl });
      setEmail("");
      list.refetch();
    },
    onError: err => toast.error(err.message),
  });

  const revoke = trpc.invites.revoke.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked.");
      list.refetch();
    },
    onError: err => toast.error(err.message),
  });

  const tone: Record<string, string> = {
    pending: "text-accent",
    accepted: "text-positive",
    expired: "text-ink-muted",
    revoked: "text-ink-muted",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserPlus className="h-4 w-4" />
          Team
        </CardTitle>
        <CardDescription>
          Invite someone into this workspace. They join your organization and see your data —
          signing up on their own would give them an empty one instead.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={e => {
            e.preventDefault();
            create.mutate({ email, role });
          }}
        >
          <Input
            type="email"
            required
            placeholder="colleague@company.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="sm:flex-1"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as "user" | "admin")}
            className="h-9 rounded-md border border-border/60 bg-card px-2 text-sm"
            aria-label="Role"
          >
            <option value="user">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Invite
          </Button>
        </form>

        {issued ? (
          <div className="rounded-md border border-accent/30 bg-accent-subtle p-3">
            <p className="text-sm font-medium">Invitation link for {issued.email}</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Send this to them yourself. It's shown once — only a hash is stored, so it can't be
              retrieved later. Lost it? Revoke below and invite again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1.5 text-xs">
                {issued.acceptUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issued.acceptUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // Clipboard access is refused in plenty of ordinary contexts (no
                    // HTTPS, permissions). Saying so beats a button that appears to work.
                    toast.error("Couldn't copy — select the link and copy it manually.");
                  }
                }}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ) : null}

        {list.error ? (
          <DataUnavailable what="invitations" detail={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-accent" />
          </div>
        ) : !list.data?.length ? (
          <p className="py-4 text-center text-sm text-ink-muted">No invitations yet.</p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-md border border-border/60">
            {list.data.map((inv: any) => (
              <li key={inv.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{inv.email}</p>
                  <p className="text-xs text-ink-muted">
                    {inv.role === "admin" ? "Admin" : "Member"}
                    {inv.status === "pending"
                      ? ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <Badge variant="outline" className={tone[inv.status]}>
                  {inv.status}
                </Badge>
                {inv.status === "pending" ? (
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Revoke invitation for ${inv.email}`}
                    onClick={() => revoke.mutate({ id: inv.id })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
