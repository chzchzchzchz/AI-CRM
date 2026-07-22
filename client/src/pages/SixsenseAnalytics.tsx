import { trpc } from "@/lib/trpc";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target,
  Eye,
  Brain,
  ShoppingCart,
  CheckCircle,
  Activity,
  Users,
  AlertTriangle,
  Clock,
  Hash,
  BarChart3,
  Zap,
} from "lucide-react";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "Unknown";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const CARD = "bg-slate-900 border-slate-800 shadow-none";

// Sequential cyan ramp: deeper cyan = closer to purchase. Signal-Cyan is the data voice.
const stageBar: Record<string, string> = {
  Target: "bg-slate-600",
  Awareness: "bg-cyan-900",
  Consideration: "bg-cyan-700",
  Decision: "bg-cyan-500",
  Purchase: "bg-cyan-300",
};

export default function SixsenseAnalytics() {
  const { data: summary, isLoading: summaryLoading } = trpc.sixsenseAnalytics.getSummary.useQuery();
  const { data: buyingStages } = trpc.sixsenseAnalytics.getBuyingStages.useQuery();
  const { data: engagement } = trpc.sixsenseAnalytics.getEngagement.useQuery();
  const { data: keywords } = trpc.sixsenseAnalytics.getKeywords.useQuery({ limit: 50 });
  const { data: performance } = trpc.sixsenseAnalytics.get6QAPerformance.useQuery();

  const stageIcons: Record<string, React.ReactNode> = {
    Target: <Target className="w-4 h-4 text-slate-400" />,
    Awareness: <Eye className="w-4 h-4 text-slate-400" />,
    Consideration: <Brain className="w-4 h-4 text-slate-400" />,
    Decision: <ShoppingCart className="w-4 h-4 text-cyan-400" />,
    Purchase: <CheckCircle className="w-4 h-4 text-cyan-300" />,
  };

  if (summaryLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-8 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
        </div>
      </div>
    );
  }

  const workedPct = summary?.sixQA?.workedPercent || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">6sense Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Intent signals and buying-stage insights, computed from live 6sense data.
            {summary?.dataAsOf && <span className="ml-1 text-slate-500">As of {formatDate(summary.dataAsOf)}.</span>}
          </p>
        </div>

        {/* 6QA headline funnel row: total → worked → gap → ready-to-buy (tonal grid, no colored stripes) */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800 rounded-lg overflow-hidden border border-slate-800">
          <div className="bg-slate-900 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
              <Zap className="h-3.5 w-3.5 text-cyan-400" /> Total 6QAs
            </div>
            <div className="mt-2 font-mono tabular-nums text-3xl text-cyan-400">{summary?.sixQA?.total || 0}</div>
            <div className="mt-1 text-xs text-slate-400">qualified accounts</div>
          </div>
          <div className="bg-slate-900 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
              <span aria-hidden className="text-emerald-400">▲</span> Worked
            </div>
            <div className="mt-2 font-mono tabular-nums text-3xl text-emerald-400">{summary?.sixQA?.worked || 0}</div>
            <div className="mt-1 text-xs text-slate-400">{workedPct}% of 6QAs</div>
          </div>
          <div className="bg-slate-900 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
              <span aria-hidden className="text-amber-400">●</span> Unworked gap
            </div>
            <div className="mt-2 font-mono tabular-nums text-3xl text-amber-400">{summary?.sixQA?.unworked || 0}</div>
            <div className="mt-1 text-xs text-slate-400">{100 - workedPct}% opportunity gap</div>
          </div>
          <div className="bg-slate-900 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
              <ShoppingCart className="h-3.5 w-3.5 text-cyan-400" /> Decision + purchase
            </div>
            <div className="mt-2 font-mono tabular-nums text-3xl text-slate-100">
              {(summary?.buyingStages?.decision || 0) + (summary?.buyingStages?.purchase || 0)}
            </div>
            <div className="mt-1 text-xs text-slate-400">ready to buy</div>
          </div>
        </div>

        <Tabs defaultValue="funnel" className="space-y-6">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="funnel" className="gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <Target className="h-4 w-4" /> Buying funnel
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <Activity className="h-4 w-4" /> Engagement
            </TabsTrigger>
            <TabsTrigger value="keywords" className="gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <Hash className="h-4 w-4" /> Keywords
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2 data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <BarChart3 className="h-4 w-4" /> 6QA performance
            </TabsTrigger>
          </TabsList>

          {/* Buying Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-100">
                  <Target className="h-4 w-4 text-cyan-400" />
                  Buying-stage funnel
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {buyingStages?.timeframe || "Recent"}
                  {buyingStages?.dataAsOf && ` · as of ${formatDate(buyingStages.dataAsOf)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {buyingStages?.stages?.map((stage) => {
                    const percentage = buyingStages.totalAccounts
                      ? Math.round((stage.accounts / buyingStages.totalAccounts) * 100)
                      : 0;
                    return (
                      <div key={stage.stage}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {stageIcons[stage.stage]}
                            <span className="text-sm text-slate-300">{stage.stage}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono tabular-nums text-xs text-slate-400">{percentage}%</span>
                            <span className="font-mono tabular-nums text-sm text-slate-100 w-12 text-right">{stage.accounts}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${stageBar[stage.stage] || "bg-slate-600"} rounded-full motion-safe:transition-all motion-safe:duration-500`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-sm text-slate-400">Total accounts in funnel</span>
                  <span className="font-mono tabular-nums text-2xl text-slate-100">{buyingStages?.totalAccounts || 0}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-100">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  Engagement breakdown
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {engagement?.timeWindow || "Recent"}
                  {engagement?.dataAsOf && ` · as of ${formatDate(engagement.dataAsOf)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {engagement?.metrics?.map((metric) => (
                    <div key={metric.state} className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
                      <div className="text-xs text-slate-400">{metric.state}</div>
                      <div className="mt-1 font-mono tabular-nums text-2xl text-slate-100">{metric.accounts}</div>
                    </div>
                  ))}
                  {(!engagement?.metrics || engagement.metrics.length === 0) && (
                    <div className="col-span-full py-8 text-center text-sm text-slate-400">No engagement data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Engagement Gap Alert — amber tint, 1px border (no accent stripe), glyph + word */}
            <div className="rounded-lg bg-amber-500/[0.08] border border-amber-500/25 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
                <div>
                  <div className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                    <span aria-hidden>●</span> Engagement gap
                  </div>
                  <p className="mt-1 text-sm text-slate-300">
                    <span className="font-mono tabular-nums text-slate-100">{summary?.engagement?.noEngagement || 0}</span> accounts
                    showing intent signals have zero engagement with marketing or sales — warm prospects going cold.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-700 text-slate-300 font-mono tabular-nums">
                      {summary?.engagement?.intent || 0} with intent
                    </Badge>
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 font-mono tabular-nums">
                      {summary?.engagement?.knownEngagement || 0} engaged
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="space-y-6">
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-slate-100">
                  <Hash className="h-4 w-4 text-cyan-400" />
                  Intent keywords
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Top keywords by account volume
                  {keywords?.dataAsOf && ` · as of ${formatDate(keywords.dataAsOf)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {keywords?.categories?.map((category) => (
                    <div key={category}>
                      <h3 className="mb-3 text-sm font-semibold text-slate-200 capitalize">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {keywords.byCategory?.[category]?.slice(0, 10).map((kw) => (
                          <span
                            key={kw.keyword}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-sm text-slate-200"
                          >
                            {kw.keyword}
                            <span className="font-mono tabular-nums text-xs text-cyan-400">{kw.totalAccounts}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(!keywords?.categories || keywords.categories.length === 0) && (
                    <div className="py-8 text-center text-sm text-slate-400">No keyword data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Keyword Performance Table */}
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base text-slate-100">Keyword performance</CardTitle>
                <CardDescription className="text-slate-400">Web visits, 6QAs and opportunities per keyword</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-3 text-xs font-semibold tracking-wide text-slate-400">Keyword</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-slate-400">Accounts</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-slate-400">Web visits</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-slate-400">6QAs</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-slate-400">Opps</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold tracking-wide text-slate-400">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords?.keywords?.slice(0, 20).map((kw) => (
                        <tr key={kw.keyword} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-3 font-medium text-slate-100">{kw.keyword}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-300">{kw.totalAccounts}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-cyan-400">{kw.accountsWithWebVisits}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-400">{kw.accountsWith6QA}</td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-400">{kw.accountsWithOpportunities}</td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">
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
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base text-slate-100">6QA performance metrics</CardTitle>
                <CardDescription className="text-slate-400">
                  Latest performance data
                  {performance?.dataAsOf && ` · as of ${formatDate(performance.dataAsOf)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {performance?.latest && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { icon: Activity, label: "Avg sales activities", value: performance.latest.avgSalesActivities, note: "per worked account" },
                      { icon: Users, label: "Avg contacts reached", value: performance.latest.avgContactsReached, note: "per worked account" },
                      { icon: Clock, label: "Days to first activity", value: performance.latest.avgDaysToFirstActivity, note: "average" },
                      { icon: Clock, label: "Days since last activity", value: performance.latest.avgDaysSinceLastActivity, note: "average" },
                    ].map((m) => {
                      const Icon = m.icon;
                      return (
                        <div key={m.label} className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Icon className="h-3.5 w-3.5" /> {m.label}
                          </div>
                          <div className="mt-1 font-mono tabular-nums text-2xl text-slate-100">
                            {Number(m.value || 0).toFixed(1)}
                          </div>
                          <div className="mt-0.5 text-xs text-slate-400">{m.note}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 6QA Trend */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <h4 className="mb-4 text-sm font-semibold text-slate-200">6QA trend · last 10 days</h4>
                  <div className="space-y-2">
                    {performance?.trend?.slice(-10).map((day) => (
                      <div key={String(day.day)} className="flex items-center gap-4">
                        <span className="w-24 font-mono tabular-nums text-xs text-slate-400">
                          {new Date(day.day!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <div className="flex-1 flex items-center gap-2">
                          <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden flex">
                            <div className="h-full bg-emerald-500" style={{ width: `${((day.worked || 0) / (day.total6QAs || 1)) * 100}%` }} />
                            <div className="h-full bg-amber-500/60" style={{ width: `${((day.unworked || 0) / (day.total6QAs || 1)) * 100}%` }} />
                          </div>
                          <span className="w-16 text-right font-mono tabular-nums text-xs text-slate-400">
                            {day.worked}/{day.total6QAs}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="text-emerald-400">▲</span> Worked
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden className="text-amber-400">●</span> Unworked
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
