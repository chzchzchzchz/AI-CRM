import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Linkedin, Phone, TrendingUp, Building2, Users, Flame, Zap, ArrowRight, Sparkles, Target, Calendar, MapPin, UserCircle, FileSpreadsheet, DollarSign } from "lucide-react";
import { ContextualAI } from "@/components/ContextualAI";
import { DemoTour } from "@/components/DemoTour";
import { HotLeadsWidget } from "@/components/HotLeadsWidget";
import { WhatChanged } from "@/components/WhatChanged";
import { FollowUps } from "@/components/FollowUps";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { RepSwitcher } from "@/components/RepSwitcher";
import { useRep, REP_TERRITORIES } from "@/contexts/RepContext";
import { CompanyLogo } from "@/components/ui/company-logo";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { MetricGrid } from "@/components/ui/metric";
import { StatCard } from "@/components/StatCard";


/**
 * War Room Dashboard - Beautiful modern redesign
 * Daily command center for sales reps with stunning visuals
 */
export default function Home() {
  const [, setLocation] = useLocation();
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
  // No invented fallback. This tile is a count of qualified accounts with no opportunity;
  // guessing "80% of everything" when the server hasn't answered yet put a fabricated
  // number under a real-looking label. Until repStats arrives, show nothing.
  const sixQAGap = repStats?.sixQAGap;

  const timeOfDay = (() => {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  })();

  // Scoped to the rep's territory like every other tile in this row. Summing every open
  // opportunity in the workspace put a $21.3M company-wide figure under a heading that
  // reads "West territory", which overstates a 66-account book by roughly twentyfold.
  const territoryAccountIds = new Set(
    (accounts ?? [])
      .filter((a: any) => matchesTerritory(a.region || "", a.employeeCount || 0))
      .map((a: any) => a.id)
  );
  const openPipeline =
    opportunitiesData
      ?.filter(
        (opp: any) =>
          String(opp.status ?? "Open").toLowerCase() === "open" &&
          territoryAccountIds.has(opp.accountId)
      )
      .reduce((sum: number, opp: any) => sum + (Number(opp.amount) || 0), 0) || 0;

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
      <div className="container max-w-[1500px] space-y-5 py-1">
        <PageHeader
          title={`Good ${timeOfDay}${repName ? `, ${repName}` : ""}`}
          description={
            isKnownRep
              ? `${repTerritory} territory · ${repSize}`
              : "Your pipeline at a glance"
          }
          actions={
            <>
              <RepSwitcher />
              <Button asChild variant="outline">
                <Link href="/top-accounts">
                  <Target className="size-4" />
                  Top 15
                </Link>
              </Button>
              <Button asChild variant="signal">
                <Link href="/outreach">
                  <Mail className="size-4" />
                  Generate outreach
                </Link>
              </Button>
            </>
          }
        />

        <ContextualAI context="home" placeholder="Ask about today's pipeline…" />

        {/* Key figures. Butted together so the row reads as one instrument
            panel; each tile links to the list it summarises. */}
        <MetricGrid>
          <StatCard
            title="Accounts"
            value={totalAccounts}
            subtitle={isKnownRep ? `${repTerritory} territory` : "All territories"}
            icon={Building2}
            onClick={() => setLocation("/accounts")}
          />
          <StatCard
            title="Hot"
            value={hotLeads}
            subtitle="Intent 70+"
            icon={Flame}
            tone="critical"
            onClick={() => setLocation("/accounts?filter=hot")}
          />
          <StatCard
            title="Warm"
            value={warmLeads}
            subtitle="Intent 40–69"
            icon={TrendingUp}
            tone="caution"
            onClick={() => setLocation("/accounts?filter=warm")}
          />
          <StatCard
            title="Open pipeline"
            value={`$${openPipeline.toLocaleString()}`}
            subtitle="Across open opportunities"
            icon={DollarSign}
            tone="positive"
            onClick={() => setLocation("/opportunities")}
          />
          <StatCard
            title="Unworked 6QA"
            // Territory-scoped, like every other tile in this row. It previously read from
            // the workspace-wide 6sense summary, so a rep saw a global count sitting under
            // their own territory heading — the same mismatch that made "Accounts" say
            // 1,000 for a 66-account territory.
            value={sixQAGap ?? "—"}
            subtitle={
              sixQAGap !== undefined && hotLeads > 0
                ? `${Math.round((sixQAGap / hotLeads) * 100)}% of qualified accounts`
                : sixQAGap !== undefined
                  ? "No qualified accounts"
                  : "Loading"
            }
            icon={Target}
            tone="accent"
            onClick={() => setLocation("/accounts?filter=unworked")}
          />
        </MetricGrid>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Priority Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Actions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">Priority actions</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Highest-signal accounts to work first
                  </p>
                </div>
                <Badge className="bg-critical-subtle text-critical border-critical/30">
                  <span className="tabular-nums">{priorityActions.length}</span>&nbsp;urgent
                </Badge>
              </div>

              <div className="space-y-3">
                {priorityActions.map((action) => {
                  const Icon = action.icon;
                  const vectorScores = (action as any).vectorScores;
                  const engagementMetrics = (action as any).engagementMetrics;
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
                        <div className="flex flex-wrap items-start gap-4">
                          {/* Company Logo */}
                          <CompanyLogo name={action.name} website={action.domain} size="lg" />
                          <div className="flex-1 min-w-0 space-y-3">
                            {/* Account Header with VECTOR Score */}
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-lg text-foreground">{action.name}</h3>
                                  {vectorScores && (
                                    <Badge variant="outline" className={`${tierColor} border-current font-semibold`}>
                                      VECTOR <span className="tabular-nums ml-1">{vectorScores.composite}/100</span>
                                    </Badge>
                                  )}
                                  {isLostOpp && (
                                    <Badge className="bg-critical-subtle text-critical border-critical/30">
                                      Lost opp
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-ink-muted">
                                  Intent <span className="tabular-nums text-accent">{action.intentScore}</span>
                                  {' · '}{action.industry}
                                  {' · '}<span className="tabular-nums">{action.employeeCount?.toLocaleString() || ''}</span> employees
                                  {' · '}{action.region}
                                  {accountOwner && <span> · Owner: {accountOwner}</span>}
                                </p>
                                {/* Temperature & Activity Badges */}
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {temperature && (
                                    <Badge className={`text-xs ${ temperature === 'Hot' ? 'bg-critical-subtle text-critical border-critical/30' : temperature === 'Warm' ? 'bg-caution-subtle text-caution border-caution/30' : 'bg-accent-subtle text-accent border-accent/30' }`}>
                                      {temperature}
                                    </Badge>
                                  )}
                                  {daysSinceLastEngagement !== null && daysSinceLastEngagement !== undefined && (
                                    <Badge variant="outline" className={`text-xs ${ daysSinceLastEngagement <= 7 ? 'border-positive/30 text-positive' : daysSinceLastEngagement <= 30 ? 'border-caution/30 text-caution' : 'border-critical/30 text-critical' }`}>
                                      <span className="tabular-nums">{daysSinceLastEngagement}d</span>&nbsp;since activity
                                    </Badge>
                                  )}
                                  {salesActivities > 0 && (
                                    <Badge variant="outline" className="text-xs border-border-strong text-ink-muted">
                                      <span className="tabular-nums">{salesActivities}</span>&nbsp;activities
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
                                  <span className={tierColor}>Tier <span className="tabular-nums">{vectorScores.tier}</span></span>
                                </div>
                              )}
                            </div>


                            {/* Top Contacts */}
                            {action.topContacts && action.topContacts.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-ink-muted">
                                  Top Contacts (<span className="tabular-nums">{action.contactCount}</span>){keyContactsCount > 0 && <> · <span className="tabular-nums">{keyContactsCount}</span> executives</>}
                                </p>
                                {action.topContacts.slice(0, 3).map((contact: any, idx: number) => (
                                  <p key={idx} className="text-sm text-foreground">
                                    • <span className={`font-medium ${contact.isKeyTitle ? 'text-accent' : ''}`}>{contact.name}</span>
                                    {contact.title && <span className="text-ink-muted"> — {contact.title}</span>}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* The evidence and the recommendation, as labelled
                                rows against a single rule. */}
                            <dl className="space-y-2 border-l-2 border-border pl-3">
                              <div>
                                <dt className="text-2xs font-medium tracking-wide text-ink-faint uppercase">
                                  Why now
                                </dt>
                                <dd className="mt-0.5 text-sm">{action.whyNow}</dd>
                              </div>
                              <div>
                                <dt className="text-2xs font-medium tracking-wide text-ink-faint uppercase">
                                  Next best action
                                </dt>
                                <dd className="mt-0.5 text-sm">{action.nextBestAction}</dd>
                              </div>
                              {/* No separate "Contact" row: the next best action names the
                                  person, and the contact list above names them again. The
                                  same string three times in one card reads as a bug. */}
                            </dl>

                            {/* Engagement Metrics */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                              <span className="flex flex-wrap items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Last: {engagementMetrics?.lastCallFormatted || 'Never'}
                              </span>
                              {engagementMetrics?.daysSinceLastCall !== null && engagementMetrics?.daysSinceLastCall !== undefined && (
                                <Badge variant="outline" className={`text-xs ${ engagementMetrics.daysSinceLastCall <= 7 ? 'border-positive/30 text-positive' : engagementMetrics.daysSinceLastCall <= 30 ? 'border-caution/30 text-caution' : 'border-critical/30 text-critical' }`}>
                                  <span className="tabular-nums">{engagementMetrics.daysSinceLastCall}d</span>&nbsp;ago
                                </Badge>
                              )}
                              <span className="text-ink-subtle">•</span>
                              <span><span className="tabular-nums text-ink-muted">{engagementMetrics?.totalCalls || 0}</span> calls</span>
                              <span className="text-ink-subtle">•</span>
                              <span><span className="tabular-nums text-ink-muted">{action.contactCount}</span> contacts</span>
                            </div>

                            {/* What makes up the VECTOR score.
                                Four bare numbers out of 100 with no scale and no
                                explanation told a rep nothing — is "Engagement 22" bad?
                                Each now carries its denominator and a hover explaining
                                what moves it, and the weakest one is tinted so the
                                breakdown answers "where is this account thin?" at a
                                glance rather than needing to be read four times. */}
                            {vectorScores && (() => {
                              const parts = [
                                ["Engagement", vectorScores.engagement, "Calls, recency and how many people you've reached"],
                                ["Conversion", vectorScores.conversion, "Intent score and how far along the buying stage is"],
                                ["Strategic", vectorScores.strategic, "Company size, industry fit and tech stack overlap"],
                                ["Timing", vectorScores.timing, "How long since the last touch, against how hot they are"],
                              ] as const;
                              const weakest = Math.min(...parts.map(p => p[1] ?? 100));
                              return (
                                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                                  {parts.map(([label, value, help]) => (
                                    <div key={label} title={help}>
                                      <div className="text-2xs tracking-wide text-ink-faint uppercase">
                                        {label}
                                      </div>
                                      <div
                                        data-numeric
                                        className={`text-sm font-medium tabular-nums ${
                                          value === weakest ? "text-caution" : ""
                                        }`}
                                      >
                                        {value}
                                        <span className="text-2xs font-normal text-ink-faint">/100</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

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
                        <div className="flex flex-wrap items-center gap-4 p-4 rounded-md border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group">
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
            {/* The daily loop, in order: what I owe, what moved, who's hot. Own
                commitments come first — they outrank anything the system inferred. */}
            <FollowUps limit={8} />

            <WhatChanged limit={6} />

            <HotLeadsWidget limit={10} compact={false} />

            {/* This Week's Focus */}
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  This Week's Focus
                </CardTitle>
                <CardDescription>Your priorities for the week</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-start gap-3 group">
                  <Checkbox id="task1" className="mt-1" />
                  <label htmlFor="task1" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Follow up with hot leads ({hotLeads} accounts{globalRepInfo ? ` in ${globalRepInfo.region}` : ''})
                  </label>
                </div>
                <div className="flex flex-wrap items-start gap-3 group">
                  <Checkbox id="task2" className="mt-1" />
                  <label htmlFor="task2" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Review warm leads ({warmLeads} accounts{globalRepInfo ? ` in ${globalRepInfo.region}` : ''})
                  </label>
                </div>
                <div className="flex flex-wrap items-start gap-3 group">
                  <Checkbox id="task3" className="mt-1" />
                  <label htmlFor="task3" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Work unworked 6QAs ({sixsenseSummary?.sixQA?.unworked || 0} accounts)
                  </label>
                </div>
                <div className="flex flex-wrap items-start gap-3 group">
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
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
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
