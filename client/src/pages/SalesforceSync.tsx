/**
 * Salesforce Sync Page
 * Dedicated page for managing Salesforce data synchronization
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { SalesforceSync as SalesforceSyncComponent } from "@/components/SalesforceSync";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, Lock } from "lucide-react";

const SETUP_STEPS = [
  { key: "SALESFORCE_CLIENT_ID", label: "Consumer Key" },
  { key: "SALESFORCE_CLIENT_SECRET", label: "Consumer Secret" },
  { key: "SALESFORCE_INSTANCE_URL", label: "Your Salesforce URL" },
];

export default function SalesforceSync() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-ink-faint" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        icon={Lock}
        title="Sign in required"
        description="Sign in to connect a Salesforce org and sync accounts."
      />
    );
  }

  return (
    <div className="container max-w-4xl space-y-5 py-1">
      <PageHeader
        title="Salesforce Sync"
        description="Connect a Salesforce org and sync accounts and contacts."
      />

      <SalesforceSyncComponent />

      <Card variant="sunken">
        <CardHeader>
          <CardTitle>Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-ink-muted">
          <p>
            Add these secrets under Settings → Secrets, then run Test Connection
            followed by Full Sync.
          </p>
          <dl className="space-y-1.5">
            {SETUP_STEPS.map(step => (
              <div key={step.key} className="flex flex-wrap items-baseline gap-2">
                <dt className="min-w-0">
                  {/* These identifiers have no spaces, so they need an explicit
                      break opportunity or they set the card's minimum width. */}
                  <code className="rounded-xs bg-muted px-1.5 py-0.5 font-mono text-2xs break-all text-foreground">
                    {step.key}
                  </code>
                </dt>
                <dd>{step.label}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
