import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BarChart3, LineChart, PieChart, TrendingUp, Plus, Settings, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ChartType = "bar" | "line" | "pie" | "scatter";
type Metric = "accounts" | "calls" | "contacts" | "intent";
type Dimension = "industry" | "region" | "buyingStage" | "intentScore";

interface CustomChart {
  id: string;
  title: string;
  type: ChartType;
  metric: Metric;
  dimension: Dimension;
}

export default function Insights() {
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: calls } = trpc.gong.list.useQuery();
  const { data: contacts } = trpc.people.list.useQuery();

  const [customCharts, setCustomCharts] = useState<CustomChart[]>([]);
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [drillDownData, setDrillDownData] = useState<any>(null);

  // Chart builder state
  const [newChartType, setNewChartType] = useState<ChartType>("bar");
  const [newChartMetric, setNewChartMetric] = useState<Metric>("accounts");
  const [newChartDimension, setNewChartDimension] = useState<Dimension>("industry");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const addCustomChart = () => {
    const newChart: CustomChart = {
      id: `chart-${Date.now()}`,
      title: `${newChartMetric} by ${newChartDimension}`,
      type: newChartType,
      metric: newChartMetric,
      dimension: newChartDimension,
    };
    setCustomCharts([...customCharts, newChart]);
  };

  const handleDrillDown = (chartId: string, dataPoint: any) => {
    setSelectedChart(chartId);
    setDrillDownData(dataPoint);
  };



  // Calculate metrics
  const totalAccounts = accounts?.length || 0;
  const totalCalls = calls?.length || 0;
  const totalContacts = contacts?.length || 0;
  const avgIntent = accounts && totalAccounts > 0 ? accounts.reduce((sum: number, a: any) => sum + (Number(a.intentScore) || 0), 0) / totalAccounts : 0;

  // Group by industry
  const industryData = accounts?.reduce((acc: Record<string, number>, account: any) => {
    const industry = account.industry || "Unknown";
    acc[industry] = (acc[industry] || 0) + 1;
    return acc;
  }, {}) || {};

  // Group by region
  const regionData = accounts?.reduce((acc: Record<string, number>, account: any) => {
    const region = account.region || "Unknown";
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {}) || {};

  // Intent distribution
  const intentBuckets = { hot: 0, warm: 0, cold: 0 };
  accounts?.forEach((a: any) => {
    const score = Number(a.intentScore) || 0;
    if (score >= 70) intentBuckets.hot++;
    else if (score >= 40) intentBuckets.warm++;
    else intentBuckets.cold++;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <div className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Data Analytics Studio</h1>
            <p className="text-slate-400">Interactive data exploration and custom visualizations</p>
          </div>

        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="builder">Chart Builder</TabsTrigger>
            <TabsTrigger value="custom">Custom Dashboards</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="card-elevated border-l-4 border-l-cyan-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-cyan-400">Total Accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{totalAccounts}</div>
                  <p className="text-xs text-slate-400 mt-1">Across all segments</p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-400">Key Contacts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{totalContacts}</div>
                  <p className="text-xs text-slate-400 mt-1">Decision makers</p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-400">Total Calls</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{totalCalls}</div>
                  <p className="text-xs text-slate-400 mt-1">Gong recordings</p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-yellow-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-400">Avg Intent Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{avgIntent.toFixed(0)}</div>
                  <p className="text-xs text-slate-400 mt-1">Buying intent level</p>
                </CardContent>
              </Card>
            </div>

            {/* Interactive Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Intent Distribution */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-400" />
                    Intent Score Distribution
                  </CardTitle>
                  <CardDescription>Click segments to drill down</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <button
                      onClick={() => handleDrillDown("intent", { segment: "hot", count: intentBuckets.hot })}
                      className="w-full text-left p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-green-400 font-medium">Hot Leads (70+)</span>
                        <span className="text-2xl font-bold text-white">{intentBuckets.hot}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${(intentBuckets.hot / totalAccounts) * 100}%` }}
                        />
                      </div>
                    </button>

                    <button
                      onClick={() => handleDrillDown("intent", { segment: "warm", count: intentBuckets.warm })}
                      className="w-full text-left p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-yellow-400 font-medium">Warm Leads (40-69)</span>
                        <span className="text-2xl font-bold text-white">{intentBuckets.warm}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-500"
                          style={{ width: `${(intentBuckets.warm / totalAccounts) * 100}%` }}
                        />
                      </div>
                    </button>

                    <button
                      onClick={() => handleDrillDown("intent", { segment: "cold", count: intentBuckets.cold })}
                      className="w-full text-left p-4 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-orange-400 font-medium">Cold Leads (&lt;40)</span>
                        <span className="text-2xl font-bold text-white">{intentBuckets.cold}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-500"
                          style={{ width: `${(intentBuckets.cold / totalAccounts) * 100}%` }}
                        />
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Top Industries */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-cyan-400" />
                    Top Industries
                  </CardTitle>
                  <CardDescription>Click bars to see accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(industryData)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([industry, count]) => (
                        <button
                          key={industry}
                          onClick={() => handleDrillDown("industry", { industry, count })}
                          className="w-full text-left group"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                              {industry}
                            </span>
                            <span className="text-sm font-semibold text-white">{count as number}</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:from-cyan-400 group-hover:to-blue-400 transition-colors"
                              style={{ width: `${((count as number) / totalAccounts) * 100}%` }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Top Regions */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-cyan-400" />
                    Geographic Distribution
                  </CardTitle>
                  <CardDescription>Click regions to explore</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(regionData)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 5)
                      .map(([region, count]) => (
                        <button
                          key={region}
                          onClick={() => handleDrillDown("region", { region, count })}
                          className="w-full text-left group"
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                              {region}
                            </span>
                            <span className="text-sm font-semibold text-white">{count as number}</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 group-hover:from-purple-400 group-hover:to-pink-400 transition-colors"
                              style={{ width: `${((count as number) / totalAccounts) * 100}%` }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Drill-down Panel */}
              {drillDownData && (
                <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="text-white">Drill-Down View</CardTitle>
                    <CardDescription>Detailed breakdown of selected segment</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-slate-300">
                        <span className="font-semibold text-cyan-400">Selected:</span>{" "}
                        {drillDownData.segment || drillDownData.industry || drillDownData.region}
                      </p>
                      <p className="text-slate-300">
                        <span className="font-semibold text-cyan-400">Count:</span> {drillDownData.count} accounts
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDrillDownData(null)}
                        className="mt-4"
                      >
                        Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="builder" className="space-y-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-cyan-400" />
                  Custom Chart Builder
                </CardTitle>
                <CardDescription>Drag and drop fields to create custom visualizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Chart Type</label>
                    <Select value={newChartType} onValueChange={(v) => setNewChartType(v as ChartType)}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bar">Bar Chart</SelectItem>
                        <SelectItem value="line">Line Chart</SelectItem>
                        <SelectItem value="pie">Pie Chart</SelectItem>
                        <SelectItem value="scatter">Scatter Plot</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Metric</label>
                    <Select value={newChartMetric} onValueChange={(v) => setNewChartMetric(v as Metric)}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="accounts">Accounts</SelectItem>
                        <SelectItem value="calls">Calls</SelectItem>
                        <SelectItem value="contacts">Contacts</SelectItem>
                        <SelectItem value="intent">Intent Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-300 mb-2 block">Dimension</label>
                    <Select value={newChartDimension} onValueChange={(v) => setNewChartDimension(v as Dimension)}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industry">Industry</SelectItem>
                        <SelectItem value="region">Region</SelectItem>
                        <SelectItem value="buyingStage">Buying Stage</SelectItem>
                        <SelectItem value="intentScore">Intent Score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={addCustomChart} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                  <Plus className="h-4 w-4" />
                  Add Chart
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="custom" className="space-y-6">
            {customCharts.length === 0 ? (
              <Card className="card-elevated">
                <CardContent className="py-12 text-center">
                  <p className="text-slate-400">No custom charts yet. Use the Chart Builder to create one.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {customCharts.map((chart) => (
                  <Card key={chart.id} className="card-elevated">
                    <CardHeader>
                      <CardTitle className="text-white">{chart.title}</CardTitle>
                      <CardDescription>
                        {chart.type} chart showing {chart.metric} by {chart.dimension}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 space-y-2">
                        {(() => {
                          let data: Record<string, number> = {};
                          
                          if (chart.dimension === 'industry') {
                            data = industryData;
                          } else if (chart.dimension === 'region') {
                            data = regionData;
                          } else if (chart.dimension === 'intentScore') {
                            data = { 'Hot (70+)': intentBuckets.hot, 'Warm (40-69)': intentBuckets.warm, 'Cold (<40)': intentBuckets.cold };
                          }
                          
                          const maxValue = Math.max(...Object.values(data));
                          
                          return Object.entries(data)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 10)
                            .map(([label, value]) => (
                              <div key={label} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-300">{label}</span>
                                  <span className="text-white font-semibold">{value}</span>
                                </div>
                                <div className="h-6 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                    style={{ width: `${(value / maxValue) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ));
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
