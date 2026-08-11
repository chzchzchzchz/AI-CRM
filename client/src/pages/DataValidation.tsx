import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, AlertTriangle, Info, Play, Loader2, RefreshCw } from "lucide-react";
import { ValidationIssues } from "@/components/ValidationIssues";

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
      critical: 'bg-muted text-critical border-critical/30',
      warning: 'bg-muted text-caution border-caution/30',
      info: 'bg-muted text-accent border-accent/30'
    };
    return colors[severity as keyof typeof colors] || '';
  };

  const summary = summaryQuery.data;
  // Shares the cache entry with <ValidationIssues />, so this is the same fetch, not a
  // second one — and by construction the panel and the list agree.
  const { data: issueCounts } = trpc.validation.getAllIssues.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  return (
    <div className="text-foreground">

      <div className="container mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Data Validation</h1>
            <p className="text-ink-muted mt-1 text-sm">
              What's missing, fixable in place — and a deeper pass that checks whether what's
              there is actually true.
            </p>
          </div>
          <Button
            onClick={() => summaryQuery.refetch()}
            variant="outline"
            size="sm"
            className="border-border-strong text-ink-muted hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary — one panel, divided; not a grid of identical hero cards. */}
        {summary && (
          <Card className="bg-card border-border shadow-none p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:divide-x md:divide-border">
              <div className="md:pr-6">
                <div className="text-sm text-ink-muted">Total Accounts</div>
                <div className="text-2xl tabular-nums font-semibold text-foreground mt-1">{summary.totalAccounts}</div>
              </div>
              <div className="md:px-6">
                <div className="text-sm text-ink-muted">Total Contacts</div>
                <div className="text-2xl tabular-nums font-semibold text-foreground mt-1">{summary.totalContacts}</div>
              </div>
              {/* Both figures come from getAllIssues — the same list rendered below.
                  They used to come from getValidationSummary, whose `totalIssues` is an
                  account+contact combined count; shown under "Account Issues" beside a
                  breakdown reading "0 missing domains, 0 missing industries", the panel
                  contradicted itself and the list underneath it. */}
              <div className="md:px-6">
                <div className="text-sm text-ink-muted">Account Issues</div>
                <div className="text-2xl tabular-nums font-semibold text-caution mt-1">
                  {issueCounts ? issueCounts.accountIssues : '—'}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  <span className="tabular-nums text-ink-muted">{summary.accountIssues.missingDomain}</span> missing domains,{" "}
                  <span className="tabular-nums text-ink-muted">{summary.accountIssues.missingIndustry}</span> missing industries
                </div>
              </div>
              <div className="md:pl-6">
                <div className="text-sm text-ink-muted">Contact Issues</div>
                <div className="text-2xl tabular-nums font-semibold text-caution mt-1">
                  {issueCounts ? issueCounts.contactIssues : '—'}
                </div>
                <div className="text-xs text-ink-muted mt-1">
                  <span className="tabular-nums text-ink-muted">{summary.contactIssues.missingEmail}</span> missing emails,{" "}
                  <span className="tabular-nums text-ink-muted">{summary.contactIssues.missingTitle}</span> missing titles
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* What's wrong right now — free, instant, and fixable in place. Comes before
            the AI pass because it answers the same question for zero cost. */}
        <ValidationIssues />

        {/* Validation Actions */}
        <Card className="bg-card border-border shadow-none p-6">
          <h2 className="text-xl font-semibold text-foreground mb-2">Deep verification</h2>
          <p className="text-sm text-ink-muted mb-4">
            The checks above find what's <em>missing</em>. This finds what's <em>wrong</em>:
            a web search plus AI analysis, confirming company domains, employee counts,
            and whether a contact still works where the record says they do. No search API
            key is configured, so this scrapes public search results — when a scrape comes
            back empty, that record is skipped rather than reported as clean.
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
                className="border-border-strong text-foreground hover:bg-muted hover:text-foreground"
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
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Bulk Operations</h3>
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
                className="w-full border-border-strong text-foreground hover:bg-muted hover:text-foreground"
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
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${bulkProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-ink-muted mt-1">
                    Processing… This may take several minutes.
                  </p>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-ink-muted mt-3 flex flex-wrap items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-caution shrink-0" />
            Validation takes ~2 seconds per record (web search + AI). 20 accounts ≈ 40s, 30 contacts ≈ 60s.
          </p>
        </Card>

        {/* Validation Results */}
        {validationResults && (
          <Card className="bg-card border-border shadow-none p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-foreground">Validation Results</h2>
              <Badge variant="outline" className="text-sm border-border-strong text-ink-muted">
                <span className="tabular-nums">{validationResults.totalIssues}</span> issues found
              </Badge>
            </div>

            {/* Web search is a best-effort scrape with no API key behind it. When a scrape
                comes back empty, the check is skipped rather than counted as "passed" — so
                a 0-issues result with unavailable searches means "couldn't verify", not
                "verified clean", and the panel below must say which one happened. */}
            {typeof validationResults.searchChecksUnavailable === "number" &&
              validationResults.searchChecksUnavailable > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-sm border border-caution/30 bg-caution-subtle p-3 text-sm text-foreground">
                  <AlertTriangle className="h-4 w-4 text-caution shrink-0 mt-0.5" />
                  <span>
                    Web search returned no usable results for{" "}
                    <span className="tabular-nums font-medium">{validationResults.searchChecksUnavailable}</span> of{" "}
                    <span className="tabular-nums font-medium">{validationResults.searchChecksAttempted}</span> checks —
                    those records were skipped, not confirmed clean.
                  </span>
                </div>
              )}

            {validationResults.totalIssues === 0 ? (
              <div className="text-center py-8 text-ink-muted">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-positive" />
                <p className="font-medium text-foreground">No issues found</p>
                <p className="text-sm">
                  {validationResults.searchChecksUnavailable > 0
                    ? "No issues in what could be checked — some records were skipped because web search returned nothing usable (see above)."
                    : "All validated data passed verification checks."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {validationResults.allIssues.map((issue: any, index: number) => (
                  <div key={index} className="rounded-sm bg-muted border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-wrap items-start gap-3 flex-1">
                        {getSeverityIcon(issue.severity)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-medium text-foreground">{issue.entityName}</span>
                            <Badge variant="outline" className={getSeverityBadge(issue.severity)}>
                              {issue.severity}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-border-strong text-ink-muted">
                              {issue.field}
                            </Badge>
                          </div>
                          <p className="text-sm text-ink-muted mb-2">
                            {issue.issue}
                          </p>
                          <div className="bg-card rounded-sm p-2 text-xs text-ink-muted">
                            <strong className="text-foreground">Suggestion:</strong> {issue.suggestion}
                          </div>
                          {issue.searchResults && (
                            <details className="mt-2">
                              <summary className="text-xs text-ink-muted cursor-pointer hover:text-accent">
                                View search evidence (confidence:{" "}
                                <span className="tabular-nums">{Math.round(issue.confidence * 100)}%</span>)
                              </summary>
                              <div className="mt-2 p-2 bg-card rounded-sm text-xs text-ink-muted whitespace-pre-wrap">
                                {issue.searchResults}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                      {/* No "Fix" affordance here on purpose. An AI finding is a claim
                          about the world, not a known-good value to write — the editable
                          corrections live in the issue list above, where the new value is
                          something a person supplies. */}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Instructions */}
        {!validationResults && (
          <Card className="bg-card border-border shadow-none p-6">
            <h3 className="font-semibold text-foreground mb-3">How It Works</h3>
            <ul className="text-sm text-ink-muted space-y-2">
              <li>• <strong className="text-foreground">Web Search Verification:</strong> Scrapes public search results for company info, LinkedIn profiles, employee counts — no search API key is configured, so a scrape that comes back empty is skipped, not reported as passing</li>
              <li>• <strong className="text-foreground">AI Analysis:</strong> AI analyzes search results to determine if data is accurate</li>
              <li>• <strong className="text-foreground">Domain Matching:</strong> Verifies company names match their domains</li>
              <li>• <strong className="text-foreground">Employment Verification:</strong> Checks if contacts actually work at assigned companies</li>
              <li>• <strong className="text-foreground">Email Validation:</strong> Confirms email domains match company domains</li>
              <li>• <strong className="text-foreground">Employee Count Check:</strong> Validates employee counts against public data</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
