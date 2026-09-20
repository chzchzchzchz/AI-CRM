import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataErrorBanner } from "@/components/ui/data-error-banner";
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

const CARD = "bg-card border-border shadow-none";

// Sequential cyan ramp: deeper cyan = closer to purchase. Signal-Cyan is the data voice.
const stageBar: Record<string, string> = {
  Target: "bg-surface-raised",
  Awareness: "bg-accent",
  Consideration: "bg-accent",
  Decision: "bg-accent",
  Purchase: "bg-accent",
};

export default function SixsenseAnalytics() {
  const { data: summary, isLoading: summaryLoading, error: summaryError } = trpc.sixsenseAnalytics.getSummary.useQuery();
  const { data: buyingStages, error: buyingStagesError } = trpc.sixsenseAnalytics.getBuyingStages.useQuery();
  const { data: engagement, error: engagementError } = trpc.sixsenseAnalytics.getEngagement.useQuery();
  const { data: keywords, error: keywordsError } = trpc.sixsenseAnalytics.getKeywords.useQuery({ limit: 50 });
  const { data: performance, error: performanceError } = trpc.sixsenseAnalytics.get6QAPerformance.useQuery();

  const stageIcons: Record<string, React.ReactNode> = {
    Target: <Target className="w-4 h-4 text-ink-muted" />,
    Awareness: <Eye className="w-4 h-4 text-ink-muted" />,
    Consideration: <Brain className="w-4 h-4 text-ink-muted" />,
    Decision: <ShoppingCart className="w-4 h-4 text-accent" />,
    Purchase: <CheckCircle className="w-4 h-4 text-accent" />,
  };

  if (summaryLoading) {
    return (
      <div>
        <div className="container py-1 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent/30" />
        </div>
      </div>
    );
  }

  const workedPct = summary?.sixQA?.workedPercent || 0;
  // With no qualified accounts there is no percentage — 0 of 0 is not 0%, and its
  // complement is not 100%. The server already guards the division and returns 0,
  // which this page rendered as "0% of 6QAs" beside "100% opportunity gap": a new
  // workspace was told it was missing every opportunity it had, of which there were
  // none. Neither figure is a fact until there is something to divide.
  const hasSixQA = (summary?.sixQA?.total || 0) > 0;

  return (
    <div>
      <div className="container py-1">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">6sense Analytics</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Intent signals and buying-stage insights, computed from live 6sense data.
            {summary?.dataAsOf && <span className="ml-1 text-ink-subtle">As of {formatDate(summary.dataAsOf)}.</span>}
          </p>
        </div>

        <DataErrorBanner
          errors={[summaryError, buyingStagesError, engagementError, keywordsError, performanceError]}
          message="Some 6sense analytics couldn't be loaded — the figures below may be incomplete, not actually zero."
        />

        {/* 6QA headline funnel row: total → worked → gap → ready-to-buy (tonal grid, no colored stripes) */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-px bg-muted rounded-sm overflow-hidden border border-border">
          <div className="bg-card p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
              <Zap className="h-3.5 w-3.5 text-accent" /> Total 6QAs
            </div>
            <div className="mt-2 tabular-nums text-2xl text-accent">{summary?.sixQA?.total || 0}</div>
            <div className="mt-1 text-xs text-ink-muted">qualified accounts</div>
          </div>
          <div className="bg-card p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
              <span aria-hidden className="text-positive">▲</span> Worked
            </div>
            <div className="mt-2 tabular-nums text-2xl text-positive">{summary?.sixQA?.worked || 0}</div>
            <div className="mt-1 text-xs text-ink-muted">
              {hasSixQA ? `${workedPct}% of 6QAs` : "no qualified accounts yet"}
            </div>
          </div>
          <div className="bg-card p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
              <span aria-hidden className="text-caution">●</span> Unworked gap
            </div>
            <div className="mt-2 tabular-nums text-2xl text-caution">{summary?.sixQA?.unworked || 0}</div>
            <div className="mt-1 text-xs text-ink-muted">
              {hasSixQA ? `${100 - workedPct}% opportunity gap` : "nothing to work yet"}
            </div>
          </div>
          <div className="bg-card p-4">
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
              <ShoppingCart className="h-3.5 w-3.5 text-accent" /> Decision + purchase
            </div>
            <div className="mt-2 tabular-nums text-2xl text-foreground">
              {(summary?.buyingStages?.decision || 0) + (summary?.buyingStages?.purchase || 0)}
            </div>
            <div className="mt-1 text-xs text-ink-muted">ready to buy</div>
          </div>
        </div>

        <Tabs defaultValue="funnel" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="funnel" className="gap-2 data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <Target className="h-4 w-4" /> Buying funnel
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2 data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <Activity className="h-4 w-4" /> Engagement
            </TabsTrigger>
            <TabsTrigger value="keywords" className="gap-2 data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <Hash className="h-4 w-4" /> Keywords
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2 data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <BarChart3 className="h-4 w-4" /> 6QA performance
            </TabsTrigger>
          </TabsList>

          {/* Buying Funnel Tab */}
          <TabsContent value="funnel" className="space-y-4">
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                  <Target className="h-4 w-4 text-accent" />
                  Buying-stage funnel
                </CardTitle>
                <CardDescription className="text-ink-muted">
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
                          <div className="flex flex-wrap items-center gap-2">
                            {stageIcons[stage.stage]}
                            <span className="text-sm text-ink-muted">{stage.stage}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="tabular-nums text-xs text-ink-muted">{percentage}%</span>
                            <span className="tabular-nums text-sm text-foreground w-12 text-right">{stage.accounts}</span>
                          </div>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${stageBar[stage.stage] || "bg-surface-raised"} rounded-sm motion-safe:transition-all motion-safe:duration-500`}
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-sm text-ink-muted">Total accounts in funnel</span>
                  <span className="tabular-nums text-2xl text-foreground">{buyingStages?.totalAccounts || 0}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="space-y-6">
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                  <Activity className="h-4 w-4 text-accent" />
                  Engagement breakdown
                </CardTitle>
                <CardDescription className="text-ink-muted">
                  {engagement?.timeWindow || "Recent"}
                  {engagement?.dataAsOf && ` · as of ${formatDate(engagement.dataAsOf)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {engagement?.metrics?.map((metric) => (
                    <div key={metric.state} className="p-4 rounded-sm bg-muted border border-border">
                      <div className="text-xs text-ink-muted">{metric.state}</div>
                      <div className="mt-1 tabular-nums text-2xl text-foreground">{metric.accounts}</div>
                    </div>
                  ))}
                  {(!engagement?.metrics || engagement.metrics.length === 0) && (
                    <div className="col-span-full py-8 text-center text-sm text-ink-muted">No engagement data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Engagement Gap Alert — amber tint, 1px border (no accent stripe), glyph + word */}
            <div className="rounded-sm bg-caution/[0.08] border border-caution/30 p-4">
              <div className="flex flex-wrap items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-caution" />
                <div>
                  <div className="text-sm font-medium text-caution flex flex-wrap items-center gap-1.5">
                    <span aria-hidden>●</span> Engagement gap
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {/* "showing intent signals, zero engagement" describes the Intent bucket
                        (intentScore >= 40, no contacts/calls/opps) — not noEngagement, which
                        is the opposite population (intentScore < 40 AND no engagement).
                        Confirmed live: intent=19, noEngagement=114, and none of the 114
                        show intent — this line was citing a bucket that means the reverse
                        of the sentence describing it. */}
                    <span className="tabular-nums text-foreground">{summary?.engagement?.intent || 0}</span> accounts
                    showing intent signals have zero engagement with marketing or sales — warm prospects going cold.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-border-strong text-ink-muted tabular-nums">
                      {summary?.engagement?.intent || 0} with intent
                    </Badge>
                    <Badge variant="outline" className="border-positive/30 text-positive tabular-nums">
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
                <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                  <Hash className="h-4 w-4 text-accent" />
                  Intent keywords
                </CardTitle>
                <CardDescription className="text-ink-muted">
                  Top keywords by account volume
                  {keywords?.dataAsOf && ` · as of ${formatDate(keywords.dataAsOf)}`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {keywords?.categories?.map((category) => (
                    <div key={category}>
                      <h3 className="mb-3 text-sm font-semibold text-foreground capitalize">{category}</h3>
                      <div className="flex flex-wrap gap-2">
                        {keywords.byCategory?.[category]?.slice(0, 10).map((kw) => (
                          <span
                            key={kw.keyword}
                            className="inline-flex items-center gap-2 rounded-sm bg-muted border border-border-strong px-3 py-1 text-sm text-foreground"
                          >
                            {kw.keyword}
                            <span className="tabular-nums text-xs text-accent">{kw.totalAccounts}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(!keywords?.categories || keywords.categories.length === 0) && (
                    <div className="py-8 text-center text-sm text-ink-muted">No keyword data available</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Keyword Performance Table */}
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-base text-foreground">Keyword performance</CardTitle>
                <CardDescription className="text-ink-muted">Web visits, 6QAs and opportunities per keyword</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-3 text-xs font-semibold tracking-wide text-ink-muted">Keyword</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-ink-muted">Accounts</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-ink-muted">Web visits</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-ink-muted">6QAs</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold tracking-wide text-ink-muted">Opps</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold tracking-wide text-ink-muted">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords?.keywords?.slice(0, 20).map((kw) => (
                        <tr key={kw.keyword} className="border-b border-border hover:bg-muted transition-colors">
                          <td className="py-3 px-3 font-medium text-foreground">{kw.keyword}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-ink-muted">{kw.totalAccounts}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-accent">{kw.accountsWithWebVisits}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-positive">{kw.accountsWith6QA}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-caution">{kw.accountsWithOpportunities}</td>
                          <td className="py-3 px-3">
                            <Badge variant="outline" className="border-border-strong text-ink-muted capitalize">
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
                <CardTitle className="text-base text-foreground">6QA performance metrics</CardTitle>
                <CardDescription className="text-ink-muted">
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
                        <div key={m.label} className="p-4 rounded-sm bg-muted border border-border">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                            <Icon className="h-3.5 w-3.5" /> {m.label}
                          </div>
                          <div className="mt-1 tabular-nums text-2xl text-foreground">
                            {/* avgDaysToFirstActivity/avgDaysSinceLastActivity are genuinely
                                null (server/sixsense-analytics.ts never computes them) rather
                                than zero — `m.value || 0` treated "not computed" the same as
                                "zero days", rendering a confident "0.0" for a figure that was
                                never measured. Insights.tsx already renders these same two
                                fields correctly with `?? "—"`; this tile grid just didn't. */}
                            {m.value == null ? "—" : Number(m.value).toFixed(1)}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-muted">{m.note}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 6QA Trend */}
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="mb-4 text-sm font-semibold text-foreground">6QA trend · last 10 days</h4>
                  {/* server/sixsense-analytics.ts compute6QA only ever knows the CURRENT
                      worked/unworked split — whether an account has a contact, call or
                      opportunity today. It has no timestamped history of when an account
                      became "worked", so every trend day's worked/unworked was hardcoded
                      null. This rendered as a worked/unworked bar permanently pinned at
                      0%/0% and a ratio with no numerator ("/25", "/31") for all 10 days —
                      a chart implying a daily breakdown this dataset cannot actually
                      support. Showing the real total per day, with no fabricated split,
                      is the honest version of this chart. */}
                  <div className="space-y-2">
                    {performance?.trend?.slice(-10).map((day) => {
                      const maxTotal = Math.max(1, ...(performance.trend ?? []).slice(-10).map((d) => d.total6QAs || 0));
                      return (
                        <div key={String(day.day)} className="flex flex-wrap items-center gap-4">
                          <span className="w-24 tabular-nums text-xs text-ink-muted">
                            {/* day.day is a bare "YYYY-MM-DD" with no time component.
                                new Date(str) parses that as UTC midnight, so
                                toLocaleDateString() in any timezone west of UTC (all of
                                the Americas) rendered the day BEFORE the one the data
                                actually named — confirmed live: the API's last trend day
                                "2026-07-17" rendered as "Jul 16". Formatting in UTC
                                sidesteps the viewer's timezone entirely instead of
                                guessing at it. */}
                            {new Date(`${day.day}T00:00:00Z`).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                          </span>
                          <div className="flex-1 flex flex-wrap items-center gap-2">
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden flex">
                              <div
                                className="h-full bg-accent"
                                style={{ width: `${((day.total6QAs || 0) / maxTotal) * 100}%` }}
                              />
                            </div>
                            <span className="w-10 text-right tabular-nums text-xs text-ink-muted">
                              {day.total6QAs}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-muted">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span aria-hidden className="text-accent">●</span> 6QAs that day
                    </span>
                    <span>Worked/unworked is only known for the current snapshot, shown above.</span>
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
