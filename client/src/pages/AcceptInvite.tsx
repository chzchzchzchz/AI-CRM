import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

/**
 * Where a colleague lands when an admin invites them.
 *
 * Signing up would have given them their own empty workspace instead of joining the team
 * that invited them, and the public access-request form has no organization to attach to.
 * The token in this URL is what names the workspace, so this page is the only way in.
 *
 * The page reads the invitation BEFORE asking for a password. Someone standing at a dead
 * link should learn that from the page, not from a rejected form after typing — and the
 * four ways a link can be dead are four different messages, because "already used" and
 * "not valid" send a person to different places.
 */
export default function AcceptInvite() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const preview = trpc.invites.preview.useQuery({ token }, { enabled: token.length > 0, retry: false });

  const accept = trpc.invites.accept.useMutation({
    onSuccess: () => setDone(true),
    // A failed acceptance must say so. Silently doing nothing would leave someone
    // pressing a button that appears to work while they have no account.
    onError: err => setError(err.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }
    accept.mutate({ token, name, password });
  }

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-xl font-semibold tracking-tight">{APP_TITLE}</h1>
        {children}
      </div>
    </div>
  );

  if (!token) {
    return shell(
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-caution" />
          <p className="font-medium">This link is missing its invitation code.</p>
          <p className="mt-1 text-sm text-ink-muted">
            Check you copied the whole link, or ask whoever invited you for a new one.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (preview.isLoading) {
    return shell(
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
        </CardContent>
      </Card>
    );
  }

  // A failed lookup and an invalid invitation are different things, and neither is
  // "please type your password anyway".
  if (preview.error || (preview.data && !preview.data.valid)) {
    return shell(
      <Card>
        <CardContent className="py-10 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-caution" />
          <p className="font-medium">
            {preview.data && !preview.data.valid
              ? preview.data.message
              : "We couldn't check this invitation just now."}
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            <Link href="/login" className="text-accent underline underline-offset-2">
              Go to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return shell(
      <Card>
        <CardContent className="py-10 text-center">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-positive" />
          <p className="font-medium">You're in.</p>
          <p className="mt-1 text-sm text-ink-muted">Sign in with the password you just chose.</p>
          <Button className="mt-5" onClick={() => navigate("/login")}>
            Go to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  const invited = preview.data && preview.data.valid ? preview.data : null;

  return shell(
    <Card>
      <CardHeader>
        <CardTitle>Join the team</CardTitle>
        <CardDescription>
          {invited ? (
            <>
              You were invited as <span className="font-medium text-foreground">{invited.email}</span>
              {invited.role === "admin" ? " with admin access." : "."}
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input id="name" value={name} onChange={e => setName(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Choose a password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {error ? (
            <p className="flex items-start gap-2 text-sm text-critical">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={accept.isPending}>
            {accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Join
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
