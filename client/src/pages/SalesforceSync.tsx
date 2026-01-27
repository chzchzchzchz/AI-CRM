/**
 * Salesforce Sync Page
 * Dedicated page for managing Salesforce data synchronization
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { SalesforceSync as SalesforceSyncComponent } from "@/components/SalesforceSync";
import DashboardLayout from "@/components/DashboardLayout";

export default function SalesforceSync() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Please sign in to access this page.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salesforce Sync</h1>
          <p className="text-muted-foreground mt-2">
            Connect and sync your Salesforce accounts and contacts
          </p>
        </div>
        
        <SalesforceSyncComponent />
        
        <div className="text-sm text-muted-foreground">
          <h3 className="font-medium mb-2">Setup Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Go to Settings → Secrets in the Management UI</li>
            <li>Add <code className="bg-muted px-1 rounded">SALESFORCE_CLIENT_ID</code> (Consumer Key)</li>
            <li>Add <code className="bg-muted px-1 rounded">SALESFORCE_CLIENT_SECRET</code> (Consumer Secret)</li>
            <li>Add <code className="bg-muted px-1 rounded">SALESFORCE_INSTANCE_URL</code> (your Salesforce URL)</li>
            <li>Click "Test Connection" to verify</li>
            <li>Click "Full Sync" to import all accounts and contacts</li>
          </ol>
        </div>
      </div>
    </DashboardLayout>
  );
}
