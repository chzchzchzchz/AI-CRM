/**
 * Hot Leads Widget
 * Shows top contacts at high-intent accounts for immediate outreach
 */

import { trpc } from "@/lib/trpc";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
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
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Hot leads</CardTitle>
        <CardDescription>Top contacts at high-intent accounts</CardDescription>
        {summary && (
          <CardAction>
            <div className="text-right">
              <div data-numeric className="text-lg leading-none font-semibold">
                {summary.total.contacts}
              </div>
              <div className="text-2xs text-ink-faint">contacts</div>
            </div>
          </CardAction>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Priority split. Dots carry the tone; a row of filled pills competed
            with the list underneath. */}
        {summary && !compact && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border-subtle px-5 py-2.5">
            <StatusDot tone="critical" className="text-ink-muted">
              <span data-numeric className="font-medium text-foreground">{summary.critical.contacts}</span> critical
            </StatusDot>
            <StatusDot tone="caution" className="text-ink-muted">
              <span data-numeric className="font-medium text-foreground">{summary.high.contacts}</span> high
            </StatusDot>
            <StatusDot tone="neutral" className="text-ink-muted">
              <span data-numeric className="font-medium text-foreground">{summary.medium.contacts}</span> medium
            </StatusDot>
          </div>
        )}

        <ul className="max-h-[560px] divide-y divide-border-subtle overflow-y-auto">
          {hotLeads?.map((lead, index) => (
            <li
              key={lead.contactId}
              className="group flex items-start gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
            >
              <span
                data-numeric
                className="w-4 shrink-0 pt-0.5 text-2xs tabular-nums text-ink-faint"
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/contacts/${lead.contactId}`}
                    className="truncate text-sm font-medium hover:text-accent"
                  >
                    {lead.contactName}
                  </Link>
                  {lead.linkedinUrl && (
                    <a
                      href={lead.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-faint hover:text-accent"
                      onClick={e => e.stopPropagation()}
                      aria-label={`${lead.contactName} on LinkedIn`}
                    >
                      <Linkedin className="size-3.5" />
                    </a>
                  )}
                </div>

                {lead.contactTitle && (
                  <p className="truncate text-xs text-ink-muted">{lead.contactTitle}</p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-muted">
                  <Link
                    href={`/accounts/${lead.accountId}`}
                    className="truncate hover:text-accent"
                  >
                    {lead.accountName}
                  </Link>
                  <span className="text-ink-faint">·</span>
                  <span data-numeric className="tabular-nums">
                    intent {lead.intentScore}
                  </span>
                  {lead.buyingStage && (
                    <Badge variant="secondary" size="sm">{lead.buyingStage}</Badge>
                  )}
                </div>

                {lead.priorityReason && (
                  <p className="mt-1 text-2xs text-ink-faint">{lead.priorityReason}</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {/* Contact actions surface on hover but stay reachable by keyboard. */}
                <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  {lead.contactEmail && (
                    <Button asChild variant="ghost" size="icon-sm">
                      <a href={`mailto:${lead.contactEmail}`} onClick={e => e.stopPropagation()} aria-label="Email">
                        <Mail className="size-3.5" />
                      </a>
                    </Button>
                  )}
                  {lead.contactPhone && (
                    <Button asChild variant="ghost" size="icon-sm">
                      <a href={`tel:${lead.contactPhone}`} onClick={e => e.stopPropagation()} aria-label="Call">
                        <Phone className="size-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
                <div className="w-8 text-right">
                  <div data-numeric className="text-sm font-semibold tabular-nums">
                    {lead.priorityScore}
                  </div>
                  <div className="text-2xs text-ink-faint">pri</div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {!compact && (
          <div className="border-t border-border-subtle p-2">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/accounts?filter=hot">
                View all hot accounts
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
