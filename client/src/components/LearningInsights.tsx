import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Brain, ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * What the system has actually learned, rather than a list of things it says it learns.
 *
 * This card previously asserted four capabilities — "your field naming preferences",
 * "custom validation rules", "industry-specific formatting", "data quality standards" —
 * as static bullet points, while `tools.getLearningInsights` sat unrouted and no
 * feedback was ever recorded. Four claims, none of them checkable, none of them true.
 *
 * It now reads the real record. With no feedback yet it says so plainly, which is a
 * more useful thing to show a new user than four promises.
 */
export function LearningInsights({ contentType = "content_generated" }: { contentType?: string }) {
  const { data, isLoading } = trpc.tools.getLearningInsights.useQuery(
    { contentType },
    { refetchOnWindowFocus: false }
  );

  const patterns = data?.patterns ?? [];
  const improvements = data?.improvements ?? [];
  const nothingYet = !patterns.length && !improvements.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          Learning from you
        </CardTitle>
        <CardDescription>
          Drawn from the feedback you give on generated content.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : nothingYet ? (
          <p className="text-sm text-ink-muted">
            Nothing recorded yet. Rate a generated draft — or save an edited version of one
            — and what worked starts shaping the next.
          </p>
        ) : (
          <>
            {!!patterns.length && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
                  <ThumbsUp className="size-3 text-positive" />
                  Kept doing
                </p>
                <ul className="space-y-1">
                  {patterns.slice(0, 3).map((p, i) => (
                    <li key={i} className="line-clamp-2 text-xs text-ink-muted">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!!improvements.length && (
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-ink-muted">
                  <ThumbsDown className="size-3 text-caution" />
                  Corrected
                </p>
                <ul className="space-y-1">
                  {improvements.slice(0, 3).map((p, i) => (
                    <li key={i} className="line-clamp-2 text-xs text-ink-muted">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
