/**
 * Hot Leads Widget
 * Shows top contacts at high-intent accounts for immediate outreach
 */

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Flame, 
  Mail, 
  Linkedin, 
  Phone, 
  Building2, 
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Zap
} from "lucide-react";
import { Link } from "wouter";

interface HotLeadsWidgetProps {
  limit?: number;
  compact?: boolean;
}

export function HotLeadsWidget({ limit = 10, compact = false }: HotLeadsWidgetProps) {
  const { data: hotLeads, isLoading } = trpc.hotLeads.getTopLeads.useQuery({ 
    limit,
    minIntentScore: 70 
  });
  const { data: summary } = trpc.hotLeads.getSummary.useQuery();

  if (isLoading) {
    return (
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-critical" />
            <CardTitle className="text-lg">Hot Leads</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(compact ? 5 : 10)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const getBuyingStageColor = (stage: string | null) => {
    switch (stage) {
      case 'Purchase': return 'bg-positive-subtle text-positive border-positive/30';
      case 'Decision': return 'bg-accent-subtle text-accent border-accent/30';
      case 'Consideration': return 'bg-caution-subtle text-caution border-caution/30';
      case 'Evaluation': return 'bg-caution-subtle text-caution border-caution/30';
      default: return 'bg-muted text-ink-muted border-border';
    }
  };

  const getIntentColor = (score: number) => {
    if (score >= 90) return 'text-critical';
    if (score >= 80) return 'text-caution';
    if (score >= 70) return 'text-caution';
    return 'text-ink-subtle';
  };

  return (
    <Card className="card-elevated">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="size-5 shrink-0 text-ink-faint" />
            <div>
              <CardTitle className="text-lg">Hot Leads</CardTitle>
              <p className="text-xs text-muted-foreground">
                Top contacts at high-intent accounts
              </p>
            </div>
          </div>
          {summary && (
            <div className="text-right text-xs">
              <div className="font-semibold text-critical">{summary.total.contacts}</div>
              <div className="text-muted-foreground">contacts</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Summary badges */}
        {summary && !compact && (
          <div className="flex flex-wrap gap-2 pb-2 border-b border-border/50">
            <Badge variant="outline" className="text-xs bg-critical-subtle text-critical border-critical/30">
              <Zap className="h-3 w-3 mr-1" />
              {summary.critical.contacts} critical
            </Badge>
            <Badge variant="outline" className="text-xs bg-caution-subtle text-caution border-caution/30">
              {summary.high.contacts} high
            </Badge>
            <Badge variant="outline" className="text-xs bg-caution-subtle text-caution border-caution/30">
              {summary.medium.contacts} medium
            </Badge>
          </div>
        )}

        {/* Hot leads list */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {hotLeads?.map((lead, index) => (
            <div 
              key={lead.contactId}
              className="group p-3 rounded-sm border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Contact info */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
                    <Link href={`/contacts/${lead.contactId}`}>
                      <span className="font-semibold text-sm hover:text-primary truncate">
                        {lead.contactName}
                      </span>
                    </Link>
                    {lead.linkedinUrl && (
                      <a 
                        href={lead.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-accent hover:text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  
                  {/* Title */}
                  {lead.contactTitle && (
                    <p className="text-xs text-muted-foreground truncate mb-1">
                      {lead.contactTitle}
                    </p>
                  )}
                  
                  {/* Account info */}
                  <div className="flex items-center gap-2 text-xs">
                    <Link href={`/accounts/${lead.accountId}`}>
                      <span className="flex items-center gap-1 text-muted-foreground hover:text-primary">
                        <Building2 className="h-3 w-3" />
                        {lead.accountName}
                      </span>
                    </Link>
                    <span className={`font-bold ${getIntentColor(lead.intentScore)}`}>
                      {lead.intentScore}
                    </span>
                    {lead.buyingStage && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getBuyingStageColor(lead.buyingStage)}`}>
                        {lead.buyingStage}
                      </Badge>
                    )}
                  </div>

                  {/* Priority reason */}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {lead.priorityReason}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {lead.contactEmail && (
                    <a 
                      href={`mailto:${lead.contactEmail}`}
                      className="p-1.5 rounded bg-primary/10 hover:bg-primary/20 text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {lead.contactPhone && (
                    <a 
                      href={`tel:${lead.contactPhone}`}
                      className="p-1.5 rounded bg-positive-subtle hover:bg-positive-subtle text-positive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* Priority score */}
                <div className="text-right">
                  <div className={`text-lg font-bold ${lead.priorityScore >= 70 ? 'text-critical' : lead.priorityScore >= 50 ? 'text-caution' : 'text-caution'}`}>
                    {lead.priorityScore}
                  </div>
                  <div className="text-[10px] text-muted-foreground">priority</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View all link */}
        {!compact && (
          <div className="pt-2 border-t border-border/50">
            <Link href="/accounts?filter=hot">
              <Button variant="ghost" className="w-full text-sm">
                View All Hot Accounts
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
