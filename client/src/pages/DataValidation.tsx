import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Navigation } from "@/components/Navigation";
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

  // Severity is color-coded, so it always carries a glyph + word (never color alone).
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-400" />;
      default:
        return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-slate-800 text-red-400 border-red-500/30',
      warning: 'bg-slate-800 text-amber-400 border-amber-500/30',
      info: 'bg-slate-800 text-blue-400 border-blue-500/30'
    };
    return colors[severity as keyof typeof colors] || '';
  };

  const summary = summaryQuery.data;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Navigation />

      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-50">Data Validation</h1>
            <p className="text-slate-400 mt-1 text-sm">
              AI checks that verify the truth of a record — web search + analysis, not just format.
            </p>
          </div>
          <Button
            onClick={() => summaryQuery.refetch()}
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary — one panel, divided; not a grid of identical hero cards. */}
        {summary && (
          <Card className="bg-slate-900 border-slate-800 shadow-none p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:divide-x md:divide-slate-800">
              <div className="md:pr-6">
                <div className="text-sm text-slate-400">Total Accounts</div>
                <div className="text-2xl font-mono font-semibold text-slate-100 mt-1">{summary.totalAccounts}</div>
              </div>
              <div className="md:px-6">
                <div className="text-sm text-slate-400">Total Contacts</div>
                <div className="text-2xl font-mono font-semibold text-slate-100 mt-1">{summary.totalContacts}</div>
              </div>
              <div className="md:px-6">
                <div className="text-sm text-slate-400">Account Issues</div>
                <div className="text-2xl font-mono font-semibold text-amber-400 mt-1">{summary.totalIssues}</div>
                <div className="text-xs text-slate-400 mt-1">
                  <span className="font-mono text-slate-300">{summary.accountIssues.missingDomain}</span> missing domains,{" "}
                  <span className="font-mono text-slate-300">{summary.accountIssues.missingIndustry}</span> missing industries
                </div>
              </div>
              <div className="md:pl-6">
                <div className="text-sm text-slate-400">Contact Issues</div>
                <div className="text-2xl font-mono font-semibold text-amber-400 mt-1">
                  {summary.contactIssues.missingEmail + summary.contactIssues.missingTitle}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  <span className="font-mono text-slate-300">{summary.contactIssues.missingEmail}</span> missing emails,{" "}
                  <span className="font-mono text-slate-300">{summary.contactIssues.missingTitle}</span> missing titles
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Validation Actions */}
        <Card className="bg-slate-900 border-slate-800 shadow-none p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-2">Run Validation</h2>
          <p className="text-sm text-slate-400 mb-4">
            Verify actual truth (not just format) via DuckDuckGo search and AI analysis — confirming company domains,
            employee counts, contact employment, and more.
          </p>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={runAccountValidation}
                disabled={validating || bulkValidating}
                variant="signal"
              >
                {validating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating…
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
                variant="outline"
                className="border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-slate-100"
              >
                {validating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating…
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
            <div className="border-t border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">Bulk Operations</h3>
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
                className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-slate-100"
              >
                {bulkValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating all {summary?.totalAccounts || 709} accounts…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Validate All {summary?.totalAccounts || 709} Accounts
                  </>
                )}
              </Button>
              {bulkValidating && (
                <div className="mt-2">
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-500 transition-all duration-300"
                      style={{ width: `${bulkProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Processing… This may take several minutes.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            Validation takes ~2 seconds per record (web search + AI). 20 accounts ≈ 40s, 30 contacts ≈ 60s.
          </p>
        </Card>

        {/* Validation Results */}
        {validationResults && (
          <Card className="bg-slate-900 border-slate-800 shadow-none p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-100">Validation Results</h2>
              <Badge variant="outline" className="text-sm border-slate-700 text-slate-300">
                <span className="font-mono">{validationResults.totalIssues}</span> issues found
              </Badge>
            </div>

            {validationResults.totalIssues === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
                <p className="font-medium text-slate-200">No issues found</p>
                <p className="text-sm">All validated data passed verification checks.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {validationResults.allIssues.map((issue: any, index: number) => (
                  <div key={index} className="rounded-lg bg-slate-800/50 border border-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-slate-100">{issue.entityName}</span>
                            <Badge variant="outline" className={getSeverityBadge(issue.severity)}>
                              {issue.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                              {issue.field}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-400 mb-2">
                            {issue.issue}
                          </p>
                          <div className="bg-slate-900 rounded-lg p-2 text-xs text-slate-300">
                            <strong className="text-slate-200">Suggestion:</strong> {issue.suggestion}
                          </div>
                          {issue.searchResults && (
                            <details className="mt-2">
                              <summary className="text-xs text-slate-400 cursor-pointer hover:text-cyan-400">
                                View search evidence (confidence:{" "}
                                <span className="font-mono">{Math.round(issue.confidence * 100)}%</span>)
                              </summary>
                              <div className="mt-2 p-2 bg-slate-900 rounded-lg text-xs text-slate-400 whitespace-pre-wrap">
                                {issue.searchResults}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-4 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                      >
                        Fix
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Instructions */}
        {!validationResults && (
          <Card className="bg-slate-900 border-slate-800 shadow-none p-6">
            <h3 className="font-semibold text-slate-100 mb-3">How It Works</h3>
            <ul className="text-sm text-slate-400 space-y-2">
              <li>• <strong className="text-slate-200">Web Search Verification:</strong> Uses DuckDuckGo to search for company info, LinkedIn profiles, employee counts</li>
              <li>• <strong className="text-slate-200">AI Analysis:</strong> AI analyzes search results to determine if data is accurate</li>
              <li>• <strong className="text-slate-200">Domain Matching:</strong> Verifies company names match their domains</li>
              <li>• <strong className="text-slate-200">Employment Verification:</strong> Checks if contacts actually work at assigned companies</li>
              <li>• <strong className="text-slate-200">Email Validation:</strong> Confirms email domains match company domains</li>
              <li>• <strong className="text-slate-200">Employee Count Check:</strong> Validates employee counts against public data</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
