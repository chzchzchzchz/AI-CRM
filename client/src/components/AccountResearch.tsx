import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ChevronDown, Globe, Layers, Loader2, RefreshCw } from "lucide-react";

/**
 * The outside view of an account, and what its stack implies for us.
 *
 * Deliberately separate from the brief. `intel.accountBrief` reasons strictly from data
 * we hold — that constraint is what makes it trustworthy, and it is also what stops it
 * ever telling you anything you didn't already have. This is the other half: research
 * that reaches outside the CRM, kept in its own panel so the two are never confused.
 *
 * Both procedures existed and were reachable only from components nothing rendered.
 */
export function AccountResearch({ accountId }: { accountId: number }) {
  const [open, setOpen] = useState(false);

  // Deferred until asked for: this reaches an external model and, on a cache miss,
  // takes long enough that firing it on page load would slow every account view.
  const research = trpc.ai.compileResearch.useQuery(
    { accountId },
    { enabled: open && accountId > 0, refetchOnWindowFocus: false }
  );

  const stack = trpc.ai.analyzeTechStack.useMutation();

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <Globe className="size-4 text-accent" />
              Outside view
            </span>
            <span className="mt-1 block text-xs font-normal text-ink-muted">
              Research beyond your CRM. The brief above uses only data you hold; this
              doesn&apos;t.
            </span>
          </span>

          {open && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Refresh research"
              disabled={research.isFetching}
              onClick={() => research.refetch()}
            >
              <RefreshCw className={cn("size-4", research.isFetching && "animate-spin")} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4">
        {!open ? (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Globe className="mr-1.5 size-3.5" />
            Research this account
            <ChevronDown className="ml-1 size-3.5" />
          </Button>
        ) : research.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-8/12" />
          </div>
        ) : research.isError ? (
          <p className="text-xs text-ink-muted">{research.error.message}</p>
        ) : (
          <>
            {research.data?.cached && (
              <p className="mb-2 text-2xs text-ink-subtle">
                Cached <span className="tabular-nums">{research.data.cacheAge}</span>m ago
              </p>
            )}
            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-accent">
              <SafeStreamdown>
                {(research.data as { insights?: string } | null)?.insights ??
                  "No research returned."}
              </SafeStreamdown>
            </div>
          </>
        )}

        {/* Stack analysis is a second, cheaper question and gets its own trigger — asking
            it always would spend a model call on accounts with no stack on file. */}
        <div className="mt-4 border-t border-border-subtle pt-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={stack.isPending}
            onClick={() => stack.mutate({ accountId })}
          >
            {stack.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Layers className="mr-1.5 size-3.5" />
            )}
            {stack.data ? "Re-analyse stack" : "What does their stack imply?"}
          </Button>

          {stack.data && (
            <div className="mt-2 prose prose-sm dark:prose-invert max-w-none">
              <SafeStreamdown>
                {(stack.data as { raw?: string }).raw || "No technology stack data available"}
              </SafeStreamdown>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
