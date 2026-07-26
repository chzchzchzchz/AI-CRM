import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { APP_LOGO } from "@/const";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetCode, setResetCode] = useState("");

  const sendResetCode = trpc.emailVerification.sendPasswordResetCode.useMutation({
    onSuccess: (data: any) => {
      toast.success("Reset code sent to your email!");
      setResetCode(data.code || "");
      setStep("code");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send reset code");
    },
  });

  const resetPassword = trpc.emailVerification.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully!");
      setTimeout(() => navigate("/login"), 2000);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to reset password");
    },
  });

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    sendResetCode.mutate({ email });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      toast.error("Please enter the reset code");
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error("Please enter your new password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    resetPassword.mutate({ code, newPassword });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={APP_LOGO} alt="Logo" className="h-8" />
          </div>
          <CardTitle className="text-2xl text-foreground">Reset Password</CardTitle>
          <CardDescription className="text-ink-muted">
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "code" && "Enter the code and your new password"}
            {step === "password" && "Create your new password"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "email" && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <Input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted border-border-strong text-foreground placeholder:text-ink-faint"
                />
              </div>

              <Button
                type="submit"
                disabled={sendResetCode.isPending}
                className="w-full gap-2 bg-accent hover:bg-accent text-accent-foreground"
              >
                {sendResetCode.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                Send Reset Code
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-2 text-ink-muted hover:text-foreground"
                  onClick={() => navigate("/login")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-accent-subtle border border-accent/30 rounded-sm text-sm text-accent">
                <p className="font-medium mb-1">Code sent to {email}</p>
                <p className="text-xs text-accent/70">Check your email for the 32-character reset code</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Reset Code</label>
                <Input
                  type="text"
                  placeholder="Enter your reset code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-muted border-border-strong text-foreground placeholder:text-ink-faint font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">New Password</label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-muted border-border-strong text-foreground placeholder:text-ink-faint"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-muted border-border-strong text-foreground placeholder:text-ink-faint"
                />
              </div>

              <Button
                type="submit"
                disabled={resetPassword.isPending}
                className="w-full gap-2 bg-accent hover:bg-accent text-accent-foreground"
              >
                {resetPassword.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Reset Password
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full gap-2 text-ink-muted hover:text-foreground"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setNewPassword("");
                  setConfirmPassword("");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
