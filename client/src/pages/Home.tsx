import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Linkedin, Phone, TrendingUp, Building2, Users, Flame, Zap, ArrowRight, Sparkles, Target, Calendar, MapPin, UserCircle, FileSpreadsheet } from "lucide-react";
import { ContextualAI } from "@/components/ContextualAI";
import { DemoTour } from "@/components/DemoTour";
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
  
  // Show login screen if not authenticated (after all hooks)
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <img
                src={APP_LOGO}
                alt={APP_TITLE}
                className="h-20 w-20 rounded-xl object-cover shadow"
              />
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
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
    ?.filter(a => matchesTerritory(a.region || '', a.employeeCount || 0))
    .map(a => ({
      ...a,
      intentScoreNum: parseInt(String(a.intentScore || 0), 10)
    }))
    .sort((a, b) => b.intentScoreNum - a.intentScoreNum)
    .slice(0, 15) || [];

  // Use rep-specific stats if available, otherwise fall back to all accounts
  const hotLeads = repStats?.hotLeads ?? accounts?.filter(a => parseInt(String(a.intentScore || 0)) >= 70).length ?? 0;
  const warmLeads = repStats?.warmLeads ?? accounts?.filter(a => {
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <DemoTour />
      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                <Target className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold tracking-tight">
                  Good morning{repName ? `, ${repName}` : ''} 👋
                </h1>
                <p className="text-muted-foreground text-lg mt-1">
                  {isKnownRep ? (
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {repTerritory} Territory &bull; {repSize}
                    </span>
                  ) : (
                    "Here's your sales intelligence for today"
                  )}
                </p>
              </div>
            </div>
            {/* Rep View Switcher */}
            <RepSwitcher />
          </div>
        </div>

        {/* AI Assistant Bar */}
        <ContextualAI context="home" placeholder="Ask AI: What should I prioritize today?" />

        {/* Key Stats - Beautiful Cards - All Clickable */}
        <div className="grid gap-6 md:grid-cols-4">
          <Link href="/accounts">
            <Card className="card-elevated border-l-4 border-l-indigo-500 cursor-pointer hover:scale-[1.02] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
                <Building2 className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalAccounts}</div>
                <p className="text-xs text-muted-foreground mt-1">{isKnownRep ? `${repTerritory} territory` : 'Across all territories'}</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/accounts?filter=hot">
            <Card className="card-elevated border-l-4 border-l-red-500 cursor-pointer hover:scale-[1.02] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Hot Leads</CardTitle>
                <Flame className="h-5 w-5 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">{hotLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Intent score 70+</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/accounts?filter=warm">
            <Card className="card-elevated border-l-4 border-l-orange-500 cursor-pointer hover:scale-[1.02] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Warm Leads</CardTitle>
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{warmLeads}</div>
                <p className="text-xs text-muted-foreground mt-1">Engagement, intent 70+, or calls</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/accounts?filter=unworked">
            <Card className="card-elevated border-l-4 border-l-cyan-500 cursor-pointer hover:scale-[1.02] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">6QA Opportunity Gap</CardTitle>
                <Target className="h-5 w-5 text-cyan-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500">{sixsenseSummary?.sixQA?.unworked || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {sixsenseSummary?.sixQA?.total ? `${Math.round(((sixsenseSummary.sixQA.unworked || 0) / sixsenseSummary.sixQA.total) * 100)}%` : '0%'} unworked 6QAs
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Quick Actions Bar - Horizontal at top */}
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/outreach">
            <Card className="card-elevated cursor-pointer hover:scale-[1.02] transition-transform h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Generate Outreach</div>
                  <div className="text-xs text-muted-foreground">AI-powered emails</div>
                </div>
              </CardContent>
            </Card>
          </Link>
          {/* HIDDEN - Gong Calls removed per user request
          {!isDemoUser && (
            <Link href="/calls">
              <Card className="card-elevated cursor-pointer hover:scale-[1.02] transition-transform h-full">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg">
                    <Phone className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">Review Gong Calls</div>
                    <div className="text-xs text-muted-foreground">Latest conversations</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
          */}
          <Link href="/top-accounts">
            <Card className="card-elevated cursor-pointer hover:scale-[1.02] transition-transform h-full border-indigo-500/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Top 15 Accounts</div>
                  <div className="text-xs text-muted-foreground">By Region & AE</div>
                </div>
              </CardContent>
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
                  <Flame className="h-6 w-6 text-red-500" />
                  <h2 className="text-2xl font-bold">Priority Actions</h2>
                </div>
                <Badge className="badge-danger">3 urgent</Badge>
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
                    <Card key={action.id} className="card-elevated hover:scale-[1.01] transition-transform cursor-pointer group">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 bg-gradient-to-br ${action.gradient} rounded-xl shadow-lg group-hover:shadow-xl transition-shadow`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            {/* Account Header with VECTOR Score */}
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-lg">ENGAGE {action.name}</h3>
                                  {vectorScores && (
                                    <Badge variant="outline" className={`${tierColor} border-current font-bold`}>
                                      VECTOR {vectorScores.composite}/100
                                    </Badge>
                                  )}
                                  {isLostOpp && (
                                    <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700">
                                      ⚠️ LOST OPP
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Intent: {action.intentScore} | {action.industry} | {action.employeeCount?.toLocaleString() || ''} employees | {action.region}
                                  {accountOwner && <span> | Owner: {accountOwner}</span>}
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
                                      daysSinceLastEngagement <= 7 ? 'border-green-500 text-green-400' :
                                      daysSinceLastEngagement <= 30 ? 'border-yellow-500 text-yellow-400' :
                                      'border-red-500 text-red-400'
                                    }`}>
                                      {daysSinceLastEngagement}d since activity
                                    </Badge>
                                  )}
                                  {salesActivities > 0 && (
                                    <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                                      {salesActivities} activities
                                    </Badge>
                                  )}
                                  {opportunityStatus && (
                                    <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
                                      Opp: {opportunityStatus}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {vectorScores && (
                                <div className="text-right text-xs text-muted-foreground">
                                  <span className={tierColor}>Tier {vectorScores.tier}</span>
                                </div>
                              )}
                            </div>

                            {/* Primary Contact Highlight */}
                            {primaryContact && (
                              <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                <p className="text-sm">
                                  <span className="font-semibold text-purple-400">Contact:</span>{' '}
                                  <span className="font-medium">{primaryContact}</span>
                                </p>
                              </div>
                            )}

                            {/* Top Contacts */}
                            {action.topContacts && action.topContacts.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">
                                  Top Contacts ({action.contactCount}){keyContactsCount > 0 && ` • ${keyContactsCount} executives`}:
                                </p>
                                {action.topContacts.slice(0, 3).map((contact: any, idx: number) => (
                                  <p key={idx} className="text-sm">
                                    • <span className={`font-medium ${contact.isKeyTitle ? 'text-purple-400' : ''}`}>{contact.name}</span>
                                    {contact.title && <span className="text-muted-foreground"> - {contact.title}</span>}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Why Now with VECTOR context */}
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Why Now:</p>
                              <p className="text-sm text-foreground">{action.whyNow}</p>
                            </div>

                            {/* Next Best Action */}
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                              <p className="text-xs font-semibold text-primary mb-1">Next Best Action:</p>
                              <p className="text-sm text-foreground">{action.nextBestAction}</p>
                            </div>

                            {/* Engagement Metrics */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Last: {engagementMetrics?.lastCallFormatted || 'Never'}
                              </span>
                              {engagementMetrics?.daysSinceLastCall !== null && engagementMetrics?.daysSinceLastCall !== undefined && (
                                <Badge variant="outline" className={`text-xs ${
                                  engagementMetrics.daysSinceLastCall <= 7 ? 'border-green-500 text-green-500' :
                                  engagementMetrics.daysSinceLastCall <= 30 ? 'border-yellow-500 text-yellow-500' :
                                  'border-red-500 text-red-500'
                                }`}>
                                  {engagementMetrics.daysSinceLastCall}d ago
                                </Badge>
                              )}
                              <span>•</span>
                              <span>{engagementMetrics?.totalCalls || 0} calls</span>
                              <span>•</span>
                              <span>{action.contactCount} contacts</span>
                            </div>

                            {/* VECTOR Score Breakdown (compact) */}
                            {vectorScores && (
                              <div className="flex gap-2 text-xs">
                                <span className="px-2 py-0.5 bg-blue-500/20 rounded" title="Engagement">
                                  E:{vectorScores.engagement}
                                </span>
                                <span className="px-2 py-0.5 bg-green-500/20 rounded" title="Conversion">
                                  C:{vectorScores.conversion}
                                </span>
                                <span className="px-2 py-0.5 bg-purple-500/20 rounded" title="Strategic">
                                  S:{vectorScores.strategic}
                                </span>
                                <span className="px-2 py-0.5 bg-orange-500/20 rounded" title="Timing">
                                  T:{vectorScores.timing}
                                </span>
                              </div>
                            )}

                            {/* Action Button */}
                            <div>
                              <Button asChild variant="outline" size="sm" className="group-hover:border-primary group-hover:text-primary">
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
                  {topAccounts.slice(0, 5).map((account, index) => {
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
