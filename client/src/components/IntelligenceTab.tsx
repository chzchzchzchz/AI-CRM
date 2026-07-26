import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { 
  Sparkles, RefreshCw, Clock, Target, TrendingUp, 
  Shield, Zap, ChevronDown, ChevronUp, Database,
  AlertTriangle, Building2, Layers
} from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { TechStackDisplay } from "./TechStackDisplay";

interface IntelligenceTabProps {
  accountId: number;
  account: any;
}

export function IntelligenceTab({ accountId, account }: IntelligenceTabProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sixsense: true,
    summary: true,
    research: false,
    strategy: false
  });

  // Fetch all AI data
  const overviewQuery = trpc.ai.compileOverview.useQuery({ accountId });
  const researchQuery = trpc.ai.compileResearch.useQuery({ accountId });
  const insightsQuery = trpc.ai.generateStrategicInsights.useQuery({ accountId, forceRefresh: false });

  // Parse 6sense data from rawData
  let rawData: Record<string, any> = {};
  try {
    if (account.rawData) {
      rawData = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
    }
  } catch (e) {
    console.error('Failed to parse rawData:', e);
  }
  
  // Infer buying stage from intent score if not set
  const intentScore = account.intentScore || 0;
  const inferredBuyingStage = 
    intentScore >= 86 ? 'Purchase' :
    intentScore >= 70 ? 'Decision' :
    intentScore >= 50 ? 'Consideration' :
    intentScore >= 20 ? 'Awareness' :
    'Target';
  
  const sixsenseData = {
    buyingStage: account.sixsenseBuyingStage || rawData['Buying Stage'] || rawData['6sense Buying Stage'] || inferredBuyingStage,
    buyingStageSource: account.sixsenseBuyingStage ? '6sense' : (rawData['Buying Stage'] || rawData['6sense Buying Stage']) ? 'rawData' : 'inferred',
    profileFit: account.sixsenseProfileFit || rawData['Profile Fit'] || rawData['6sense Profile Fit'] || 'Unknown',
    segments: account.sixsenseSegments,
    mfaSolution: rawData['MFA Solution'],
    ssoProvider: rawData['SSO Provider'],
    securityIncidents: rawData['Recent Security Incidents'] || rawData['Security Incidents & Breaches'],
    complianceStatus: rawData['Compliance Status'],
    competitorIntent: rawData['Competitor MFA Intent'],
    cybersecurityInsights: rawData['Company Cybersecurity Insights'],
    securityJobOpenings: rawData['Security & IT Job Openings'],
    abmBrief: rawData['ABM Intelligence Brief'],
    zeroTrust: rawData['Zero Trust'],
    keywords: rawData['Keywords'] || rawData['Intent Keywords'],
  };

  // Parse tech stack
  let techStack: string[] | null = null;
  let securityStack: string[] | null = null;
  
  try {
    if (account.techStack) {
      techStack = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
    }
  } catch (e) {}
  
  try {
    if (account.securityStack) {
      securityStack = typeof account.securityStack === 'string' ? JSON.parse(account.securityStack) : account.securityStack;
    }
  } catch (e) {}

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const SectionHeader = ({ 
    id, 
    icon: Icon, 
    title, 
    subtitle, 
    color,
    isLoading,
    cached,
    cacheAge,
    onRefresh
  }: { 
    id: string;
    icon: any; 
    title: string; 
    subtitle: string;
    color: string;
    isLoading?: boolean;
    cached?: boolean;
    cacheAge?: number;
    onRefresh?: () => void;
  }) => (
    <CollapsibleTrigger asChild>
      <div className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-6 px-6 py-2 rounded-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-sm ${color}`}>
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cached && cacheAge && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {cacheAge}m ago
            </Badge>
          )}
          {onRefresh && (
            <Button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              variant="ghost"
              size="sm"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {expandedSections[id] ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </div>
    </CollapsibleTrigger>
  );

  return (
    <div className="space-y-4">
      {/* 6sense Intelligence Section - Always visible at top */}
      <Card>
        <Collapsible open={expandedSections.sixsense} onOpenChange={() => toggleSection('sixsense')}>
          <CardHeader className="pb-2">
            <SectionHeader
              id="sixsense"
              icon={Database}
              title="6sense Intelligence"
              subtitle="Intent signals, buying stage, and competitive intelligence"
              color="bg-caution"
            />
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Key Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-sm bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Intent Score</div>
                  <div className="text-2xl font-bold text-primary">{account.intentScore || 'N/A'}</div>
                </div>
                <div className="p-4 rounded-sm bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Buying Stage</div>
                  <div className="text-xl font-semibold">{sixsenseData.buyingStage}</div>
                  {sixsenseData.buyingStageSource === 'inferred' && (
                    <div className="text-xs text-muted-foreground">Inferred from intent</div>
                  )}
                </div>
                <div className="p-4 rounded-sm bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Profile Fit</div>
                  <div className="text-xl font-semibold">{sixsenseData.profileFit}</div>
                </div>
                <div className="p-4 rounded-sm bg-muted/50">
                  <div className="text-sm text-muted-foreground mb-1">Relationship</div>
                  <div className="text-xl font-semibold">{account.relationship || 'Prospect'}</div>
                </div>
              </div>

              {/* Security Intelligence */}
              {(sixsenseData.mfaSolution || sixsenseData.ssoProvider || sixsenseData.complianceStatus) && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-accent" />
                    Security Stack Intelligence
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {sixsenseData.mfaSolution && (
                      <div className="p-3 rounded-sm border bg-card">
                        <div className="text-xs text-muted-foreground mb-1">MFA Solution</div>
                        <div className="font-medium">{sixsenseData.mfaSolution}</div>
                      </div>
                    )}
                    {sixsenseData.ssoProvider && (
                      <div className="p-3 rounded-sm border bg-card">
                        <div className="text-xs text-muted-foreground mb-1">SSO Provider</div>
                        <div className="font-medium">{sixsenseData.ssoProvider}</div>
                      </div>
                    )}
                    {sixsenseData.complianceStatus && (
                      <div className="p-3 rounded-sm border bg-card">
                        <div className="text-xs text-muted-foreground mb-1">Compliance</div>
                        <div className="font-medium">{sixsenseData.complianceStatus}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Competitor Intent */}
              {sixsenseData.competitorIntent && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-caution" />
                    Competitor MFA Intent
                  </h4>
                  <div className="p-3 rounded-sm border bg-caution-subtle border-caution/30">
                    <p className="text-sm">{sixsenseData.competitorIntent}</p>
                  </div>
                </div>
              )}

              {/* Security Incidents */}
              {sixsenseData.securityIncidents && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-critical" />
                    Recent Security Incidents
                  </h4>
                  <div className="p-3 rounded-sm border bg-critical-subtle border-critical/30">
                    {(() => {
                      // Try to parse JSON if it's a JSON string
                      let incidents = sixsenseData.securityIncidents;
                      try {
                        if (typeof incidents === 'string' && incidents.startsWith('{')) {
                          const parsed = JSON.parse(incidents);
                          if (parsed.description) {
                            return <p className="text-sm">{parsed.description}</p>;
                          }
                        }
                      } catch (e) {}
                      // Fallback to raw string
                      return <p className="text-sm">{String(incidents)}</p>;
                    })()}
                  </div>
                </div>
              )}

              {/* Cybersecurity Insights */}
              {sixsenseData.cybersecurityInsights && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-accent" />
                    Cybersecurity Insights
                  </h4>
                  <div className="p-3 rounded-sm border bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">{sixsenseData.cybersecurityInsights}</p>
                  </div>
                </div>
              )}

              {/* ABM Brief */}
              {sixsenseData.abmBrief && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-accent" />
                    ABM Intelligence Brief
                  </h4>
                  <div className="p-3 rounded-sm border bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">{sixsenseData.abmBrief}</p>
                  </div>
                </div>
              )}

              {/* Keywords */}
              {sixsenseData.keywords && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-caution" />
                    Intent Keywords
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {(typeof sixsenseData.keywords === 'string' 
                      ? sixsenseData.keywords.split(',') 
                      : sixsenseData.keywords
                    )?.map((keyword: string, i: number) => (
                      <Badge key={i} variant="secondary">{keyword.trim()}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* AI Executive Summary */}
      <Card>
        <Collapsible open={expandedSections.summary} onOpenChange={() => toggleSection('summary')}>
          <CardHeader className="pb-2">
            <SectionHeader
              id="summary"
              icon={Sparkles}
              title="Executive Summary"
              subtitle="AI-powered strategic analysis and opportunities"
              color="bg-accent from-primary "
              isLoading={overviewQuery.isLoading}
              cached={overviewQuery.data?.cached}
              cacheAge={overviewQuery.data?.cacheAge}
              onRefresh={() => overviewQuery.refetch()}
            />
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {overviewQuery.isLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating AI analysis...
                  </div>
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
                </div>
              ) : overviewQuery.isError ? (
                <div className="text-critical flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Failed to load summary. <Button variant="link" className="p-0 h-auto" onClick={() => overviewQuery.refetch()}>Retry</Button>
                </div>
              ) : overviewQuery.data?.summary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <SafeStreamdown>{overviewQuery.data.summary}</SafeStreamdown>
                </div>
              ) : (
                <p className="text-muted-foreground">No summary available. Click refresh to generate.</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Company Description & Tech Stack */}
      {(account.description || techStack || securityStack) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Description
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {account.description && (
              <p className="text-muted-foreground leading-relaxed">{account.description}</p>
            )}
            <TechStackDisplay techStack={techStack} securityStack={securityStack} />
          </CardContent>
        </Card>
      )}

      {/* Research Synthesis - Collapsed by default */}
      <Card>
        <Collapsible open={expandedSections.research} onOpenChange={() => toggleSection('research')}>
          <CardHeader className="pb-2">
            <SectionHeader
              id="research"
              icon={TrendingUp}
              title="Market Research"
              subtitle="Competitive intelligence, trigger events, and market insights"
              color="bg-accent"
              isLoading={researchQuery.isLoading}
              cached={researchQuery.data?.cached}
              cacheAge={researchQuery.data?.cacheAge}
              onRefresh={() => researchQuery.refetch()}
            />
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {researchQuery.isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
                </div>
              ) : researchQuery.data ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <SafeStreamdown>{researchQuery.data.research}</SafeStreamdown>
                </div>
              ) : (
                <p className="text-muted-foreground">No research available</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Strategic Recommendations - Collapsed by default */}
      <Card>
        <Collapsible open={expandedSections.strategy} onOpenChange={() => toggleSection('strategy')}>
          <CardHeader className="pb-2">
            <SectionHeader
              id="strategy"
              icon={Target}
              title="Strategic Recommendations"
              subtitle="AI-powered buying signals and next best actions"
              color="bg-accent"
              isLoading={insightsQuery.isLoading || insightsQuery.isFetching}
              cached={insightsQuery.data?.cached}
              cacheAge={insightsQuery.data?.cacheAge}
              onRefresh={() => insightsQuery.refetch()}
            />
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {insightsQuery.isLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
                </div>
              ) : insightsQuery.data ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <SafeStreamdown>{(insightsQuery.data as any).insights || insightsQuery.data.recommendations}</SafeStreamdown>
                </div>
              ) : (
                <p className="text-muted-foreground">No insights available</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
