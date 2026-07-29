import { useState } from"react";
import { toast } from"sonner";
import { trpc } from"@/lib/trpc";
import { Card, CardContent } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { BrainCircuit, Plus, CalendarDays } from"lucide-react";
import { format } from"date-fns";

const STAGES = ["Discovery","Validation","Proposal","Negotiation","Closed Won","Closed Lost"];

// Status is color-coded, so it always carries a glyph + word (never color alone).
function statusMeta(status: string) {
  switch ((status ||"").toLowerCase()) {
    case"won":
    case"closed won":
      return { glyph:"✓", label:"Won", cls:"text-positive" };
    case"lost":
    case"closed lost":
      return { glyph:"✕", label:"Lost", cls:"text-critical" };
    default:
      return { glyph:"●", label:"Open", cls:"text-ink-muted" };
  }
}

const usd0 = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const usdCompact = new Intl.NumberFormat("en-US", {
  notation:"compact",
  style:"currency",
  currency:"USD",
  maximumFractionDigits: 1,
});

/** How many cards a stage draws before it offers the rest. */
const CARDS_PER_STAGE = 12;

export default function Opportunities() {
  const utils = trpc.useUtils();
  /**
   * Stages that have been expanded past the default.
   *
   * Every stage drawing its full set put 8,856 DOM nodes on this page — three times
   * the next-heaviest route — for cards that are behind a scroll boundary and mostly
   * unread. A rep works the top of a stage, not all 34 of it.
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data: opportunities, isLoading } = trpc.opportunities.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const aiScoreMutation = trpc.opportunities.aiScore.useMutation({
    onSuccess: () => { utils.opportunities.list.invalidate(); },
    onError: (e) => toast.error(e.message ||"Failed to score opportunity"),
  });
  const upsertMutation = trpc.opportunities.upsert.useMutation({
    onSuccess: () => { utils.opportunities.list.invalidate(); toast.success("Opportunity created"); },
    onError: (e) => toast.error(e.message ||"Failed to create opportunity"),
  });

  // Minimal real create flow — the button previously had no handler at all.
  const handleNewOpportunity = () => {
    const name = window.prompt("Opportunity name?");
    if (!name?.trim()) return;
    const accountName = window.prompt(`Account name? (e.g. ${accounts?.[0]?.name ||"Acme"})`);
    const account = (accounts || []).find(
      (a: any) => a.name?.toLowerCase() === (accountName ||"").trim().toLowerCase()
    );
    if (!account) { toast.error(`No account named"${accountName}"`); return; }
    const amountStr = window.prompt("Amount (USD)?","0");
    const amount = Number((amountStr ||"0").replace(/[^0-9.]/g,"")) || 0;
    upsertMutation.mutate({
      name: name.trim(), accountId: account.id, amount, stage:"Discovery", status:"Open", probability: 10,
    } as any);
  };

  if (isLoading) return <div className="p-8 text-ink-muted">Loading Pipeline…</div>;

  const allOpps = opportunities || [];
  const openOpps = allOpps.filter(
    (o: any) => !String(o.stage ||"").toLowerCase().startsWith("closed")
  );
  const openValue = openOpps.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);

  return (
    <div className="text-foreground">

      <main className="container mx-auto py-8 px-4">
        <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Active Pipeline
            </h1>
            <p className="text-ink-muted mt-1 text-sm">
              AI-scored deals, grounded in stated win probability.{""}
              <span className="text-ink-muted">
                <span className="tabular-nums text-foreground">{usd0(openValue)}</span> across{""}
                <span className="tabular-nums text-foreground">{openOpps.length}</span> open{""}
                {openOpps.length === 1 ?"deal" :"deals"}.
              </span>
            </p>
          </div>
          <Button
            onClick={handleNewOpportunity}
            disabled={upsertMutation.isPending}
            className="font-semibold gap-2"
          >
            <Plus className="h-4 w-4" /> New Opportunity
          </Button>
        </div>

        <div className="flex flex-wrap gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const inStage = allOpps.filter((o: any) => o.stage === stage);
            const showAll = !!expanded[stage];
            const visible = showAll ? inStage : inStage.slice(0, CARDS_PER_STAGE);
            const hidden = inStage.length - visible.length;
            const stageValue = inStage.reduce((s: number, o: any) => s + (Number(o.amount) || 0), 0);
            const isWon = stage ==="Closed Won";
            const isLost = stage ==="Closed Lost";

            return (
              <div key={stage} className="w-[280px] shrink-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3 pb-2 border-b border-border px-1">
                  <h3 className="text-sm font-semibold flex flex-wrap items-center gap-2 min-w-0">
                    <span className="truncate text-foreground">{stage}</span>
                    <span className="tabular-nums text-xs text-ink-muted shrink-0">{inStage.length}</span>
                  </h3>
                  {stageValue > 0 && (
                    <span
                      className={`tabular-nums text-xs shrink-0 ${ isWon ?"text-positive" : isLost ?"text-ink-muted" :"text-ink-muted" }`}
                    >
                      {usdCompact.format(stageValue)}
                    </span>
                  )}
                </div>

                {/* Each column scrolls itself rather than stretching the page.
                    Every stage rendered its full set, so the board was as tall as its
                    busiest column — 15,624px on the seeded data. A board you scroll for
                    fifteen screens isn't a board; you lose the other columns the moment
                    you start moving. Capped so the whole pipeline stays comparable at a
                    glance, with the deep columns reachable inside their own lane. */}
                <div className="scroll-fade max-h-[calc(100vh-22rem)] space-y-3 overflow-y-auto pr-1">
                  {inStage.length === 0 && (
                    <p className="text-xs text-ink-muted border border-dashed border-border rounded-sm px-3 py-6 text-center">
                      No deals
                    </p>
                  )}

                  {visible.map((opp: any) => {
                    const st = statusMeta(opp.status);
                    const hasScore = opp.aiSuccessScore != null && opp.aiSuccessScore !=="";
                    const score = hasScore ? Number(opp.aiSuccessScore) : null;
                    const probRaw = Number(opp.probability);
                    const prob = Number.isFinite(probRaw) ? probRaw : null;
                    const isScoring = aiScoreMutation.isPending && aiScoreMutation.variables?.id === opp.id;

                    return (
                      <Card
                        key={opp.id}
                        className="bg-card border-border gap-0 py-0 rounded-sm shadow-none"
                      >
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${st.cls}`}>
                              <span aria-hidden="true">{st.glyph}</span>
                              {st.label}
                            </span>
                            <span className="tabular-nums text-sm text-foreground shrink-0">
                              {usd0(Number(opp.amount) || 0)}
                            </span>
                          </div>

                          <h4 className="text-sm font-semibold text-foreground leading-snug mb-2">
                            {opp.name}
                          </h4>

                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted mb-3">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              {opp.expectedCloseDate
                                ? `Close ${format(new Date(opp.expectedCloseDate),"MMM d, yyyy")}`
                                :"Close date TBD"}
                            </span>
                          </div>

                          {/* Two distinct, labeled figures: CRM's stated probability vs the AI's success score. */}
                          <div className="flex flex-wrap items-center gap-5 pt-3 border-t border-border">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-2xs text-ink-muted">CRM prob</span>
                              <span className="tabular-nums text-sm text-foreground">
                                {prob != null ? `${prob}%` :"—"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-2xs text-accent inline-flex items-center gap-1">
                                <BrainCircuit className="h-3 w-3" /> AI score
                              </span>
                              <span className="tabular-nums text-sm text-accent">
                                {score != null ? `${score}%` :"not scored"}
                              </span>
                            </div>
                          </div>

                          {score != null && (
                            <div className="mt-2 h-1 w-full rounded-sm bg-muted overflow-hidden">
                              <div
                                className="h-full bg-accent motion-safe:transition-all motion-safe:duration-700"
                                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                              />
                            </div>
                          )}

                          {opp.aiInsights && (
                            <p className="mt-2 text-xs text-ink-muted leading-relaxed line-clamp-2">
                              {opp.aiInsights}
                            </p>
                          )}

                          <div className="mt-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => aiScoreMutation.mutate({ id: opp.id })}
                              disabled={isScoring}
                              className="h-7 px-2 text-xs text-accent hover:text-accent hover:bg-muted"
                            >
                              <BrainCircuit className="h-3.5 w-3.5" />
                              {isScoring ?"Scoring…" : hasScore ?"Re-score" :"Score with AI"}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Never truncate silently — a capped column that says nothing
                      reads as "that's the whole stage". */}
                  {hidden > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setExpanded(e => ({ ...e, [stage]: true }))}
                    >
                      Show <span className="tabular-nums mx-1">{hidden}</span> more
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
