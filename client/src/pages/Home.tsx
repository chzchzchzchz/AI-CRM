import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Mail, Linkedin, Phone, TrendingUp, Building2, Users, Flame, Zap, ArrowRight, Sparkles, Target, Calendar } from "lucide-react";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * War Room Dashboard - Beautiful modern redesign
 * Daily command center for sales reps with stunning visuals
 */
export default function Home() {
  // const { user, loading, isAuthenticated } = useAuth(); // Disabled - no auth required
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  const { data: enrichedPriorityActions, isLoading: priorityLoading } = trpc.priorityActions.getEnriched.useQuery({ limit: 3 });
  // Warm leads now calculated on server with engagement + calls data
  const { data: stats } = trpc.accounts.getStats.useQuery();

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

  // Authentication disabled - direct access

  // Process accounts data
  const topAccounts = accounts
    ?.map(a => ({
      ...a,
      intentScoreNum: parseInt(String(a.intentScore || 0), 10)
    }))
    .sort((a, b) => b.intentScoreNum - a.intentScoreNum)
    .slice(0, 15) || [];

  const hotLeads = accounts?.filter(a => parseInt(String(a.intentScore || 0)) >= 70).length || 0;
  // Warm leads = engagement + intent 70+ + previous calls (calculated on server)
  const warmLeads = stats?.warmLeads || 0;

  // Use enriched priority actions with contact data
  const priorityActions = (enrichedPriorityActions || []).map((action, index) => ({
    ...action,
    priority: index === 0 ? "critical" : index === 1 ? "high" : "medium",
    icon: index === 0 ? Flame : index === 1 ? Zap : Linkedin,
    gradient: index === 0 ? "from-red-600 to-orange-600" : index === 1 ? "from-amber-600 to-yellow-600" : "from-blue-600 to-cyan-600",
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Disclaimer Banner */}
      <Alert className="m-4 border-amber-500/30 bg-amber-500/5 backdrop-blur-sm">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-600 dark:text-amber-400 text-sm">
          <strong>Demo/WIP:</strong> Work-in-progress demo. Some features are stubbed.{" "}
          <a 
            href="https://docs.google.com/document/d/1Brbe8bHVwklhSGbPUQG6ymXxonRVyYTCHnxy0UlDjdM/edit?tab=t.0"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-300"
          >
            View Known Issues
          </a>
        </AlertDescription>
      </Alert>

      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Hero Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-bold tracking-tight">
                Good morning 👋
              </h1>
              <p className="text-muted-foreground text-lg mt-1">
                Here's your sales intelligence for today
              </p>
            </div>
          </div>
        </div>

        {/* Key Stats - Beautiful Cards - All Clickable */}
        <div className="grid gap-6 md:grid-cols-4">
          <Link href="/accounts">
            <Card className="card-elevated border-l-4 border-l-indigo-500 cursor-pointer hover:scale-[1.02] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
                <Building2 className="h-5 w-5 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{accounts?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all territories</p>
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
                <p className="text-xs text-muted-foreground mt-1">Engaged accounts</p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/accounts?filter=intent-spikes">
            <Card className="card-elevated border-l-4 border-l-purple-500 cursor-pointer hover:scale-[1.02] transition-transform">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Intent Spikes</CardTitle>
                <Zap className="h-5 w-5 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">12</div>
                <p className="text-xs text-muted-foreground mt-1">20+ point jumps this week</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Priority Actions & Tasks */}
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
                  return (
                    <Card key={action.id} className="card-elevated hover:scale-[1.01] transition-transform cursor-pointer group">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className={`p-3 bg-gradient-to-br ${action.gradient} rounded-xl shadow-lg group-hover:shadow-xl transition-shadow`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            {/* Account Header */}
                            <div>
                              <h3 className="font-semibold text-lg mb-1">ENGAGE {action.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                Intent: {action.intentScore} | {action.industry} | {action.employeeCount?.toLocaleString()} employees | {action.region}
                              </p>
                            </div>

                            {/* Top Contacts */}
                            {action.topContacts && action.topContacts.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-semibold text-muted-foreground uppercase">Top Contacts ({action.contactCount}):</p>
                                {action.topContacts.map((contact: any, idx: number) => (
                                  <p key={idx} className="text-sm">
                                    • <span className="font-medium">{contact.name}</span> - {contact.title}
                                  </p>
                                ))}
                              </div>
                            )}

                            {/* Why Now */}
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Why Now:</p>
                              <p className="text-sm text-foreground">{action.whyNow}</p>
                            </div>

                            {/* Next Best Action */}
                            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                              <p className="text-xs font-semibold text-primary mb-1">Next Best Action:</p>
                              <p className="text-sm text-foreground">{action.nextBestAction}</p>
                            </div>

                            {/* Activity Stats */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Last Activity: {action.callCount > 0 && action.lastCallDate ? new Date(action.lastCallDate).toLocaleDateString() : 'No calls recorded'}</span>
                              <span>•</span>
                              <span>{action.contactCount} contacts identified</span>
                            </div>

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
                    Follow up with hot leads from last week (5 accounts)
                  </label>
                </div>
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task2" className="mt-1" />
                  <label htmlFor="task2" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Review new intent spikes (12 accounts)
                  </label>
                </div>
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task3" className="mt-1" />
                  <label htmlFor="task3" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Update CRM with latest activities
                  </label>
                </div>
                <div className="flex items-start gap-3 group">
                  <Checkbox id="task4" className="mt-1" />
                  <label htmlFor="task4" className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-primary transition-colors">
                    Schedule demos for warm leads (3 accounts)
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>Common workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild variant="outline" className="w-full justify-start h-auto py-4 hover:border-primary hover:bg-primary/5">
                  <Link href="/outreach">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                        <Mail className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Generate Outreach</div>
                        <div className="text-xs text-muted-foreground">AI-powered email drafts</div>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start h-auto py-4 hover:border-primary hover:bg-primary/5">
                  <Link href="/calls">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-lg">
                        <Phone className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">Review Gong Calls</div>
                        <div className="text-xs text-muted-foreground">Latest conversations</div>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button asChild variant="outline" className="w-full justify-start h-auto py-4 hover:border-primary hover:bg-primary/5">
                  <Link href="/insights">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold">View Analytics</div>
                        <div className="text-xs text-muted-foreground">Pipeline insights</div>
                      </div>
                    </div>
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
