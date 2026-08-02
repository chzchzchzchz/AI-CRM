import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const utils = trpc.useUtils();

  // A correct password on a 2FA account returns a challenge instead of a session.
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (res: { twoFactorRequired?: boolean; challengeId?: string }) => {
      if (res.twoFactorRequired && res.challengeId) {
        setChallengeId(res.challengeId);
        return;
      }
      // Invalidate auth cache and redirect to home
      utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Invalid email or password");
    },
  });

  const verifyMutation = trpc.auth.loginVerify.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setLocation("/");
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "That code is not valid");
      // An expired or exhausted challenge cannot be retried, so send them back to the
      // password step rather than leaving them typing codes at a dead challenge.
      if (/expired|start over/i.test(err.message || "")) {
        setChallengeId(null);
        setCode("");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }

    loginMutation.mutate({ email, password });
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError(useBackupCode ? "Enter a recovery code" : "Enter the 6-digit code");
      return;
    }
    verifyMutation.mutate({ challengeId: challengeId!, code, isBackupCode: useBackupCode });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and Title */}
        <div className="flex flex-col items-center gap-4">
          <img
            src={APP_LOGO}
            alt={APP_TITLE}
            className="h-16 w-16 rounded-md object-cover shadow"
          />
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{APP_TITLE}</h1>
            <p className="text-sm text-muted-foreground">
              Your AI-powered sales intelligence command center
            </p>
          </div>
        </div>

        {/* Second factor. Shown only after the password has already been accepted. */}
        {challengeId ? (
          <Card>
            <CardHeader>
              <CardTitle>Two-step verification</CardTitle>
              <CardDescription>
                {useBackupCode
                  ? "Enter one of the recovery codes you saved when you turned this on."
                  : "Enter the 6-digit code from your authenticator app."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerify} className="space-y-4">
                {error && (
                  <div className="flex items-start gap-2 rounded-md border border-critical/40 bg-critical-subtle p-3 text-sm text-critical">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="code">{useBackupCode ? "Recovery code" : "Verification code"}</Label>
                  <Input
                    id="code"
                    name="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={useBackupCode ? "XXXXX-XXXXX" : "000000"}
                    // A phone keypad for digits, and no autocorrect mangling a code.
                    inputMode={useBackupCode ? "text" : "numeric"}
                    autoComplete="one-time-code"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Verify"
                  )}
                </Button>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => {
                      setUseBackupCode((v) => !v);
                      setCode("");
                      setError("");
                    }}
                  >
                    {useBackupCode ? "Use my authenticator app" : "I don't have my phone"}
                  </button>
                  <button
                    type="button"
                    className="text-ink-muted hover:underline"
                    onClick={() => {
                      setChallengeId(null);
                      setCode("");
                      setError("");
                    }}
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
        /* Login Form */
        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-sm bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-accent underline underline-offset-2">
                    Forgot?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        {/* Links */}
        <div className="text-center space-y-2 text-sm">
          <p className="text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="text-accent underline underline-offset-2">
              Sign up
            </Link>
          </p>
          <p className="text-muted-foreground">
            Need demo access?{" "}
            <Link href="/request-access" className="text-accent underline underline-offset-2">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
