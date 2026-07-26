import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
  const { data: opportunities, isLoading } = trpc.opportunities.list.useQuery();
  const aiScoreMutation = trpc.opportunities.aiScore.useMutation({
    onSuccess: () => {
      // Invalidate and refetch
    }
  });

  if (isLoading) return <div className="p-8">Loading Pipeline...</div>;

  return (
    <div className="text-foreground">
      
      <main className="container mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-xl font-semibold bg-accent bg-clip-text text-transparent">
              Active Pipeline
            </h1>
            <p className="text-ink-muted mt-1">AI-driven deal scoring and revenue intelligence.</p>
          </div>
          <Button className="bg-accent hover:bg-accent gap-2">
            <Plus className="h-4 w-4" /> New Opportunity
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STAGES.map((stage) => (
            <div key={stage} className="min-w-[280px]">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-semibold text-ink-muted flex items-center gap-2">
                  {stage}
                  <Badge variant="outline" className="bg-card border-border text-ink-muted">
                    {opportunities?.filter((o: any) => o.stage === stage).length || 0}
                  </Badge>
                </h3>
              </div>
              
              <div className="space-y-4">
                {opportunities?.filter((o: any) => o.stage === stage).map((opp: any) => (
                  <Card key={opp.id} className="bg-card border-border hover:border-accent/30 transition-all cursor-pointer group">
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant="outline" className="text-[10px] uppercase border-border-strong text-ink-muted">
                          {opp.status}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-ink-subtle">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                      <CardTitle className="text-sm font-bold group-hover:text-accent transition-colors">
                        {opp.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="flex items-center gap-2 text-xs text-ink-muted mb-3">
                        <DollarSign className="h-3 w-3 text-positive" />
                        <span className="font-mono text-positive">
                          ${Number(opp.amount).toLocaleString()}
                        </span>
                        <span className="mx-1">•</span>
                        <Calendar className="h-3 w-3" />
                        <span>{opp.expectedCloseDate ? format(new Date(opp.expectedCloseDate), "MMM d") : "TBD"}</span>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-accent uppercase tracking-wider">
                            <BrainCircuit className="h-3 w-3" /> AI Success Score
                          </div>
                          <span className={`text-xs font-bold ${ (opp.aiSuccessScore || 0) > 80 ? "text-positive" : (opp.aiSuccessScore || 0) > 60 ? "text-accent" : "text-caution" }`}>
                            {opp.aiSuccessScore || "--"}%
                          </span>
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-1000 ${ (opp.aiSuccessScore || 0) > 80 ? "bg-positive" : (opp.aiSuccessScore || 0) > 60 ? "bg-accent" : "bg-caution" }`}
                            style={{ width: `${opp.aiSuccessScore || 0}%` }}
                          />
                        </div>
                        {opp.aiInsights && (
                          <p className="text-[10px] text-ink-subtle mt-2 line-clamp-2 italic">
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
