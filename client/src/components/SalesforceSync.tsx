/**
 * Salesforce Sync Component
 * UI for testing connection and syncing data from Salesforce
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, XCircle, Database, Users, Building } from "lucide-react";

export function SalesforceSync() {
  const [syncStatus, setSyncStatus] = useState<string>("");
  // The message can now honestly report a non-zero error count (see
  // server/routers/salesforce.ts) instead of always reading as a clean run — this
  // tracks that so the status box below can render it distinctly from a real success.
  const [syncHadErrors, setSyncHadErrors] = useState(false);

  // Get current sync status
  const { data: status, refetch: refetchStatus } = trpc.salesforce.getSyncStatus.useQuery();

  // Test connection mutation
  const testConnection = trpc.salesforce.testConnection.useQuery();

  // Sync mutations
  const syncAccounts = trpc.salesforce.syncAccounts.useMutation({
    onSuccess: (data) => {
      setSyncStatus(data.message);
      setSyncHadErrors((data.errors ?? 0) > 0);
      refetchStatus();
    },
    onError: (error) => {
      setSyncStatus(`Error: ${error.message}`);
      setSyncHadErrors(true);
    },
  });

  const syncContacts = trpc.salesforce.syncContacts.useMutation({
    onSuccess: (data) => {
      setSyncStatus(data.message);
      setSyncHadErrors((data.errors ?? 0) > 0);
      refetchStatus();
    },
    onError: (error) => {
      setSyncStatus(`Error: ${error.message}`);
      setSyncHadErrors(true);
    },
  });

  const fullSync = trpc.salesforce.fullSync.useMutation({
    onSuccess: (data) => {
      setSyncStatus(data.message);
      setSyncHadErrors((data.results.accounts.errors ?? 0) + (data.results.contacts.errors ?? 0) > 0);
      refetchStatus();
    },
    onError: (error) => {
      setSyncStatus(`Error: ${error.message}`);
      setSyncHadErrors(true);
    },
  });

  const isLoading = syncAccounts.isPending || syncContacts.isPending || fullSync.isPending;

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Database className="h-5 w-5" />
          Salesforce Sync
        </CardTitle>
        <CardDescription>
          Sync accounts and contacts from Salesforce
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">Connection:</span>
          {testConnection.isLoading ? (
            <Badge variant="secondary">Checking...</Badge>
          ) : testConnection.data?.connected ? (
            <Badge variant="default" className="bg-positive">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              Not Connected
            </Badge>
          )}
        </div>

        {/* Current Data Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 [&>*]:min-w-0">
          <div className="text-center p-2 sm:p-3 bg-muted rounded-sm">
            <Building className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-xl sm:text-2xl font-semibold tabular-nums">{status?.accounts || 0}</div>
            <div className="text-2xs sm:text-xs text-ink-muted truncate">Accounts</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-muted rounded-sm">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-xl sm:text-2xl font-semibold tabular-nums">{status?.contacts || 0}</div>
            <div className="text-2xs sm:text-xs text-ink-muted truncate">Contacts</div>
          </div>
          <div className="text-center p-2 sm:p-3 bg-muted rounded-sm">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-xl sm:text-2xl font-semibold tabular-nums">{status?.linkedContacts || 0}</div>
            <div className="text-2xs sm:text-xs text-ink-muted truncate">Linked</div>
          </div>
        </div>

        {/* Sync Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => syncAccounts.mutate()}
            disabled={isLoading || !testConnection.data?.connected}
            variant="outline"
          >
            {syncAccounts.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Sync Accounts
          </Button>
          <Button
            onClick={() => syncContacts.mutate()}
            disabled={isLoading || !testConnection.data?.connected}
            variant="outline"
          >
            {syncContacts.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Sync Contacts
          </Button>
          <Button
            onClick={() => fullSync.mutate()}
            disabled={isLoading || !testConnection.data?.connected}
          >
            {fullSync.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
            Full Sync
          </Button>
        </div>

        {/* Status Message */}
        {syncStatus && (
          <div className={`p-3 rounded-sm text-sm break-words ${
            syncHadErrors ? "bg-caution-subtle border border-caution/30 text-caution" : "bg-muted"
          }`}>
            {syncStatus}
          </div>
        )}

        {/* Error Message */}
        {testConnection.data && !testConnection.data.connected && (
          <div className="p-3 bg-critical-subtle text-critical rounded-sm text-sm break-words">
            {testConnection.data.error || "Unable to connect to Salesforce. Check your credentials in Settings → Secrets."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
