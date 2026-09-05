import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The empty state a list shows when the query FAILED, as opposed to succeeding and
 * finding nothing.
 *
 * Every list page in this app was written as `data?.length === 0 ? <EmptyState/> : <List/>`
 * with the query destructured as `{ data, isLoading }` — the error discarded. So a backend
 * failure left `data` undefined, the list empty, and the page rendered:
 *
 *     No accounts found
 *     Try adjusting your filters
 *
 * A rep reads that as "my book of business is empty" and follows advice that cannot
 * possibly help, because there are no filters to adjust — the request never returned.
 * `DataErrorBanner` covers the case where a page's NUMBERS come from a failed query; this
 * covers the case where its ROWS do, and the difference matters: an empty list is a
 * statement about the business, and it must only be made when it is true.
 *
 * Deliberately offers a retry rather than only apologising: a transient failure is the
 * common case, and the page has no other way back.
 */
export function DataUnavailable({
  what,
  onRetry,
  detail,
}: {
  /** What could not be loaded, as a noun phrase: "accounts", "this contact's calls". */
  what: string;
  onRetry?: () => void;
  /** The underlying error, when there is something specific worth showing. */
  detail?: unknown;
}) {
  const message = detail instanceof Error ? detail.message : typeof detail === "string" ? detail : null;

  return (
    <Card>
      <CardContent className="py-16 text-center">
        <AlertTriangle className="h-16 w-16 mx-auto text-caution/60 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Couldn't load {what}</h3>
        <p className="text-ink-muted max-w-md mx-auto">
          This is a load failure, not an empty {what.replace(/^(the|this|your)\s+/i, "")} list — the
          request didn't come back, so nothing here reflects your data.
        </p>
        {message ? (
          <p className="text-ink-muted/70 text-xs mt-3 font-mono break-words max-w-md mx-auto">{message}</p>
        ) : null}
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
