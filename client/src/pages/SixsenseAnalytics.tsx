import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Target, 
  Eye, 
  Brain, 
  ShoppingCart, 
  CheckCircle,
  TrendingUp,
  Users,
  Activity,
  AlertTriangle,
  Clock,
  Zap
} from "lucide-react";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SixsenseAnalytics() {
  const { data: summary, isLoading: summaryLoading } = trpc.sixsenseAnalytics.getSummary.useQuery();
  const { data: buyingStages, isLoading: stagesLoading } = trpc.sixsenseAnalytics.getBuyingStages.useQuery();
  const { data: engagement, isLoading: engagementLoading } = trpc.sixsenseAnalytics.getEngagement.useQuery();
  const { data: keywords, isLoading: keywordsLoading } = trpc.sixsenseAnalytics.getKeywords.useQuery({ limit: 50 });
  const { data: performance, isLoading: perfLoading } = trpc.sixsenseAnalytics.get6QAPerformance.useQuery();

  const stageIcons: Record<string, React.ReactNode> = {
    Target: <Target className="w-4 h-4" />,
    Awareness: <Eye className="w-4 h-4" />,
    Consideration: <Brain className="w-4 h-4" />,
    Decision: <ShoppingCart className="w-4 h-4" />,
    Purchase: <CheckCircle className="w-4 h-4" />,
  };

  const stageColors: Record<string, string> = {
    Target: "bg-muted",
    Awareness: "bg-accent",
    Consideration: "bg-caution",
    Decision: "bg-caution",
    Purchase: "bg-positive",
  };

  const categoryColors: Record<string, string> = {
    product: "bg-accent-subtle text-accent border-accent/30",
    threat: "bg-critical-subtle text-critical border-critical/30",
    competitor: "bg-accent-subtle text-accent border-accent/30",
    compliance: "bg-caution-subtle text-caution border-caution/30",
    brand: "bg-positive-subtle text-positive border-positive/30",
    event: "bg-critical-subtle text-critical border-critical/30",
    general: "bg-muted text-ink-muted border-border",
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent/30"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">6sense Analytics</h1>
          <p className="text-muted-foreground">
            Intent signals and buying stage insights
            {summary?.dataAsOf && (
              <span className="ml-2 text-xs text-muted-foreground/60">
                (as of {formatDate(summary.dataAsOf)})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 6QA Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Total 6QAs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{summary?.sixQA?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Qualified accounts</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-positive" />
              Worked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-positive">{summary?.sixQA?.worked || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.sixQA?.workedPercent || 0}% of 6QAs
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-critical" />
              Unworked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-critical">{summary?.sixQA?.unworked || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {100 - (summary?.sixQA?.workedPercent || 0)}% opportunity gap
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-caution" />
              Decision + Purchase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-caution">
              {(summary?.buyingStages?.decision || 0) + (summary?.buyingStages?.purchase || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ready to buy</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="funnel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="funnel">Buying Funnel</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="keywords">Keywords</TabsTrigger>
          <TabsTrigger value="performance">6QA Performance</TabsTrigger>
        </TabsList>

        {/* Buying Funnel Tab */}
        <TabsContent value="funnel" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buying Stage Funnel</CardTitle>
              <CardDescription>
                {buyingStages?.timeframe || "Recent"} 
                {buyingStages?.dataAsOf && ` (as of ${formatDate(buyingStages.dataAsOf)})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {buyingStages?.stages?.map((stage) => {
                  const percentage = buyingStages.totalAccounts 
                    ? Math.round((stage.accounts / buyingStages.totalAccounts) * 100) 
                    : 0;
                  return (
                    <div key={stage.stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {stageIcons[stage.stage]}
                          <span className="font-medium">{stage.stage}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">{percentage}%</span>
                          <span className="font-bold w-16 text-right">{stage.accounts}</span>
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${stageColors[stage.stage]} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Accounts in Funnel</span>
                  <span className="font-bold">{buyingStages?.totalAccounts || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown</CardTitle>
              <CardDescription>
                {engagement?.timeWindow || "Recent"}
                {engagement?.dataAsOf && ` (as of ${formatDate(engagement.dataAsOf)})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {engagement?.metrics?.map((metric) => (
                  <div key={metric.state} className="p-4 rounded-sm bg-muted/50">
                    <div className="text-sm text-muted-foreground">{metric.state}</div>
                    <div className="text-2xl font-bold mt-1">{metric.accounts}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Engagement Insights */}
          <Card className="border-caution/30 bg-caution-subtle">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-caution">
                <AlertTriangle className="w-5 h-5" />
                Engagement Gap Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                <strong className="text-foreground">{summary?.engagement?.noEngagement || 0} accounts</strong> showing 
                intent signals have <strong className="text-critical">zero engagement</strong> with your marketing or sales. 
                These are warm prospects going cold.
              </p>
              <div className="mt-4 flex gap-2">
                <Badge variant="outline" className="border-caution/30 text-caution">
                  {summary?.engagement?.intent || 0} with intent
                </Badge>
                <Badge variant="outline" className="border-positive/30 text-positive">
                  {summary?.engagement?.knownEngagement || 0} engaged
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Intent Keywords</CardTitle>
              <CardDescription>
                Top keywords by account volume
                {keywords?.dataAsOf && ` (as of ${formatDate(keywords.dataAsOf)})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {keywords?.categories?.map((category) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      {category}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {keywords.byCategory?.[category]?.slice(0, 10).map((kw) => (
                        <Badge 
                          key={kw.keyword} 
                          variant="outline"
                          className={`${categoryColors[category] || categoryColors.general} cursor-default`}
                        >
                          {kw.keyword}
                          <span className="ml-2 opacity-60">{kw.totalAccounts}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Keywords Table */}
          <Card>
            <CardHeader>
              <CardTitle>Keyword Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Keyword</th>
                      <th className="text-right py-2 px-2">Accounts</th>
                      <th className="text-right py-2 px-2">Web Visits</th>
                      <th className="text-right py-2 px-2">6QAs</th>
                      <th className="text-right py-2 px-2">Opps</th>
                      <th className="text-left py-2 px-2">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keywords?.keywords?.slice(0, 20).map((kw) => (
                      <tr key={kw.keyword} className="border-b border-muted/50 hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">{kw.keyword}</td>
                        <td className="py-2 px-2 text-right">{kw.totalAccounts}</td>
                        <td className="py-2 px-2 text-right">{kw.accountsWithWebVisits}</td>
                        <td className="py-2 px-2 text-right">{kw.accountsWith6QA}</td>
                        <td className="py-2 px-2 text-right">{kw.accountsWithOpportunities}</td>
                        <td className="py-2 px-2">
                          <Badge 
                            variant="outline" 
                            className={categoryColors[kw.category || "general"]}
                          >
                            {kw.category}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6QA Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>6QA Performance Metrics</CardTitle>
              <CardDescription>
                Latest performance data
                {performance?.dataAsOf && ` (as of ${formatDate(performance.dataAsOf)})`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performance?.latest && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-sm bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="w-4 h-4" />
                      Avg Sales Activities
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {Number(performance.latest.avgSalesActivities || 0).toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">per worked account</p>
                  </div>

                  <div className="p-4 rounded-sm bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      Avg Contacts Reached
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {Number(performance.latest.avgContactsReached || 0).toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">per worked account</p>
                  </div>

                  <div className="p-4 rounded-sm bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Days to First Activity
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {Number(performance.latest.avgDaysToFirstActivity || 0).toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">average</p>
                  </div>

                  <div className="p-4 rounded-sm bg-muted/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      Days Since Last Activity
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      {Number(performance.latest.avgDaysSinceLastActivity || 0).toFixed(1)}
                    </div>
                    <p className="text-xs text-muted-foreground">average</p>
                  </div>
                </div>
              )}

              {/* Trend Chart Placeholder */}
              <div className="mt-6 pt-4 border-t">
                <h4 className="font-medium mb-4">6QA Trend (Last 10 Days)</h4>
                <div className="space-y-2">
                  {performance?.trend?.slice(-10).map((day) => (
                    <div key={String(day.day)} className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-24">
                        {new Date(day.day!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden flex">
                          <div 
                            className="h-full bg-positive"
                            style={{ width: `${((day.worked || 0) / (day.total6QAs || 1)) * 100}%` }}
                          />
                          <div 
                            className="h-full bg-critical"
                            style={{ width: `${((day.unworked || 0) / (day.total6QAs || 1)) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {day.worked}/{day.total6QAs}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-positive rounded" /> Worked
                  </span>
                  <span className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-critical rounded" /> Unworked
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
