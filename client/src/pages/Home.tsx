import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Linkedin, Phone, TrendingUp, Building2, Users, Flame, Zap, ArrowRight, Sparkles, Target, Calendar, MapPin, UserCircle, FileSpreadsheet, DollarSign } from "lucide-react";
import { ContextualAI } from "@/components/ContextualAI";
import { DemoTour } from "@/components/DemoTour";
import { HotLeadsWidget } from "@/components/HotLeadsWidget";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { RepSwitcher } from "@/components/RepSwitcher";
import { useRep, REP_TERRITORIES } from "@/contexts/RepContext";


/**
 * War Room Dashboard - Beautiful modern redesign
 * Daily command center for sales reps with stunning visuals
 */
export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const isDemoUser = user?.email?.includes('demo') || false;
  const { selectedRep, repInfo: globalRepInfo, matchesTerritory } = useRep();
  
  // Get the effective email based on selection
  const userEmail = selectedRep || user?.email || '';
  
  // All hooks must be called before any early returns (React rules of hooks)
  const { data: repStats } = trpc.priorityActions.getRepStats.useQuery({ userEmail }, { enabled: !!user });
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery(undefined, { enabled: !!user });
  const { data: enrichedPriorityActions, isLoading: priorityLoading } = trpc.priorityActions.getEnriched.useQuery({ limit: 3, userEmail }, { enabled: !!user });
  const { data: sixsenseSummary } = trpc.sixsenseAnalytics.getSummary.useQuery(undefined, { enabled: !!user });
  const { data: topKeywords } = trpc.sixsenseAnalytics.getKeywords.useQuery({ limit: 10 }, { enabled: !!user });
  const { data: opportunitiesData } = trpc.opportunities.list.useQuery(undefined, { enabled: !!user });

  // Show login screen if not authenticated (after all hooks)
  if (!authLoading && !user) {
    return (
      <div className="flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <img
                src={APP_LOGO}
                alt={APP_TITLE}
                className="h-20 w-20 rounded-md object-cover"
              />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-ink-muted">
                Your AI-powered sales intelligence command center
              </p>
            </div>
          </div>
          <div className="w-full space-y-3">
            <Button asChild size="lg" className="w-full">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link href="/signup">Create Account</Link>
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button asChild size="lg" variant="ghost" className="w-full text-muted-foreground">
              <Link href="/request-access">Request Demo Access</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Beautiful loading state
  if (accountsLoading) {
    return (
      <div>
        <div className="container py-1 space-y-5 max-w-7xl">
          {/* Hero skeleton */}
          <div className="space-y-4">
            <div className="h-12 w-96 skeleton" />
            <div className="h-6 w-80 skeleton" />
          </div>

          {/* Stats skeleton */}
          <div className="grid gap-6 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-md" />
            ))}
          </div>

          {/* Content skeleton */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-96 skeleton rounded-md" />
              <div className="h-64 skeleton rounded-md" />
            </div>
            <div className="space-y-6">
              <div className="h-80 skeleton rounded-md" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Use global rep context for territory info
  const isKnownRep = !!globalRepInfo;
  const repName = globalRepInfo?.name.split(' ')[0] || '';
  const repTerritory = globalRepInfo?.region || '';
  const repSize = globalRepInfo?.label.includes('<2K') ? '<2K employees' : '2K+ employees';

  // Process accounts data - filtered by rep territory
  const topAccounts = accounts
    ?.filter((a: any) => matchesTerritory(a.region || '', a.employeeCount || 0))
    .map((a: any) => ({
      ...a,
      intentScoreNum: parseInt(String(a.intentScore || 0), 10)
    }))
    .sort((a: any, b: any) => b.intentScoreNum - a.intentScoreNum)
    .slice(0, 15) || [];

  // Use rep-specific stats if available, otherwise fall back to all accounts
  const hotLeads = repStats?.hotLeads ?? accounts?.filter((a: any) => parseInt(String(a.intentScore || 0)) >= 70).length ?? 0;
  const warmLeads = repStats?.warmLeads ?? accounts?.filter((a: any) => {
    const score = parseInt(String(a.intentScore || 0));
    return score >= 40 && score < 70;
  }).length ?? 0;
  const totalAccounts = repStats?.totalAccounts ?? accounts?.length ?? 0;
  // For demo users, use a proportion of their accounts; otherwise use repStats
  const sixQAGap = repStats?.sixQAGap !== undefined ? repStats.sixQAGap : Math.floor(totalAccounts * 0.8);

  // Use enriched priority actions with contact data
  const priorityActions = (enrichedPriorityActions || []).map((action, index) => ({
    ...action,
    priority: index === 0 ? "critical" : index === 1 ? "high" : "medium",
    icon: index === 0 ? Flame : index === 1 ? Zap : Linkedin,
    gradient: index === 0 ? " " : index === 1 ? " " : " ",
  }));

  return (
    <div>
      <DemoTour />
      <div className="container py-10 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-card border border-border flex-shrink-0">
              <Target className="h-6 w-6 text-accent" />
            </div>
            <div>
              <h1 className="text-xl md:text-xl font-semibold tracking-tight text-foreground">
                Good morning{repName ? `, ${repName}` : ''}
              </h1>
              <div className="mt-1 text-sm text-ink-muted">
                {isKnownRep ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-ink-muted" />
                    {repTerritory} Territory
                    <span className="text-ink-subtle">•</span>
                    {repSize}
                  </span>
                ) : (
                  "Here's your sales intelligence for today"
                )}
              </div>
            </div>
          </div>
          {/* Rep View Switcher */}
          <RepSwitcher />
        </div>

        {/* AI Assistant Bar */}
        <ContextualAI context="home" placeholder="Ask AI: What should I prioritize today?" />

        {/* Key Stats — tonal cards, mono numbers, status paired with a word */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link href="/accounts">
            <Card className="h-full p-5 transition-colors hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Total Accounts</span>
                <Building2 className="h-4 w-4 text-ink-subtle" />
              </div>
              <div className="mt-3 text-2xl font-semibold font-mono tabular-nums text-foreground">{totalAccounts}</div>
              <p className="mt-1 text-xs text-ink-muted">{isKnownRep ? `${repTerritory} territory` : 'Across all territories'}</p>
            </Card>
          </Link>

          <Link href="/accounts?filter=hot">
            <Card className="h-full p-5 transition-colors hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Hot Leads</span>
                <Flame className="h-4 w-4 text-critical" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums text-critical">{hotLeads}</span>
                <span className="text-xs font-semibold text-critical">🔥 Hot</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">Intent score 70+</p>
            </Card>
          </Link>

          <Link href="/accounts?filter=warm">
            <Card className="h-full p-5 transition-colors hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Warm Leads</span>
                <TrendingUp className="h-4 w-4 text-caution" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums text-caution">{warmLeads}</span>
                <span className="text-xs font-semibold text-caution">🌡️ Warm</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">Engagement, intent 70+, or calls</p>
            </Card>
          </Link>

          <Link href="/opportunities">
            <Card className="h-full p-5 transition-colors hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Pipeline Revenue</span>
                <DollarSign className="h-4 w-4 text-positive" />
              </div>
              <div className="mt-3 text-2xl font-semibold font-mono tabular-nums text-positive">
                ${(opportunitiesData
                  ?.filter((opp: any) => String(opp.status ?? "Open").toLowerCase() === "open")
                  .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0) || 0).toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-ink-muted">Total open pipeline</p>
            </Card>
          </Link>

          <Link href="/accounts?filter=unworked">
            <Card className="h-full p-5 transition-colors hover:border-accent/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">6QA Opportunity Gap</span>
                <Target className="h-4 w-4 text-ink-subtle" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-semibold font-mono tabular-nums text-caution">{sixsenseSummary?.sixQA?.unworked || 0}</span>
                <span className="text-xs font-semibold text-caution">⚠ Unworked</span>
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                <span className="font-mono">{sixsenseSummary?.sixQA?.total ? `${Math.round(((sixsenseSummary.sixQA.unworked || 0) / sixsenseSummary.sixQA.total) * 100)}%` : '0%'}</span> of 6QAs unworked
              </p>
            </Card>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/outreach">
            <Card className="h-full p-4 flex items-center gap-3 transition-colors hover:border-accent/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-accent-subtle border border-accent/30 flex-shrink-0">
                <Mail className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">Generate Outreach</div>
                <div className="text-xs text-ink-muted">AI-powered emails</div>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-subtle ml-auto flex-shrink-0" />
            </Card>
          </Link>
          <Link href="/top-accounts">
            <Card className="h-full p-4 flex items-center gap-3 transition-colors hover:border-accent/30">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-accent-subtle border border-accent/30 flex-shrink-0">
                <Target className="h-5 w-5 text-accent" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">Top 15 Accounts</div>
                <div className="text-xs text-ink-muted">By region &amp; AE</div>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-subtle ml-auto flex-shrink-0" />
            </Card>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Priority Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-critical" />
                  <h2 className="text-xl font-semibold text-foreground">Priority Actions</h2>
                </div>
                <Badge className="bg-critical-subtle text-critical border-critical/30">
                  <span className="font-mono">{priorityActions.length}</span>&nbsp;urgent
                </Badge>
              </div>

              <div className="space-y-3">
                {priorityActions.map((action) => {
                  const Icon = action.icon;
                  const vectorScores = (action as any).vectorScores;
                  const engagementMetrics = (action as any).engagementMetrics;
                  const primaryContact = (action as any).primaryContact;
                  const keyContactsCount = (action as any).keyContactsCount || 0;
                  const isLostOpp = (action as any).isLostOpp;
                  const lostOppContext = (action as any).lostOppContext;
                  // NEW: Surfaced rawData fields
                  const temperature = (action as any).temperature;
                  const daysSinceLastEngagement = (action as any).daysSinceLastEngagement;
                  const accountOwner = (action as any).accountOwner;
                  const opportunityStatus = (action as any).opportunityStatus;
                  const salesActivities = (action as any).salesActivities;
                  const triggerEvents = (action as any).triggerEvents;
                  
                  // Determine VECTOR tier color
                  const tierColor = vectorScores?.tier === 1 ? 'text-positive' : 
                                   vectorScores?.tier === 2 ? 'text-positive' : 
                                   vectorScores?.tier === 3 ? 'text-caution' : 
                                   vectorScores?.tier === 4 ? 'text-caution' : 'text-critical';
                  
                  return (
                    <Card key={action.id} className="transition-colors hover:border-accent/30 cursor-pointer group">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Company Logo */}
                          <div className="w-12 h-12 rounded-sm bg-card border border-border flex-shrink-0 overflow-hidden">
                            <img
                              src={`https://logo.clearbit.com/${action.domain}`}
                              alt={`${action.name} logo`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-muted text-ink-muted font-bold text-lg">${action.name.charAt(0)}</div>`;
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            {/* Account Header with VECTOR Score */}
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-lg text-foreground">{action.name}</h3>
                                  {vectorScores && (
                                    <Badge variant="outline" className={`${tierColor} border-current font-semibold`}>
                                      VECTOR <span className="font-mono ml-1">{vectorScores.composite}/100</span>
                                    </Badge>
                                  )}
                                  {isLostOpp && (
                                    <Badge className="bg-critical-subtle text-critical border-critical/30">
                                      ⚠️ Lost opp
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-ink-muted">
                                  Intent <span className="font-mono text-accent">{action.intentScore}</span>
                                  {' · '}{action.industry}
                                  {' · '}<span className="font-mono">{action.employeeCount?.toLocaleString() || ''}</span> employees
                                  {' · '}{action.region}
                                  {accountOwner && <span> · Owner: {accountOwner}</span>}
                                </p>
                                {/* Temperature & Activity Badges */}
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {temperature && (
                                    <Badge className={`text-xs ${ temperature === 'Hot' ? 'bg-critical-subtle text-critical border-critical/30' : temperature === 'Warm' ? 'bg-caution-subtle text-caution border-caution/30' : 'bg-accent-subtle text-accent border-accent/30' }`}>
                                      {temperature === 'Hot' ? '🔥' : temperature === 'Warm' ? '🌡️' : '❄️'} {temperature}
                                    </Badge>
                                  )}
                                  {daysSinceLastEngagement !== null && daysSinceLastEngagement !== undefined && (
                                    <Badge variant="outline" className={`text-xs ${ daysSinceLastEngagement <= 7 ? 'border-positive/30 text-positive' : daysSinceLastEngagement <= 30 ? 'border-caution/30 text-caution' : 'border-critical/30 text-critical' }`}>
                                      <span className="font-mono">{daysSinceLastEngagement}d</span>&nbsp;since activity
                                    </Badge>
                                  )}
                                  {salesActivities > 0 && (
                                    <Badge variant="outline" className="text-xs border-border-strong text-ink-muted">
                                      <span className="font-mono">{salesActivities}</span>&nbsp;activities
                                    </Badge>
                                  )}
                                  {opportunityStatus && (
                                    <Badge variant="outline" className="text-xs border-border-strong text-ink-muted">
                                      Opp: {opportunityStatus}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {vectorScores && (
                                <div className="text-right text-xs">
                                  <span className={tierColor}>Tier <span className="font-mono">{vectorScores.tier}</span></span>
                                </div>
                              )}
                            </div>

                            {/* Primary Contact Highlight */}
                            {primaryContact && (
                              <div className="p-2 bg-accent-subtle border border-accent/30 rounded-sm">
                                <p className="text-sm text-foreground">
                                  <span className="font-semibold text-accent">Contact:</span>{' '}
                                  <span className="font-medium">{primaryContact}</span>
                                </p>
                              </div>
                            )}

                            {/* Top Contacts */}
                            {action.topContacts && action.topContacts.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-ink-muted">
                                  Top Contacts (<span className="font-mono">{action.contactCount}</span>){keyContactsCount > 0 && <> · <span className="font-mono">{keyContactsCount}</span> executives</>}
                                </p>
                                {action.topContacts.slice(0, 3).map((contact: any, idx: number) => (
                                  <p key={idx} className="text-sm text-foreground">
                                    • <span className={`font-medium ${contact.isKeyTitle ? 'text-accent' : ''}`}>{contact.name}</span>
                                    {contact.title && <span className="text-ink-muted"> — {contact.title}</span>}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Why Now — the evidence behind the action */}
                            <div className="p-3 bg-caution-subtle border border-caution/30 rounded-sm">
                              <p className="text-xs font-semibold text-caution mb-1">Why now</p>
                              <p className="text-sm text-foreground">{action.whyNow}</p>
                            </div>

                            {/* Next Best Action — the AI recommendation (cyan = signal) */}
                            <div className="p-3 bg-accent-subtle border border-accent/30 rounded-sm">
                              <p className="text-xs font-semibold text-accent mb-1">Next best action</p>
                              <p className="text-sm text-foreground">{action.nextBestAction}</p>
                            </div>

                            {/* Engagement Metrics */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Last: {engagementMetrics?.lastCallFormatted || 'Never'}
                              </span>
                              {engagementMetrics?.daysSinceLastCall !== null && engagementMetrics?.daysSinceLastCall !== undefined && (
                                <Badge variant="outline" className={`text-xs ${ engagementMetrics.daysSinceLastCall <= 7 ? 'border-positive/30 text-positive' : engagementMetrics.daysSinceLastCall <= 30 ? 'border-caution/30 text-caution' : 'border-critical/30 text-critical' }`}>
                                  <span className="font-mono">{engagementMetrics.daysSinceLastCall}d</span>&nbsp;ago
                                </Badge>
                              )}
                              <span className="text-ink-subtle">•</span>
                              <span><span className="font-mono text-ink-muted">{engagementMetrics?.totalCalls || 0}</span> calls</span>
                              <span className="text-ink-subtle">•</span>
                              <span><span className="font-mono text-ink-muted">{action.contactCount}</span> contacts</span>
                            </div>

                            {/* VECTOR Score Breakdown (compact) */}
                            {vectorScores && (
                              <div className="flex gap-2 text-xs">
                                <span className="px-2 py-0.5 rounded bg-muted text-ink-muted" title="Engagement">
                                  E:<span className="font-mono">{vectorScores.engagement}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-muted text-ink-muted" title="Conversion">
                                  C:<span className="font-mono">{vectorScores.conversion}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-muted text-ink-muted" title="Strategic">
                                  S:<span className="font-mono">{vectorScores.strategic}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-muted text-ink-muted" title="Timing">
                                  T:<span className="font-mono">{vectorScores.timing}</span>
                                </span>
                              </div>
                            )}

                            {/* Action Button */}
                            <div>
                              <Button asChild variant="outline" size="sm" className="group-hover:border-accent/30 group-hover:text-accent">
                                <Link href={`/accounts/${action.id}`}>
                                  View Full Account
                                  <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Top Accounts Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">Top Accounts Today</CardTitle>
                    <CardDescription className="mt-1">Ranked by intent score</CardDescription>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/accounts">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topAccounts.slice(0, 5).map((account: any, index: number) => {
                    const intentScore = account.intentScoreNum;
                    const intentLevel = intentScore >= 70 ? "hot" : intentScore >= 40 ? "warm" : "cold";
                    const badgeClass = intentScore >= 70 ? "badge-danger" : intentScore >= 40 ? "badge-warning" : "badge-primary";

                    return (
                      <Link key={account.id} href={`/accounts/${account.id}`}>
                        <div className="flex items-center gap-4 p-4 rounded-md border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group">
                          <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-accent-subtle border border-accent/30 text-accent font-bold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{account.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {account.industry} {account.employeeCount && `• ${account.employeeCount} employees`}
                            </p>
                          </div>
                          <Badge className={badgeClass}>
                            {intentScore} {intentLevel}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Tasks & Quick Actions */}
          <div className="space-y-6">
            {/* Hot Leads Widget */}
            <HotLeadsWidget limit={10} compact={false} />

            {/* This Week's Focus */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  This Week's Focus
                </CardTitle>
                <CardDescription>Your priorities for the week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task1" className="mt-1" />
                  <label htmlFor="task1" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Follow up with hot leads ({hotLeads} accounts{globalRepInfo ? ` in ${globalRepInfo.region}` : ''})
                  </label>
                </div>
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task2" className="mt-1" />
                  <label htmlFor="task2" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Review warm leads ({warmLeads} accounts{globalRepInfo ? ` in ${globalRepInfo.region}` : ''})
                  </label>
                </div>
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task3" className="mt-1" />
                  <label htmlFor="task3" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Work unworked 6QAs ({sixsenseSummary?.sixQA?.unworked || 0} accounts)
                  </label>
                </div>
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task4" className="mt-1" />
                  <label htmlFor="task4" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Engage priority accounts ({priorityActions.length} urgent)
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Trending Intent Keywords */}
            <Card className="border border-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  Trending Intent Keywords
                </CardTitle>
                <CardDescription className="text-xs">
                  {globalRepInfo ? 'Company-wide trends (all territories)' : 'What accounts are researching'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {topKeywords?.keywords?.slice(0, 8).map((kw: any) => (
                  <div key={kw.keyword} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground truncate">{kw.keyword}</span>
                    <Badge variant="outline" className="text-xs ml-2">{kw.totalAccounts}</Badge>
                  </div>
                ))}
                {(!topKeywords?.keywords || topKeywords.keywords.length === 0) && (
                  <p className="text-sm text-muted-foreground">No keyword data available</p>
                )}
              </CardContent>
            </Card>


          </div>
        </div>
      </div>
    </div>
  );
}
