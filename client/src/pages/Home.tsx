import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Linkedin, Phone, TrendingUp, Building2, Users, Flame, Zap, ArrowRight, Sparkles, Target, Calendar, MapPin, UserCircle, FileSpreadsheet, DollarSign } from "lucide-react";
import { ContextualAI } from "@/components/ContextualAI";
import { DemoTour } from "@/components/DemoTour";
import { HotLeadsWidget } from "@/components/HotLeadsWidget";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { RepSwitcher } from "@/components/RepSwitcher";
import { useRep, REP_TERRITORIES } from "@/contexts/RepContext";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { MetricGrid } from "@/components/ui/metric";
import { StatCard } from "@/components/StatCard";
import { CompanyLogo } from "@/components/ui/company-logo";
import { BrandLockup } from "@/components/app-shell/Brand";

/**
 * War Room Dashboard - Beautiful modern redesign
 * Daily command center for sales reps with stunning visuals
 */
export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const isDemoUser = user?.email?.includes('demo') || false;
  const { selectedRep, repInfo: globalRepInfo, matchesTerritory } = useRep();
  const [, setLocation] = useLocation();
  
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
<BrandLockup />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{APP_TITLE}</h1>
              <p className="text-sm text-muted-foreground">
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

  const timeOfDay = (() => {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 18) return "afternoon";
    return "evening";
  })();

  const openPipeline =
    opportunitiesData
      ?.filter((opp: any) => String(opp.status ?? "Open").toLowerCase() === "open")
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
      <div className="container py-1 space-y-5 max-w-7xl">
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
              <Button asChild>
                <Link href="/outreach">
                  <Mail className="size-4" />
                  Generate outreach
                </Link>
              </Button>
            </>
          }
        />

        <ContextualAI context="home" placeholder="Ask about today's pipeline…" />

        {/* Key figures. Each tile links to the list it summarises. */}
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
            value={sixsenseSummary?.sixQA?.unworked || 0}
            subtitle={
              sixsenseSummary?.sixQA?.total
                ? `${Math.round(((sixsenseSummary.sixQA.unworked || 0) / sixsenseSummary.sixQA.total) * 100)}% of qualified accounts`
                : "No 6QA data"
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
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">Priority actions</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Highest-signal accounts to work first
                  </p>
                </div>
                <Badge variant="critical">{priorityActions.length} urgent</Badge>
              </div>

              <div className="space-y-3">
                {priorityActions.map((action) => {
                  const vectorScores = (action as any).vectorScores;
                  const engagementMetrics = (action as any).engagementMetrics;
                  const primaryContact = (action as any).primaryContact;
                  const keyContactsCount = (action as any).keyContactsCount || 0;
                  const isLostOpp = (action as any).isLostOpp;
                  const temperature = (action as any).temperature;
                  const daysSinceLastEngagement = (action as any).daysSinceLastEngagement;
                  const accountOwner = (action as any).accountOwner;
                  const opportunityStatus = (action as any).opportunityStatus;
                  const salesActivities = (action as any).salesActivities;

                  const facts = [
                    action.industry,
                    action.employeeCount ? `${action.employeeCount.toLocaleString()} employees` : null,
                    action.region,
                    accountOwner ? `Owner: ${accountOwner}` : null,
                  ].filter(Boolean);

                  return (
                    <Card key={action.id} interactive className="group">
                      <CardContent className="space-y-3.5 p-4">
                        <div className="flex items-start gap-3">
                          <CompanyLogo name={action.name} website={action.domain} size="lg" />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h4 className="truncate font-medium group-hover:text-accent">
                                {action.name}
                              </h4>
                              {temperature && (
                                <Badge
                                  variant={
                                    temperature === "Hot"
                                      ? "critical"
                                      : temperature === "Warm"
                                        ? "caution"
                                        : "secondary"
                                  }
                                >
                                  {temperature}
                                </Badge>
                              )}
                              {isLostOpp && <Badge variant="caution">Lost opp</Badge>}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-ink-muted">
                              {facts.join(" · ")}
                            </p>
                          </div>

                          {vectorScores && (
                            <div className="shrink-0 text-right">
                              <div data-numeric className="text-lg leading-none font-semibold">
                                {vectorScores.composite}
                                <span className="text-xs font-normal text-ink-faint">/100</span>
                              </div>
                              <div className="mt-0.5 text-2xs text-ink-faint">
                                VECTOR · tier {vectorScores.tier}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* The two judgement calls, as labelled rows rather than
                            filled panels — a stack of saturated boxes buried the
                            text they were meant to emphasise. */}
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
                          {primaryContact && (
                            <div>
                              <dt className="text-2xs font-medium tracking-wide text-ink-faint uppercase">
                                Contact
                              </dt>
                              <dd className="mt-0.5 text-sm">{primaryContact}</dd>
                            </div>
                          )}
                        </dl>

                        {action.topContacts && action.topContacts.length > 0 && (
                          <ul className="space-y-0.5">
                            {action.topContacts.slice(0, 3).map((contact: any, idx: number) => (
                              <li key={idx} className="text-xs">
                                <span className={contact.isKeyTitle ? "font-medium text-accent" : "font-medium"}>
                                  {contact.name}
                                </span>
                                {contact.title && (
                                  <span className="text-ink-muted"> — {contact.title}</span>
                                )}
                              </li>
                            ))}
                            {keyContactsCount > 0 && (
                              <li className="text-2xs text-ink-faint">
                                {action.contactCount} contacts · {keyContactsCount} executives
                              </li>
                            )}
                          </ul>
                        )}

                        {vectorScores && (
                          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                            {[
                              ["Engagement", vectorScores.engagement],
                              ["Conversion", vectorScores.conversion],
                              ["Strategic", vectorScores.strategic],
                              ["Timing", vectorScores.timing],
                            ].map(([label, value]) => (
                              <div key={String(label)}>
                                <div className="text-2xs tracking-wide text-ink-faint uppercase">
                                  {label}
                                </div>
                                <div data-numeric className="text-sm font-medium tabular-nums">
                                  {value as number}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-subtle pt-3 text-2xs text-ink-muted">
                          <span>Last contact {engagementMetrics?.lastCallFormatted || "never"}</span>
                          {engagementMetrics?.daysSinceLastCall != null && (
                            <StatusDot
                              tone={
                                engagementMetrics.daysSinceLastCall <= 7
                                  ? "positive"
                                  : engagementMetrics.daysSinceLastCall <= 30
                                    ? "caution"
                                    : "critical"
                              }
                              className="text-2xs"
                            >
                              {engagementMetrics.daysSinceLastCall}d ago
                            </StatusDot>
                          )}
                          <span>{engagementMetrics?.totalCalls || 0} calls</span>
                          {salesActivities > 0 && <span>{salesActivities} activities</span>}
                          {opportunityStatus && <span>Opp: {opportunityStatus}</span>}
                          {daysSinceLastEngagement != null && (
                            <span>{daysSinceLastEngagement}d since engagement</span>
                          )}
                          <Button asChild variant="ghost" size="sm" className="ml-auto">
                            <Link href={`/accounts/${action.id}`}>
                              Open account
                              <ArrowRight className="size-3.5" />
                            </Link>
                          </Button>
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
                          <div className="flex items-center justify-center w-10 h-10 rounded-sm bg-accent text-accent-foreground font-bold shadow-lg">
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
            <Card>
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
