import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_LOGO, APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Loader2, CheckCircle, AlertCircle, Mail } from "lucide-react";

export default function RequestAccess() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const requestMutation = trpc.auth.requestAccess.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (err: { message?: string }) => {
      setError(err.message || "Failed to submit request");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !name) {
      setError("Please fill in all required fields");
      return;
    }

    requestMutation.mutate({ email, name, company, reason });
  };

  if (success) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-sm bg-positive-subtle flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-positive" />
              </div>
              <h2 className="text-2xl font-semibold">Request Submitted!</h2>
              <p className="text-muted-foreground">
                Your access request has been submitted. You'll receive an email once your request is reviewed.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Check your inbox at <span className="font-medium text-foreground">{email}</span>
              </div>
              <Link href="/login">
                <Button variant="outline" className="mt-4">
                  Back to Login
                </Button>
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
              Request demo access
            </p>
          </div>
        </div>

        {/* Request Form */}
        <Card>
          <CardHeader>
            <CardTitle>Request Access</CardTitle>
            <CardDescription>
              Fill out this form to request access to the demo. An admin will review your request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-sm bg-destructive/10 text-destructive text-sm">
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
                <Label htmlFor="email">Work Email *</Label>
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
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  type="text"
                  placeholder="Acme Inc."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Why do you want access?</Label>
                <Textarea
                  id="reason"
                  placeholder="I'm interested in seeing how the platform works..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={requestMutation.isPending}
              >
                {requestMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Links */}
        <div className="text-center space-y-2 text-sm">
          <p className="text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
