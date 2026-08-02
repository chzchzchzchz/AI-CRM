import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, Copy, Check, AlertTriangle } from "lucide-react";

/**
 * Per-user security settings. Today that means two-factor authentication.
 *
 * The server side of this existed for a long time and was never mounted, so there was
 * nothing to reach it with — the README claimed 2FA while `twoFactorEnabled` was written
 * by nothing and read by nothing.
 */
export default function Security() {
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.twoFA.getStatus.useQuery();

  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  // Shown exactly once, right after enrolment. There is no way to see them again.
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const secret = trpc.twoFA.generateSecret.useQuery(undefined, { enabled: enrolling });

  const enable = trpc.twoFA.enable.useMutation({
    onSuccess: (res: { backupCodes: string[] }) => {
      setFreshCodes(res.backupCodes);
      setEnrolling(false);
      setCode("");
      utils.twoFA.getStatus.invalidate();
      toast.success("Two-factor authentication is on");
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Could not enable 2FA"),
  });

  const disable = trpc.twoFA.disable.useMutation({
    onSuccess: () => {
      setPassword("");
      setFreshCodes(null);
      utils.twoFA.getStatus.invalidate();
      toast.success("Two-factor authentication is off");
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Could not disable 2FA"),
  });

  const regenerate = trpc.twoFA.regenerateBackupCodes.useMutation({
    onSuccess: (res: { backupCodes: string[] }) => {
      setFreshCodes(res.backupCodes);
      setPassword("");
      utils.twoFA.getStatus.invalidate();
      toast.success("New recovery codes issued — the old ones no longer work");
    },
    onError: (e: { message?: string }) => toast.error(e.message || "Could not issue new codes"),
  });

  const copyCodes = () => {
    if (!freshCodes) return;
    navigator.clipboard.writeText(freshCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lowOnCodes =
    !!status?.enabled && status.backupCodesRemaining <= 2 && status.backupCodesRemaining > 0;

  return (
    <div className="container max-w-3xl py-10 space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Two-factor authentication for your account.
        </p>
      </div>

      {/* The codes, shown once. Rendered above everything so it cannot be missed. */}
      {freshCodes && (
        <Card className="border-caution/50">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-caution" />
              Save your recovery codes
            </CardTitle>
            <CardDescription>
              Each one signs you in once if you lose your phone. This is the only time
              they are shown — they are stored hashed and cannot be displayed again.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/60 bg-muted p-4 font-mono text-sm tabular-nums">
              {freshCodes.map((c) => (
                <div key={c}>{c}</div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyCodes}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy all"}
              </Button>
              <Button size="sm" onClick={() => setFreshCodes(null)}>
                I've saved them
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {status?.enabled ? (
              <ShieldCheck className="h-4 w-4 text-positive" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-ink-muted" />
            )}
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Checking…"
              : status?.enabled
                ? `On. ${status.backupCodesRemaining} of ${status.backupCodeTotal} recovery codes left.`
                : "Off. Your password alone signs you in."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {lowOnCodes && (
            <div className="flex items-start gap-2 rounded-md border border-caution/40 bg-caution-subtle p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
              <span>
                You have {status!.backupCodesRemaining} recovery{" "}
                {status!.backupCodesRemaining === 1 ? "code" : "codes"} left. Issue a new
                set before you run out — without one, losing your phone locks you out.
              </span>
            </div>
          )}

          {/* Not enrolled, not mid-enrolment */}
          {!status?.enabled && !enrolling && (
            <Button onClick={() => setEnrolling(true)}>Turn on two-factor</Button>
          )}

          {/* Enrolment */}
          {!status?.enabled && enrolling && (
            <div className="space-y-4">
              {secret.isLoading && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing your code…
                </div>
              )}
              {secret.data && (
                <>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <img
                      src={secret.data.qrCode}
                      alt="Scan this with your authenticator app"
                      className="h-44 w-44 shrink-0 rounded-md border border-border/60 bg-white p-2"
                    />
                    <div className="space-y-2 text-sm">
                      <p>Scan this with Google Authenticator, 1Password, Authy, or similar.</p>
                      <p className="text-ink-muted">
                        Can't scan? Enter this key by hand:
                      </p>
                      <code className="block break-all rounded-sm border border-border/60 bg-muted px-2 py-1 font-mono text-xs">
                        {secret.data.secret}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="enroll-code">
                      Enter the 6-digit code to confirm it works
                    </Label>
                    <Input
                      id="enroll-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="max-w-40"
                    />
                    <p className="text-xs text-ink-muted">
                      Nothing is saved until this code checks out, so an abandoned setup
                      can't lock you out.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={enable.isPending || code.trim().length < 6}
                      onClick={() =>
                        enable.mutate({ secret: secret.data!.secret, verificationCode: code })
                      }
                    >
                      {enable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm and turn on
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEnrolling(false);
                        setCode("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Enrolled */}
          {status?.enabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pw">Confirm your password to make changes</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="max-w-sm"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!password || regenerate.isPending}
                  onClick={() => regenerate.mutate({ password })}
                >
                  {regenerate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Issue new recovery codes
                </Button>
                <Button
                  variant="destructive"
                  disabled={!password || disable.isPending}
                  onClick={() => disable.mutate({ password })}
                >
                  {disable.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Turn off two-factor
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
