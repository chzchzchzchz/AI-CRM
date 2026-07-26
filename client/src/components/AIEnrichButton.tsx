import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";

interface AIEnrichButtonProps {
  accountId: number;
  onEnriched?: () => void;
}

export function AIEnrichButton({ accountId, onEnriched }: AIEnrichButtonProps) {
  const [open, setOpen] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const enrichMutation = trpc.ai.enrichAccount.useMutation();

  const handleEnrich = async () => {
    setOpen(true);
    const result = await enrichMutation.mutateAsync({ accountId });
    setInsights(result);
    onEnriched?.();
  };

  return (
    <>
      <Button
        onClick={handleEnrich}
        disabled={enrichMutation.isPending}
        className="bg-accent"
      >
        {enrichMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing...</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-2" /> AI Enrich</>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              AI Account Intelligence
            </DialogTitle>
          </DialogHeader>

          {insights && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-ink-muted mb-2">Executive Summary</h3>
                <p className="text-foreground">{insights.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-sm border border-border-strong">
                  <p className="text-sm text-ink-muted mb-1">Account Score</p>
                  <p className="text-2xl font-semibold text-accent">{insights.score}/100</p>
                </div>
                <div className="p-4 bg-muted rounded-sm border border-border-strong">
                  <p className="text-sm text-ink-muted mb-1">Confidence</p>
                  <p className="text-2xl font-semibold text-accent">{insights.confidence}%</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink-muted mb-2">Key Insights</h3>
                <ul className="space-y-2">
                  {insights.insights.map((insight: string, i: number) => (
                    <li key={i} className="flex flex-wrap items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      <span className="text-ink-muted">{insight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink-muted mb-2">Recommended Actions</h3>
                <ul className="space-y-2">
                  {insights.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="flex flex-wrap items-start gap-2">
                      <span className="text-accent mt-1">→</span>
                      <span className="text-ink-muted">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
