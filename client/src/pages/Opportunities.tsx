import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Plus, CalendarDays } from "lucide-react";
import { format } from "date-fns";

const STAGES = ["Discovery", "Validation", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];

// Status is color-coded, so it always carries a glyph + word (never color alone).
function statusMeta(status: string) {
  switch ((status || "").toLowerCase()) {
    case "won":
    case "closed won":
      return { glyph: "✓", label: "Won", cls: "text-emerald-400" };
    case "lost":
    case "closed lost":
      return { glyph: "✕", label: "Lost", cls: "text-red-400" };
    default:
      return { glyph: "●", label: "Open", cls: "text-slate-300" };
  }
}

const usd0 = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const usdCompact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 1,
});

export default function Opportunities() {
  const utils = trpc.useUtils();
  const { data: opportunities, isLoading } = trpc.opportunities.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const aiScoreMutation = trpc.opportunities.aiScore.useMutation({
    onSuccess: () => { utils.opportunities.list.invalidate(); },
    onError: (e) => toast.error(e.message || "Failed to score opportunity"),
  });
  const upsertMutation = trpc.opportunities.upsert.useMutation({
    onSuccess: () => { utils.opportunities.list.invalidate(); toast.success("Opportunity created"); },
    onError: (e) => toast.error(e.message || "Failed to create opportunity"),
  });

  // Minimal real create flow — the button previously had no handler at all.
  const handleNewOpportunity = () => {
    const name = window.prompt("Opportunity name?");
    if (!name?.trim()) return;
    const accountName = window.prompt(`Account name? (e.g. ${accounts?.[0]?.name || "Acme"})`);
    const account = (accounts || []).find(
      (a: any) => a.name?.toLowerCase() === (accountName || "").trim().toLowerCase()
    );
    if (!account) { toast.error(`No account named "${accountName}"`); return; }
    const amountStr = window.prompt("Amount (USD)?", "0");
    const amount = Number((amountStr || "0").replace(/[^0-9.]/g, "")) || 0;
    upsertMutation.mutate({
      name: name.trim(), accountId: account.id, amount, stage: "Discovery", status: "Open", probability: 10,
    } as any);
  };

  if (isLoading) return <div className="p-8 text-slate-300">Loading Pipeline…</div>;

  const allOpps = opportunities || [];
  const openOpps = allOpps.filter(
    (o: any) => !String(o.stage || "").toLowerCase().startsWith("closed")
  );
  const openValue = openOpps.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Navigation />

      <main className="container mx-auto py-8 px-4">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-50">
              Active Pipeline
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              AI-scored deals, grounded in stated win probability.{" "}
              <span className="text-slate-300">
                <span className="font-mono text-slate-100">{usd0(openValue)}</span> across{" "}
                <span className="font-mono text-slate-100">{openOpps.length}</span> open{" "}
                {openOpps.length === 1 ? "deal" : "deals"}.
              </span>
            </p>
          </div>
          <Button
            onClick={handleNewOpportunity}
            disabled={upsertMutation.isPending}
            className="bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold gap-2"
          >
            <Plus className="h-4 w-4" /> New Opportunity
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const inStage = allOpps.filter((o: any) => o.stage === stage);
            const stageValue = inStage.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);
            const isWon = stage === "Closed Won";
            const isLost = stage === "Closed Lost";

            return (
              <div key={stage} className="min-w-[280px]">
                <div className="flex items-baseline justify-between gap-2 mb-3 pb-2 border-b border-slate-800 px-1">
                  <h3 className="text-sm font-semibold flex items-center gap-2 min-w-0">
                    <span className="truncate text-slate-200">{stage}</span>
                    <span className="font-mono text-xs text-slate-400 shrink-0">{inStage.length}</span>
                  </h3>
                  {stageValue > 0 && (
                    <span
                      className={`font-mono text-xs shrink-0 ${
                        isWon ? "text-emerald-400" : isLost ? "text-slate-400" : "text-slate-300"
                      }`}
                    >
                      {usdCompact.format(stageValue)}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {inStage.length === 0 && (
                    <p className="text-xs text-slate-400 border border-dashed border-slate-800 rounded-lg px-3 py-6 text-center">
                      No deals
                    </p>
                  )}

                  {inStage.map((opp: any) => {
                    const st = statusMeta(opp.status);
                    const hasScore = opp.aiSuccessScore != null && opp.aiSuccessScore !== "";
                    const score = hasScore ? Number(opp.aiSuccessScore) : null;
                    const probRaw = Number(opp.probability);
                    const prob = Number.isFinite(probRaw) ? probRaw : null;
                    const isScoring = aiScoreMutation.isPending && aiScoreMutation.variables?.id === opp.id;

                    return (
                      <Card
                        key={opp.id}
                        className="bg-slate-900 border-slate-800 gap-0 py-0 rounded-lg shadow-none"
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.cls}`}>
                              <span aria-hidden="true">{st.glyph}</span>
                              {st.label}
                            </span>
                            <span className="font-mono text-sm text-slate-100 shrink-0">
                              {usd0(Number(opp.amount) || 0)}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-slate-50 leading-snug mb-2">
                            {opp.name}
                          </h4>

                          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {opp.expectedCloseDate
                                ? `Close ${format(new Date(opp.expectedCloseDate), "MMM d, yyyy")}`
                                : "Close date TBD"}
                            </span>
                          </div>

                          {/* Two distinct, labeled figures: CRM's stated probability vs the AI's success score. */}
                          <div className="flex items-center gap-5 pt-3 border-t border-slate-800">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] text-slate-400">CRM prob</span>
                              <span className="font-mono text-sm text-slate-100">
                                {prob != null ? `${prob}%` : "—"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[11px] text-cyan-400 inline-flex items-center gap-1">
                                <BrainCircuit className="h-3 w-3" /> AI score
                              </span>
                              <span className="font-mono text-sm text-cyan-400">
                                {score != null ? `${score}%` : "not scored"}
                              </span>
                            </div>
                          </div>

                          {score != null && (
                            <div className="mt-2 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 motion-safe:transition-all motion-safe:duration-700"
                                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                              />
                            </div>
                          )}

                          {opp.aiInsights && (
                            <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">
                              {opp.aiInsights}
                            </p>
                          )}

                          <div className="mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => aiScoreMutation.mutate({ id: opp.id })}
                              disabled={isScoring}
                              className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-slate-800"
                            >
                              <BrainCircuit className="h-3.5 w-3.5" />
                              {isScoring ? "Scoring…" : hasScore ? "Re-score" : "Score with AI"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
