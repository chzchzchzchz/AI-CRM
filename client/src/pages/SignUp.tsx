import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Loader2, CheckCircle, AlertCircle, MailCheck } from "lucide-react";

/**
 * Signup is three steps, not one: create the account, prove the address is yours,
 * then wait for an admin.
 *
 * The middle step was fully built on the server — code generation, expiry, an
 * attempt limit, a mailer — and nothing ever called it, so every account reached
 * the approval queue with an address no one had checked.
 */
type Stage = "form" | "verify" | "pending";

export default function SignUp() {
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const [userId, setUserId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  // In demo mode the server returns the code instead of mailing it, so the flow is
  // walkable without a configured mailer. In production this stays null.
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const sendCode = trpc.emailVerification.sendVerificationCode.useMutation({
    onSuccess: res => {
      const demo = "code" in res ? (res.code as string) : null;
      setDemoCode(demo);
      // `emailSent` used to be discarded, so a broken or unconfigured mailer still
      // landed on "We sent a 6-digit code to you@company.com" with no code ever sent
      // and no way off the screen except abandoning verification via "Do this later".
      if (!demo && res.emailSent === false) {
        setNotice("We couldn't send a verification email right now. You can try again or verify later.");
      }
      setStage("verify");
    },
    // A failed send must not strand the account: it exists and is queued for approval
    // either way, so say what happened and move on rather than looping on the form.
    onError: err => {
      setNotice(`We couldn't send a verification email (${err.message}).`);
      setStage("pending");
    },
  });

  const signUpMutation = trpc.auth.signUp.useMutation({
    onSuccess: res => {
      if (res.userId) {
        setUserId(res.userId);
        sendCode.mutate({ userId: res.userId, email });
      } else {
        setStage("pending");
      }
    },
    onError: err => setError(err.message || "Failed to create account"),
  });

  const verify = trpc.emailVerification.verifyEmail.useMutation({
    onSuccess: () => {
      setNotice("");
      setStage("pending");
    },
    onError: err => setError(err.message || "Could not verify that code"),
  });

  const resend = trpc.emailVerification.resendVerificationCode.useMutation({
    onSuccess: res => {
      const demo = "code" in res ? (res.code as string) : null;
      setDemoCode(demo);
      setError("");
      setNotice(
        demo || res.emailSent !== false
          ? "A new code is on its way."
          : "We couldn't send that email right now. Please try again in a moment."
      );
    },
    onError: err => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !name) {
      setError("Please fill in all required fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    signUpMutation.mutate({ email, password, name });
  };

  if (stage === "verify") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="h-5 w-5 text-accent" />
              Verify your email
            </CardTitle>
            <CardDescription>
              We sent a 6-digit code to <span className="text-foreground">{email}</span>. It
              expires in 10 minutes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                setError("");
                if (userId) verify.mutate({ userId, code: code.trim() });
              }}
            >
              {error && (
                <div className="flex items-center gap-2 rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              {notice && !error && (
                <div className="rounded-sm bg-muted p-3 text-sm text-ink-muted">{notice}</div>
              )}
              {demoCode && (
                <div className="rounded-sm border border-caution/30 bg-caution-subtle p-3 text-sm">
                  <span className="text-ink-muted">Demo mode — no mail was sent. Code:</span>{" "}
                  <span className="tabular-nums font-semibold text-foreground">{demoCode}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="code">Verification code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="tabular-nums tracking-[0.3em]"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={verify.isPending || !code.trim()}>
                {verify.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify email"
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-accent underline underline-offset-2 disabled:opacity-50"
                  disabled={resend.isPending || !userId}
                  onClick={() => userId && resend.mutate({ userId, email })}
                >
                  {resend.isPending ? "Sending…" : "Resend code"}
                </button>
                {/* The account already exists, so skipping only forgoes the check. */}
                <button
                  type="button"
                  className="text-ink-muted underline underline-offset-2"
                  onClick={() => setStage("pending")}
                >
                  Do this later
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stage === "pending") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle className="h-16 w-16 text-caution" />
              <h2 className="text-2xl font-semibold">Account Pending Approval</h2>
              <p className="text-muted-foreground">
                Your account has been created and is pending admin approval.
                You'll receive an email once your account is approved.
              </p>
              {notice && <p className="text-sm text-ink-muted">{notice}</p>}
              <Link href="/login" className="text-sm text-accent underline underline-offset-2">
                Back to sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              Create your account
            </p>
          </div>
        </div>

        {/* Sign Up Form */}
        <Card>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>
              Enter your details to create an account
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
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
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
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={signUpMutation.isPending}
              >
                {signUpMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="text-center space-y-2 text-sm">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-accent underline underline-offset-2">
              Sign in
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
