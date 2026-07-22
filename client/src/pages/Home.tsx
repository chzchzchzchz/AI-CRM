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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <img
                src={APP_LOGO}
                alt={APP_TITLE}
                className="h-20 w-20 rounded-xl object-cover"
              />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-slate-300">
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
      <div className="min-h-screen bg-background">
        <div className="container py-12 space-y-8 max-w-7xl">
          {/* Hero skeleton */}
          <div className="space-y-4">
            <div className="h-12 w-96 skeleton" />
            <div className="h-6 w-80 skeleton" />
          </div>

          {/* Stats skeleton */}
          <div className="grid gap-6 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-xl" />
            ))}
          </div>

          {/* Content skeleton */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-96 skeleton rounded-xl" />
              <div className="h-64 skeleton rounded-xl" />
            </div>
            <div className="space-y-6">
              <div className="h-80 skeleton rounded-xl" />
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
    gradient: index === 0 ? "from-red-600 to-orange-600" : index === 1 ? "from-amber-600 to-yellow-600" : "from-blue-600 to-cyan-600",
  }));

  return (
    <div className="min-h-screen bg-background">
      <DemoTour />
      <div className="container py-10 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0">
              <Target className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Good morning{repName ? `, ${repName}` : ''}
              </h1>
              <div className="mt-1 text-sm text-slate-300">
                {isKnownRep ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {repTerritory} Territory
                    <span className="text-slate-600">•</span>
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
            <Card className="h-full p-5 transition-colors hover:border-cyan-500/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Total Accounts</span>
                <Building2 className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-3 text-3xl font-bold font-mono tabular-nums text-foreground">{totalAccounts}</div>
              <p className="mt-1 text-xs text-slate-400">{isKnownRep ? `${repTerritory} territory` : 'Across all territories'}</p>
            </Card>
          </Link>

          <Link href="/accounts?filter=hot">
            <Card className="h-full p-5 transition-colors hover:border-cyan-500/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Hot Leads</span>
                <Flame className="h-4 w-4 text-red-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums text-red-400">{hotLeads}</span>
                <span className="text-xs font-semibold text-red-400">🔥 Hot</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Intent score 70+</p>
            </Card>
          </Link>

          <Link href="/accounts?filter=warm">
            <Card className="h-full p-5 transition-colors hover:border-cyan-500/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Warm Leads</span>
                <TrendingUp className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums text-amber-400">{warmLeads}</span>
                <span className="text-xs font-semibold text-amber-400">🌡️ Warm</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">Engagement, intent 70+, or calls</p>
            </Card>
          </Link>

          <Link href="/opportunities">
            <Card className="h-full p-5 transition-colors hover:border-cyan-500/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Pipeline Revenue</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-3 text-3xl font-bold font-mono tabular-nums text-emerald-400">
                ${(opportunitiesData
                  ?.filter((opp: any) => String(opp.status ?? "Open").toLowerCase() === "open")
                  .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0) || 0).toLocaleString()}
              </div>
              <p className="mt-1 text-xs text-slate-400">Total open pipeline</p>
            </Card>
          </Link>

          <Link href="/accounts?filter=unworked">
            <Card className="h-full p-5 transition-colors hover:border-cyan-500/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">6QA Opportunity Gap</span>
                <Target className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums text-amber-400">{sixsenseSummary?.sixQA?.unworked || 0}</span>
                <span className="text-xs font-semibold text-amber-400">⚠ Unworked</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                <span className="font-mono">{sixsenseSummary?.sixQA?.total ? `${Math.round(((sixsenseSummary.sixQA.unworked || 0) / sixsenseSummary.sixQA.total) * 100)}%` : '0%'}</span> of 6QAs unworked
              </p>
            </Card>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/outreach">
            <Card className="h-full p-4 flex items-center gap-3 transition-colors hover:border-cyan-500/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
                <Mail className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">Generate Outreach</div>
                <div className="text-xs text-slate-400">AI-powered emails</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 ml-auto flex-shrink-0" />
            </Card>
          </Link>
          <Link href="/top-accounts">
            <Card className="h-full p-4 flex items-center gap-3 transition-colors hover:border-cyan-500/40">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
                <Target className="h-5 w-5 text-purple-400" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm text-foreground">Top 15 Accounts</div>
                <div className="text-xs text-slate-400">By region &amp; AE</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 ml-auto flex-shrink-0" />
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
                  <Flame className="h-5 w-5 text-red-400" />
                  <h2 className="text-xl font-bold text-foreground">Priority Actions</h2>
                </div>
                <Badge className="bg-red-500/15 text-red-400 border-red-500/30">
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
                  const tierColor = vectorScores?.tier === 1 ? 'text-green-500' : 
                                   vectorScores?.tier === 2 ? 'text-emerald-500' : 
                                   vectorScores?.tier === 3 ? 'text-yellow-500' : 
                                   vectorScores?.tier === 4 ? 'text-orange-500' : 'text-red-500';
                  
                  return (
                    <Card key={action.id} className="transition-colors hover:border-cyan-500/40 cursor-pointer group">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          {/* Company Logo */}
                          <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden">
                            <img
                              src={`https://logo.clearbit.com/${action.domain}`}
                              alt={`${action.name} logo`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-slate-800 text-slate-300 font-bold text-lg">${action.name.charAt(0)}</div>`;
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
                                    <Badge className="bg-red-500/15 text-red-400 border-red-500/30">
                                      ⚠️ Lost opp
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-400">
                                  Intent <span className="font-mono text-cyan-400">{action.intentScore}</span>
                                  {' · '}{action.industry}
                                  {' · '}<span className="font-mono">{action.employeeCount?.toLocaleString() || ''}</span> employees
                                  {' · '}{action.region}
                                  {accountOwner && <span> · Owner: {accountOwner}</span>}
                                </p>
                                {/* Temperature & Activity Badges */}
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {temperature && (
                                    <Badge className={`text-xs ${
                                      temperature === 'Hot' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                      temperature === 'Warm' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                                      'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                    }`}>
                                      {temperature === 'Hot' ? '🔥' : temperature === 'Warm' ? '🌡️' : '❄️'} {temperature}
                                    </Badge>
                                  )}
                                  {daysSinceLastEngagement !== null && daysSinceLastEngagement !== undefined && (
                                    <Badge variant="outline" className={`text-xs ${
                                      daysSinceLastEngagement <= 7 ? 'border-emerald-500/40 text-emerald-400' :
                                      daysSinceLastEngagement <= 30 ? 'border-amber-500/40 text-amber-400' :
                                      'border-red-500/40 text-red-400'
                                    }`}>
                                      <span className="font-mono">{daysSinceLastEngagement}d</span>&nbsp;since activity
                                    </Badge>
                                  )}
                                  {salesActivities > 0 && (
                                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                                      <span className="font-mono">{salesActivities}</span>&nbsp;activities
                                    </Badge>
                                  )}
                                  {opportunityStatus && (
                                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
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
                              <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                <p className="text-sm text-slate-200">
                                  <span className="font-semibold text-purple-400">Contact:</span>{' '}
                                  <span className="font-medium">{primaryContact}</span>
                                </p>
                              </div>
                            )}

                            {/* Top Contacts */}
                            {action.topContacts && action.topContacts.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-slate-400">
                                  Top Contacts (<span className="font-mono">{action.contactCount}</span>){keyContactsCount > 0 && <> · <span className="font-mono">{keyContactsCount}</span> executives</>}
                                </p>
                                {action.topContacts.slice(0, 3).map((contact: any, idx: number) => (
                                  <p key={idx} className="text-sm text-slate-200">
                                    • <span className={`font-medium ${contact.isKeyTitle ? 'text-purple-400' : ''}`}>{contact.name}</span>
                                    {contact.title && <span className="text-slate-400"> — {contact.title}</span>}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Why Now — the evidence behind the action */}
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-amber-400 mb-1">Why now</p>
                              <p className="text-sm text-slate-100">{action.whyNow}</p>
                            </div>

                            {/* Next Best Action — the AI recommendation (cyan = signal) */}
                            <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-cyan-400 mb-1">Next best action</p>
                              <p className="text-sm text-slate-100">{action.nextBestAction}</p>
                            </div>

                            {/* Engagement Metrics */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Last: {engagementMetrics?.lastCallFormatted || 'Never'}
                              </span>
                              {engagementMetrics?.daysSinceLastCall !== null && engagementMetrics?.daysSinceLastCall !== undefined && (
                                <Badge variant="outline" className={`text-xs ${
                                  engagementMetrics.daysSinceLastCall <= 7 ? 'border-emerald-500/40 text-emerald-400' :
                                  engagementMetrics.daysSinceLastCall <= 30 ? 'border-amber-500/40 text-amber-400' :
                                  'border-red-500/40 text-red-400'
                                }`}>
                                  <span className="font-mono">{engagementMetrics.daysSinceLastCall}d</span>&nbsp;ago
                                </Badge>
                              )}
                              <span className="text-slate-600">•</span>
                              <span><span className="font-mono text-slate-300">{engagementMetrics?.totalCalls || 0}</span> calls</span>
                              <span className="text-slate-600">•</span>
                              <span><span className="font-mono text-slate-300">{action.contactCount}</span> contacts</span>
                            </div>

                            {/* VECTOR Score Breakdown (compact) */}
                            {vectorScores && (
                              <div className="flex gap-2 text-xs">
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300" title="Engagement">
                                  E:<span className="font-mono">{vectorScores.engagement}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300" title="Conversion">
                                  C:<span className="font-mono">{vectorScores.conversion}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300" title="Strategic">
                                  S:<span className="font-mono">{vectorScores.strategic}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300" title="Timing">
                                  T:<span className="font-mono">{vectorScores.timing}</span>
                                </span>
                              </div>
                            )}

                            {/* Action Button */}
                            <div>
                              <Button asChild variant="outline" size="sm" className="group-hover:border-cyan-500/50 group-hover:text-cyan-400">
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
            <Card className="card-elevated">
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
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group">
                          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold shadow-lg">
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
            <Card className="card-elevated">
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
            <Card className="card-elevated border-l-4 border-l-cyan-500">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-5 w-5 text-cyan-500" />
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
