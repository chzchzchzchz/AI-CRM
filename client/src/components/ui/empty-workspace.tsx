import { Link } from "wouter";
import { Database, Upload, Plug, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * The empty state a list shows when the workspace has never had any data, as opposed to
 * a filter excluding everything.
 *
 * `DataUnavailable` covers the query FAILING. This covers the third case, and it is the
 * one a new customer actually meets. A brand-new organization — which is exactly what
 * `SIGNUP_MODE=self-serve` hands every new customer — signs in and lands on:
 *
 *     No accounts found
 *     Try adjusting your filters
 *
 * and, on the contacts page, the same sentence again. Every word is a true statement
 * about a filtered search, shown to someone who has never imported a single row. It sends
 * them to fix a filter that is not the problem, and no screen they can reach from there
 * says what the problem is. That is the first minute of a paying customer's first
 * session, and there was no path out of it.
 *
 * The distinction is a fact, not a judgement call: zero rows in the workspace and zero
 * rows matching the current filter are different answers to different questions. The
 * caller decides which one is true by looking at the UNFILTERED result.
 *
 * So this says the true thing and then points at the three real ways data gets in. It is
 * deliberately not a "getting started" tour — a new customer needs one working route to
 * their own data, not a tutorial about a product they cannot see yet.
 */
export function EmptyWorkspace({
  what,
  icon: Icon = Database,
}: {
  /** What the workspace has none of, as a plural noun: "accounts", "contacts". */
  what: string;
  icon?: typeof Database;
}) {
  return (
    <Card>
      <CardContent className="py-14 text-center">
        <Icon className="mx-auto mb-4 h-14 w-14 text-muted-foreground/40" />
        <h3 className="mb-1 text-xl font-semibold">No {what} yet</h3>
        <p className="mx-auto max-w-md text-sm text-ink-muted">
          This workspace is empty — nothing has been imported or synced into it. That's
          expected on a new workspace, and it isn't a filter you need to change.
        </p>

        {/* Only routes that actually put accounts in THIS workspace.
            /csv-processor was the obvious-looking third option and belongs nowhere near
            here: it builds a file to import into Salesforce or HubSpot and writes nothing
            back, so a customer would have mapped every column, downloaded a file, and
            returned to the same empty page — this component's own defect, reintroduced by
            the component meant to fix it. */}
        <div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
          <Route
            to="/import"
            icon={<Upload className="h-4 w-4" />}
            title="Import your accounts"
            detail="Paste rows or drop a CSV — nothing to set up"
          />
          <Route
            to="/integrations"
            icon={<Plug className="h-4 w-4" />}
            title="Connect a tool"
            detail="Salesforce, 6sense, Gong and the rest"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Route({
  to,
  icon,
  title,
  detail,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={to}
      className="group rounded-md border border-border/60 bg-card p-3 text-left transition-colors hover:border-accent/50"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-accent">{icon}</span>
        {title}
        <ArrowRight className="ml-auto h-3.5 w-3.5 text-ink-faint transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-1 text-xs text-ink-muted">{detail}</p>
    </Link>
  );
}
