import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, ExternalLink, Users, Phone, TrendingUp, MapPin, Building2, 
  Sparkles, Copy, Check, Flame, Target, Mail, Linkedin, Globe, 
  Loader2, ChevronRight, Shield, AlertTriangle, Zap, RefreshCw, BrainCircuit
} from "lucide-react";
import { Link, useParams } from "wouter";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { CompanyLogo } from "@/components/ui/company-logo";
import { toast } from "sonner";

export default function AccountDetailEnhanced() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });
  const { data: people } = trpc.people.getByAccountId.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

  // AI Intelligence queries — deferred until the account has loaded so they don't
  // join the initial request batch and block the core page render on slow LLM calls.
  const overviewQuery = trpc.ai.compileOverview.useQuery({ accountId }, { enabled: accountId > 0 && !!account });
  const insightsQuery = trpc.ai.generateStrategicInsights.useQuery(
    { accountId, forceRefresh: false },
    { enabled: accountId > 0 && !!account }
  );
  const { data: salesforceInstanceUrl } = trpc.salesforce.getInstanceUrl.useQuery();
  const { data: accountOpportunities } = trpc.opportunities.getByAccountId.useQuery({ accountId }, { enabled: accountId > 0 });
  const { data: intentSignals } = trpc.intentScores.list.useQuery({ accountId }, { enabled: accountId > 0 && !!account });

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Parse rawData for additional fields
  const rawData = (account?.rawData as Record<string, any>) || {};
  const accountOwner = rawData.accountOwner || rawData.owner;
  const ssoProvider = rawData['SSO Provider'];
  const mfaSolution = rawData['MFA Solution'];
  const securityIncidents = rawData['Recent Security Incidents'];
  const competitorIntent = rawData['Competitor MFA Intent'];

  const getIntentColor = (score: number) => {
    if (score >= 80) return 'text-critical';
    if (score >= 60) return 'text-caution';
    if (score >= 40) return 'text-caution';
    return 'text-ink-subtle';
  };

  const getBuyingStageColor = (stage: string) => {
    switch (stage) {
      case 'Purchase': return 'bg-positive-subtle text-positive border-positive/30';
      case 'Decision': return 'bg-accent-subtle text-accent border-accent/30';
      case 'Consideration': return 'bg-caution-subtle text-caution border-caution/30';
      case 'Awareness': return 'bg-caution-subtle text-caution border-caution/30';
      default: return 'bg-muted text-ink-muted border-border';
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="container py-6 max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded" />)}
            </div>
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!account) {
    return (
      <div>
        <div className="container py-1 max-w-2xl text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Account not found</h3>
          <Button asChild><Link href="/accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        </div>
      </div>
    );
  }

  const intentScore = account.intentScore || 0;
  const buyingStage = (account as any).buyingStage || (
    intentScore >= 86 ? 'Purchase' :
    intentScore >= 70 ? 'Decision' :
    intentScore >= 50 ? 'Consideration' :
    intentScore >= 20 ? 'Awareness' : 'Target'
  );

  // Extract final AI output (hide reasoning)
  const extractFinalOutput = (text: string | null | undefined): string => {
    if (!text) return '';
    // Remove XML tags and reasoning sections
    let clean = text
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<strategy>[\s\S]*?<\/strategy>/gi, '')
      .replace(/<notes>[\s\S]*?<\/notes>/gi, '')
      .replace(/---+/g, '')
      .trim();
    // If there's an OUTPUT section, extract just that
    const outputMatch = clean.match(/OUTPUT[:\s]*([\s\S]*?)(?:$|---)/i);
    if (outputMatch) clean = outputMatch[1].trim();
    return clean;
  };

  return (
    <div>
      <AIAssistant context={{ type: 'account', id: accountId, name: account.name }} />

      <div className="container py-1 space-y-5 max-w-7xl">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/accounts"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <CompanyLogo name={account.name} website={account.domain} size="xl" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold truncate">{account.name}</h1>
                <Badge className={getBuyingStageColor(buyingStage)}>{buyingStage}</Badge>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {account.domain && (
                  <a href={`https://${account.domain}`} target="_blank" rel="noopener noreferrer" 
                     className="flex items-center gap-1 hover:text-primary">
                    <Globe className="h-3 w-3" />{account.domain}
                  </a>
                )}
                {account.industry && <span>{account.industry}</span>}
                {account.employeeCount && <span>{account.employeeCount} employees</span>}
                {accountOwner && <span>Owner: {accountOwner}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <Button size="sm" className="text-foreground" asChild>
              <Link href="/outreach"><Mail className="mr-1 h-4 w-4" />Outreach</Link>
            </Button>
            {account.linkedinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={account.linkedinUrl} target="_blank"><Linkedin className="mr-1 h-4 w-4" />LinkedIn</a>
              </Button>
            )}
            {(account as any).sfdcAccountId && (
              <Button size="sm" variant="outline" className="border-accent/30 text-accent" asChild>
                <a href={`${salesforceInstanceUrl || 'https://login.salesforce.com'}/lightning/r/Account/${(account as any).sfdcAccountId}/view`} target="_blank">
                  <ExternalLink className="mr-1 h-4 w-4" />Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Key Metrics Row - Dense */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Intent Score</div>
            <div className={`text-3xl font-bold ${getIntentColor(intentScore)}`}>{intentScore}</div>
            <div className="text-xs text-muted-foreground">
              {intentScore >= 80 ? 'Hot' : intentScore >= 60 ? 'Warm' : 'Cold'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Buying Stage</div>
            <div className="text-xl font-semibold">{buyingStage}</div>
            <div className="text-xs text-muted-foreground">
              {(account as any).buyingStage ? '6sense' : 'Inferred'}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Profile Fit</div>
            <div className="text-xl font-semibold">{(account as any).sixsenseProfileFit || 'Unknown'}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Contacts</div>
            <div className="text-2xl font-semibold text-accent">{people?.length || 0}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Relationship</div>
            <div className="text-xl font-semibold">{account.relationship || 'Prospect'}</div>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Contacts & Security Intel */}
          <div className="md:col-span-1 space-y-4">
            {/* Active Deals */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    Active Deals
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {accountOpportunities?.map((opp: any) => (
                  <div key={opp.id} className="p-3 rounded bg-card border border-border">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold truncate">{opp.name}</span>
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {opp.stage}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs font-mono text-positive">
                        ${Number(opp.amount).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1">
                        <BrainCircuit className="h-3 w-3 text-accent" />
                        <span className="text-[10px] font-bold text-accent">
                          {opp.aiSuccessScore}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            {/* Intent Signals (6sense) */}
            {intentSignals && intentSignals.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-caution" />
                    Intent Signals
                    <span className="text-xs font-normal text-muted-foreground">({intentSignals[0].source})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {intentSignals.slice(0, 4).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {s.category ? ` · ${s.category}` : ''}
                      </span>
                      <span className={`font-semibold ${getIntentColor(s.score)}`}>{s.score}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Key Contacts */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-accent" />
                    Key Contacts ({people?.length || 0})
                  </span>
                  <Link href={`/contacts?account=${accountId}`} className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {!people || people.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No contacts found</p>
                ) : (
                  people.slice(0, 5).map((person: any) => (
                    <Link key={person.id} href={`/contacts/${person.id}`}>
                      <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer group">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate group-hover:text-primary">
                            {person.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {person.title || 'No title'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {person.linkedinUrl && (
                            <button type="button" aria-label="Open LinkedIn profile"
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(person.linkedinUrl!, '_blank', 'noopener,noreferrer'); }}
                               className="p-1 hover:bg-accent-subtle rounded">
                              <Linkedin className="h-3 w-3 text-accent" />
                            </button>
                          )}
                          {person.email && (
                            <button onClick={(e) => { e.preventDefault(); copyToClipboard(person.email!, 'email'); }}
                                    className="p-1 hover:bg-muted rounded">
                              {copiedField === 'email' ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Security Intelligence */}

            {/* Security Intelligence */}
            {(ssoProvider || mfaSolution || securityIncidents || competitorIntent) && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-accent" />
                    Security Intel
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {ssoProvider && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SSO</span>
                      <span className="font-medium">{ssoProvider}</span>
                    </div>
                  )}
                  {mfaSolution && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">MFA</span>
                      <span className="font-medium">{mfaSolution}</span>
                    </div>
                  )}
                  {competitorIntent && (
                    <div className="p-2 rounded bg-caution-subtle border border-caution/30">
                      <div className="flex items-center gap-1 text-xs text-caution mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Competitor Intent
                      </div>
                      <p className="text-xs">{competitorIntent}</p>
                    </div>
                  )}
                  {securityIncidents && (
                    <div className="p-2 rounded bg-critical-subtle border border-critical/30">
                      <div className="flex items-center gap-1 text-xs text-critical mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Security Incidents
                      </div>
                      <p className="text-xs">{String(securityIncidents).slice(0, 200)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - AI Intelligence */}
          <div className="md:col-span-2 space-y-4">
            {/* AI Overview */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-caution" />
                    AI Account Brief
                  </span>
                  {overviewQuery.data?.cached && (
                    <Badge variant="outline" className="text-xs">
                      Updated {overviewQuery.data.cacheAge}m ago
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {overviewQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating overview...
                  </div>
                ) : overviewQuery.data?.summary ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <SafeStreamdown>{extractFinalOutput(overviewQuery.data.summary)}</SafeStreamdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No overview available</p>
                )}
              </CardContent>
            </Card>

            {/* Strategic Insights */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    Strategic Insights
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => insightsQuery.refetch()}
                    disabled={insightsQuery.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 ${insightsQuery.isFetching ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {insightsQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating insights...
                  </div>
                ) : insightsQuery.data?.recommendations ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <SafeStreamdown>{extractFinalOutput(insightsQuery.data.recommendations)}</SafeStreamdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No insights available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
