import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Target, 
  BrainCircuit,
  Plus,
  MoreHorizontal,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

const STAGES = ["Discovery", "Validation", "Proposal", "Negotiation", "Closed Won", "Closed Lost"];

export default function Opportunities() {
  const utils = trpc.useUtils();
  const { data: opportunities, isLoading } = trpc.opportunities.list.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const aiScoreMutation = trpc.opportunities.aiScore.useMutation({
    onSuccess: () => { utils.opportunities.list.invalidate(); }
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

  if (isLoading) return <div className="p-8">Loading Pipeline...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Navigation />
      
      <main className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Active Pipeline
            </h1>
            <p className="text-slate-400 mt-1">AI-driven deal scoring and revenue intelligence.</p>
          </div>
          <Button onClick={handleNewOpportunity} disabled={upsertMutation.isPending} className="bg-cyan-600 hover:bg-cyan-500 gap-2">
            <Plus className="h-4 w-4" /> New Opportunity
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage} className="min-w-[280px]">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                  {stage}
                  <Badge variant="outline" className="bg-slate-900 border-slate-800 text-slate-400">
                    {opportunities?.filter((o: any) => o.stage === stage).length || 0}
                  </Badge>
                </h3>
              </div>
              
              <div className="space-y-4">
                {opportunities?.filter((o: any) => o.stage === stage).map((opp: any) => (
                  <Card key={opp.id} className="bg-slate-900 border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase border-slate-700 text-slate-400">
                          {opp.status}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardTitle className="text-sm font-bold group-hover:text-cyan-400 transition-colors">
                        {opp.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                        <DollarSign className="h-3 w-3 text-emerald-500" />
                        <span className="font-mono text-emerald-400">
                          ${Number(opp.amount).toLocaleString()}
                        </span>
                        <span className="mx-1">•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{opp.expectedCloseDate ? format(new Date(opp.expectedCloseDate), "MMM d") : "TBD"}</span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-800">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                            <BrainCircuit className="h-3 w-3" /> AI Success Score
                          </div>
                          <span className={`text-xs font-bold ${
                            (opp.aiSuccessScore || 0) > 80 ? "text-emerald-400" : 
                            (opp.aiSuccessScore || 0) > 60 ? "text-cyan-400" : "text-amber-400"
                          }`}>
                            {opp.aiSuccessScore || "--"}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${
                              (opp.aiSuccessScore || 0) > 80 ? "bg-emerald-500" : 
                              (opp.aiSuccessScore || 0) > 60 ? "bg-cyan-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${opp.aiSuccessScore || 0}%` }}
                          />
                        </div>
                        {opp.aiInsights && (
                          <p className="text-[10px] text-slate-500 mt-2 line-clamp-2 italic">
                            "{opp.aiInsights}"
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
