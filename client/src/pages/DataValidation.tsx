import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, AlertTriangle, Info, Play, Loader2, RefreshCw } from "lucide-react";

export default function DataValidation() {
  const [validating, setValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);

  const summaryQuery = trpc.validation.getSummary.useQuery();
  const validateAccountsMutation = trpc.validation.validateAccounts.useMutation();
  const validateContactsMutation = trpc.validation.validateContacts.useMutation();
  const validateAllAccountsMutation = trpc.validation.validateAllAccountsBulk.useMutation();
  
  const [bulkValidating, setBulkValidating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  const runAccountValidation = async () => {
    setValidating(true);
    try {
      const result = await validateAccountsMutation.mutateAsync({ limit: 20 });
      setValidationResults(result);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setValidating(false);
    }
  };

  const runContactValidation = async () => {
    setValidating(true);
    try {
      const result = await validateContactsMutation.mutateAsync({ limit: 30 });
      setValidationResults(result);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setValidating(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-critical" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-caution" />;
      case 'info':
        return <Info className="h-4 w-4 text-accent" />;
      default:
        return <CheckCircle className="h-4 w-4 text-positive" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-critical-subtle text-critical border-critical/30',
      warning: 'bg-caution-subtle text-caution border-caution/30',
      info: 'bg-accent-subtle text-accent border-accent/30'
    };
    return colors[severity as keyof typeof colors] || '';
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Data Validation</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered data quality checks with web search verification
          </p>
        </div>
        <Button
          onClick={() => summaryQuery.refetch()}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      {summaryQuery.data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 border-l-4 border-l-blue-500">
            <div className="text-sm text-muted-foreground">Total Accounts</div>
            <div className="text-2xl font-semibold mt-1">{summaryQuery.data.totalAccounts}</div>
          </Card>
          <Card className="p-6 border-l-4 border-l-cyan-500">
            <div className="text-sm text-muted-foreground">Total Contacts</div>
            <div className="text-2xl font-semibold mt-1">{summaryQuery.data.totalContacts}</div>
          </Card>
          <Card className="p-6 border-l-4 border-l-orange-500">
            <div className="text-sm text-muted-foreground">Account Issues</div>
            <div className="text-2xl font-semibold mt-1">{summaryQuery.data.totalIssues}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summaryQuery.data.accountIssues.missingDomain} missing domains, 
              {summaryQuery.data.accountIssues.missingIndustry} missing industries
            </div>
          </Card>
          <Card className="p-6 border-l-4 border-l-purple-500">
            <div className="text-sm text-muted-foreground">Contact Issues</div>
            <div className="text-2xl font-semibold mt-1">
              {summaryQuery.data.contactIssues.missingEmail + summaryQuery.data.contactIssues.missingTitle}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summaryQuery.data.contactIssues.missingEmail} missing emails,
              {summaryQuery.data.contactIssues.missingTitle} missing titles
            </div>
          </Card>
        </div>
      )}

      {/* Validation Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Run Validation</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Validate data using web search and AI to verify actual truth (not just format checks).
          This process uses DuckDuckGo search and AI analysis to confirm company domains, employee counts, contact employment, etc.
        </p>
        <div className="space-y-4">
          <div className="flex gap-4">
            <Button
              onClick={runAccountValidation}
              disabled={validating || bulkValidating}
              className="bg-accent hover:bg-accent"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Validate Accounts (20)
                </>
              )}
            </Button>
            <Button
              onClick={runContactValidation}
              disabled={validating || bulkValidating}
              className="bg-accent hover:bg-accent"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Validate Contacts (30)
                </>
              )}
            </Button>
          </div>
          
          {/* Bulk Validation */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-2">Bulk Operations</h3>
            <Button
              onClick={async () => {
                setBulkValidating(true);
                setBulkProgress(0);
                try {
                  const result = await validateAllAccountsMutation.mutateAsync();
                  setValidationResults(result);
                  setBulkProgress(100);
                } catch (error) {
                  console.error('Bulk validation failed:', error);
                } finally {
                  setBulkValidating(false);
                }
              }}
              disabled={validating || bulkValidating}
              variant="outline"
              className="w-full border-accent/30 text-accent hover:bg-accent-subtle"
            >
              {bulkValidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating All {summaryQuery.data?.totalAccounts || 709} Accounts...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Validate All {summaryQuery.data?.totalAccounts || 709} Accounts
                </>
              )}
            </Button>
            {bulkValidating && (
              <div className="mt-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${bulkProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Processing... This may take several minutes.
                </p>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          ⚠️ Validation takes ~2 seconds per record (web search + AI analysis). 
          20 accounts = ~40 seconds, 30 contacts = ~60 seconds.
        </p>
      </Card>

      {/* Validation Results */}
      {validationResults && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Validation Results</h2>
            <Badge variant="outline" className="text-sm">
              {validationResults.totalIssues} issues found
            </Badge>
          </div>

          {validationResults.totalIssues === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-positive" />
              <p className="font-medium">No issues found!</p>
              <p className="text-sm">All validated data passed verification checks.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {validationResults.allIssues.map((issue: any, index: number) => (
                <Card key={index} className="p-4 border-l-4" style={{
                  borderLeftColor: issue.severity === 'critical' ? '#ef4444' : 
                                   issue.severity === 'warning' ? '#f97316' : '#3b82f6'
                }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{issue.entityName}</span>
                          <Badge variant="outline" className={getSeverityBadge(issue.severity)}>
                            {issue.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {issue.field}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {issue.issue}
                        </p>
                        <div className="bg-muted/50 rounded p-2 text-xs">
                          <strong>Suggestion:</strong> {issue.suggestion}
                        </div>
                        {issue.searchResults && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              View search evidence (confidence: {Math.round(issue.confidence * 100)}%)
                            </summary>
                            <div className="mt-2 p-2 bg-muted/30 rounded text-xs whitespace-pre-wrap">
                              {issue.searchResults}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="ml-4">
                      Fix
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Instructions */}
      {!validationResults && (
        <Card className="p-6 bg-muted/30">
          <h3 className="font-semibold mb-2">How It Works</h3>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• <strong>Web Search Verification:</strong> Uses DuckDuckGo to search for company info, LinkedIn profiles, employee counts</li>
            <li>• <strong>AI Analysis:</strong> AI analyzes search results to determine if data is accurate</li>
            <li>• <strong>Domain Matching:</strong> Verifies company names match their domains</li>
            <li>• <strong>Employment Verification:</strong> Checks if contacts actually work at assigned companies</li>
            <li>• <strong>Email Validation:</strong> Confirms email domains match company domains</li>
            <li>• <strong>Employee Count Check:</strong> Validates employee counts against public data</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
