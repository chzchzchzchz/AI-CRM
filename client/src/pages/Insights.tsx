import { useState, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, PieChart, TrendingUp, Loader2, Building2, Users, MapPin, Flame, X, ExternalLink, Filter, RefreshCw, Search, Target, Activity, Zap, Hash, ArrowUpRight, ArrowDownRight, Minus, Eye, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import { ContextualAI } from "@/components/ContextualAI";

type FilterType = "intent" | "industry" | "region" | "buyingStage" | "keyword" | null;

interface ActiveFilter {
  type: FilterType;
  value: string;
  label: string;
}

export default function Insights() {
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: calls } = trpc.gong.list.useQuery();
  const { data: contacts } = trpc.people.list.useQuery();
  const { data: keywords } = trpc.sixsenseAnalytics.getKeywords.useQuery({ limit: 50 });
  const { data: engagement } = trpc.sixsenseAnalytics.getEngagement.useQuery();
  const { data: buyingStages } = trpc.sixsenseAnalytics.getBuyingStages.useQuery();
  const { data: sixQAPerformance } = trpc.sixsenseAnalytics.get6QAPerformance.useQuery();

  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [keywordSearch, setKeywordSearch] = useState("");

  // Calculate metrics
  const totalAccounts = accounts?.length || 0;
  const totalCalls = calls?.length || 0;
  const totalContacts = contacts?.length || 0;
  const avgIntent = accounts && totalAccounts > 0 
    ? accounts.reduce((sum, a) => sum + (Number(a.intentScore) || 0), 0) / totalAccounts 
    : 0;

  // Group by industry
  const industryData = useMemo(() => {
    return accounts?.reduce((acc: Record<string, number>, account) => {
      const industry = account.industry || "Unknown";
      acc[industry] = (acc[industry] || 0) + 1;
      return acc;
    }, {}) || {};
  }, [accounts]);

  // Group by region
  const regionData = useMemo(() => {
    return accounts?.reduce((acc: Record<string, number>, account) => {
      const region = account.region || "Unknown";
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {}) || {};
  }, [accounts]);

  // Group by buying stage
  const buyingStageData = useMemo(() => {
    return accounts?.reduce((acc: Record<string, number>, account) => {
      const stage = account.sixsenseBuyingStage || "Unknown";
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {}) || {};
  }, [accounts]);

  // Intent distribution
  const intentBuckets = useMemo(() => {
    const buckets = { hot: 0, warm: 0, cold: 0 };
    accounts?.forEach(a => {
      const score = Number(a.intentScore) || 0;
      if (score >= 70) buckets.hot++;
      else if (score >= 40) buckets.warm++;
      else buckets.cold++;
    });
    return buckets;
  }, [accounts]);

  // Filtered keywords
  const filteredKeywords = useMemo(() => {
    if (!keywords?.keywords) return [];
    if (!keywordSearch) return keywords.keywords;
    return keywords.keywords.filter(k => 
      k.keyword.toLowerCase().includes(keywordSearch.toLowerCase())
    );
  }, [keywords, keywordSearch]);

  // Filtered accounts based on active filter
  const filteredAccounts = useMemo(() => {
    if (!activeFilter || !accounts) return [];
    
    return accounts.filter(account => {
      switch (activeFilter.type) {
        case "intent":
          const score = Number(account.intentScore) || 0;
          if (activeFilter.value === "hot") return score >= 70;
          if (activeFilter.value === "warm") return score >= 40 && score < 70;
          if (activeFilter.value === "cold") return score < 40;
          return false;
        case "industry":
          return (account.industry || "Unknown") === activeFilter.value;
        case "region":
          return (account.region || "Unknown") === activeFilter.value;
        case "buyingStage":
          return (account.sixsenseBuyingStage || "Unknown") === activeFilter.value;
        default:
          return false;
      }
    }).sort((a, b) => (Number(b.intentScore) || 0) - (Number(a.intentScore) || 0));
  }, [accounts, activeFilter]);

  const handleFilterClick = (type: FilterType, value: string, label: string) => {
    if (activeFilter?.type === type && activeFilter?.value === value) {
      setActiveFilter(null);
    } else {
      setActiveFilter({ type, value, label });
    }
  };

  const clearFilter = () => setActiveFilter(null);

  const getIntentColor = (score: number) => {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-orange-400";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Data Analytics Studio</h1>
            <p className="text-slate-400">Click any chart segment to filter and explore accounts</p>
          </div>
          {activeFilter && (
            <Button 
              variant="outline" 
              onClick={clearFilter}
              className="gap-2 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            >
              <X className="h-4 w-4" />
              Clear Filter
            </Button>
          )}
        </div>

        {/* AI Bar */}
        <ContextualAI 
          context="insights"
          placeholder="Ask AI: What trends should I focus on?"
        />

        {/* Active Filter Banner */}
        {activeFilter && (
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-cyan-400" />
                <span className="text-white font-medium">
                  Filtering by {activeFilter.type}: <span className="text-cyan-400">{activeFilter.label}</span>
                </span>
                <Badge variant="outline" className="border-cyan-500/50 text-cyan-400">
                  {filteredAccounts.length} accounts
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilter} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="keywords" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
              <Hash className="h-4 w-4 mr-2" />
              Keywords ({keywords?.keywords?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="engagement" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
              <Activity className="h-4 w-4 mr-2" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="6qa" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
              <Target className="h-4 w-4 mr-2" />
              6QA Performance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <Card className="card-elevated border-l-4 border-l-cyan-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-cyan-400 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Total Accounts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{activeFilter ? filteredAccounts.length : totalAccounts}</div>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeFilter ? `Filtered from ${totalAccounts}` : "Across all segments"}
                  </p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-green-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-green-400 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Key Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{totalContacts.toLocaleString()}</div>
                  <p className="text-xs text-slate-400 mt-1">Decision makers</p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-purple-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
                    <Flame className="h-4 w-4" />
                    Hot Leads
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{intentBuckets.hot}</div>
                  <p className="text-xs text-slate-400 mt-1">Intent score 70+</p>
                </CardContent>
              </Card>

              <Card className="card-elevated border-l-4 border-l-yellow-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-yellow-400 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Avg Intent Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-white">{avgIntent.toFixed(0)}</div>
                  <p className="text-xs text-slate-400 mt-1">Buying intent level</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Intent Distribution */}
              <Card className={`card-elevated transition-all ${activeFilter?.type === "intent" ? "ring-2 ring-cyan-500" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-400" />
                    Intent Score Distribution
                  </CardTitle>
                  <CardDescription>Click to filter accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleFilterClick("intent", "hot", "Hot Leads (70+)")}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        activeFilter?.type === "intent" && activeFilter?.value === "hot"
                          ? "bg-green-500/20 border-green-500"
                          : "bg-green-500/10 border-green-500/20 hover:bg-green-500/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-green-400 font-medium">Hot Leads (70+)</span>
                        <span className="text-2xl font-bold text-white">{intentBuckets.hot}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{ width: `${(intentBuckets.hot / totalAccounts) * 100}%` }} />
                      </div>
                    </button>

                    <button
                      onClick={() => handleFilterClick("intent", "warm", "Warm Leads (40-69)")}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        activeFilter?.type === "intent" && activeFilter?.value === "warm"
                          ? "bg-yellow-500/20 border-yellow-500"
                          : "bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-yellow-400 font-medium">Warm Leads (40-69)</span>
                        <span className="text-2xl font-bold text-white">{intentBuckets.warm}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500" style={{ width: `${(intentBuckets.warm / totalAccounts) * 100}%` }} />
                      </div>
                    </button>

                    <button
                      onClick={() => handleFilterClick("intent", "cold", "Cold Leads (<40)")}
                      className={`w-full text-left p-4 rounded-lg border transition-all ${
                        activeFilter?.type === "intent" && activeFilter?.value === "cold"
                          ? "bg-orange-500/20 border-orange-500"
                          : "bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-orange-400 font-medium">Cold Leads (&lt;40)</span>
                        <span className="text-2xl font-bold text-white">{intentBuckets.cold}</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500" style={{ width: `${(intentBuckets.cold / totalAccounts) * 100}%` }} />
                      </div>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Top Industries */}
              <Card className={`card-elevated transition-all ${activeFilter?.type === "industry" ? "ring-2 ring-cyan-500" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-cyan-400" />
                    Top Industries
                  </CardTitle>
                  <CardDescription>Click to filter by industry</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(industryData)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([industry, count]) => (
                        <button
                          key={industry}
                          onClick={() => handleFilterClick("industry", industry, industry)}
                          className={`w-full text-left p-2 rounded-lg transition-all ${
                            activeFilter?.type === "industry" && activeFilter?.value === industry
                              ? "bg-cyan-500/20 border border-cyan-500"
                              : "hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-slate-300 truncate max-w-[150px]">{industry}</span>
                            <span className="text-sm font-semibold text-white">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                              style={{ width: `${(count / totalAccounts) * 100}%` }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Geographic Distribution */}
              <Card className={`card-elevated transition-all ${activeFilter?.type === "region" ? "ring-2 ring-cyan-500" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-cyan-400" />
                    Geographic Distribution
                  </CardTitle>
                  <CardDescription>Click to filter by region</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(regionData)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 8)
                      .map(([region, count]) => (
                        <button
                          key={region}
                          onClick={() => handleFilterClick("region", region, region)}
                          className={`w-full text-left p-2 rounded-lg transition-all ${
                            activeFilter?.type === "region" && activeFilter?.value === region
                              ? "bg-purple-500/20 border border-purple-500"
                              : "hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-slate-300">{region}</span>
                            <span className="text-sm font-semibold text-white">{count}</span>
                          </div>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                              style={{ width: `${(count / totalAccounts) * 100}%` }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Buying Stage Distribution */}
            <Card className={`card-elevated mb-8 transition-all ${activeFilter?.type === "buyingStage" ? "ring-2 ring-cyan-500" : ""}`}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-cyan-400" />
                  Buying Stage Funnel
                </CardTitle>
                <CardDescription>Click stages to filter accounts in each phase</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(buyingStageData)
                    .sort(([, a], [, b]) => b - a)
                    .map(([stage, count]) => {
                      const stageColors: Record<string, string> = {
                        "Target": "bg-slate-500/20 border-slate-500/50 hover:bg-slate-500/30",
                        "Awareness": "bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30",
                        "Consideration": "bg-cyan-500/20 border-cyan-500/50 hover:bg-cyan-500/30",
                        "Decision": "bg-purple-500/20 border-purple-500/50 hover:bg-purple-500/30",
                        "Purchase": "bg-green-500/20 border-green-500/50 hover:bg-green-500/30",
                      };
                      const colorClass = stageColors[stage] || "bg-slate-500/20 border-slate-500/50 hover:bg-slate-500/30";
                      const isActive = activeFilter?.type === "buyingStage" && activeFilter?.value === stage;
                      
                      return (
                        <button
                          key={stage}
                          onClick={() => handleFilterClick("buyingStage", stage, stage)}
                          className={`px-4 py-3 rounded-xl border transition-all ${
                            isActive ? "ring-2 ring-cyan-500 " + colorClass : colorClass
                          }`}
                        >
                          <div className="text-2xl font-bold text-white">{count}</div>
                          <div className="text-sm text-slate-400">{stage}</div>
                        </button>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Filtered Results Table */}
            {activeFilter && filteredAccounts.length > 0 && (
              <Card className="card-elevated">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">Filtered Accounts</CardTitle>
                      <CardDescription>
                        Showing {filteredAccounts.length} accounts matching "{activeFilter.label}"
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilter} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Company</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Industry</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Region</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Buying Stage</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Intent</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">Employees</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 20).map((account) => (
                          <tr key={account.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                                  {account.name?.charAt(0) || "?"}
                                </div>
                                <div>
                                  <div className="font-medium text-white">{account.name}</div>
                                  <div className="text-xs text-slate-500">{account.domain}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-300">{account.industry || "Unknown"}</td>
                            <td className="py-3 px-4 text-sm text-slate-300">{account.region || "Unknown"}</td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-xs">
                                {account.sixsenseBuyingStage || "Unknown"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`font-bold ${getIntentColor(Number(account.intentScore) || 0)}`}>
                                {account.intentScore || 0}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-sm text-slate-300">
                              {account.employeeCount?.toLocaleString() || "-"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link href={`/accounts/${account.id}`}>
                                <Button variant="ghost" size="sm" className="gap-1 text-cyan-400 hover:text-cyan-300">
                                  View <ExternalLink className="h-3 w-3" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredAccounts.length > 20 && (
                      <div className="text-center py-4 text-sm text-slate-400">
                        Showing 20 of {filteredAccounts.length} accounts. 
                        <Link href="/accounts" className="text-cyan-400 hover:underline ml-1">View all in Accounts</Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state when filter has no results */}
            {activeFilter && filteredAccounts.length === 0 && (
              <Card className="card-elevated">
                <CardContent className="py-12 text-center">
                  <div className="text-slate-400 mb-4">No accounts found matching "{activeFilter.label}"</div>
                  <Button variant="outline" onClick={clearFilter}>Clear Filter</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="mt-6">
            <Card className="card-elevated mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Hash className="h-5 w-5 text-purple-400" />
                      6sense Intent Keywords
                    </CardTitle>
                    <CardDescription>
                      {keywords?.dataAsOf ? `Data as of ${new Date(keywords.dataAsOf).toLocaleDateString()}` : "Loading..."}
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search keywords..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredKeywords.map((kw, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-slate-900 border border-purple-500/20 hover:border-purple-500/50 transition-all cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-purple-400" />
                          <span className="font-medium text-white group-hover:text-purple-300 transition-colors">
                            {kw.keyword}
                          </span>
                        </div>
                        {kw.category && (
                          <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                            {kw.category}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-slate-400 text-xs">Total Accounts</div>
                          <div className="text-white font-bold">{kw.totalAccounts}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-slate-400 text-xs">Web Visits</div>
                          <div className="text-cyan-400 font-bold">{kw.accountsWithWebVisits}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-slate-400 text-xs">6QA</div>
                          <div className="text-green-400 font-bold">{kw.accountsWith6QA}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2">
                          <div className="text-slate-400 text-xs">Opportunities</div>
                          <div className="text-yellow-400 font-bold">{kw.accountsWithOpportunities}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredKeywords.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    {keywordSearch ? `No keywords matching "${keywordSearch}"` : "No keyword data available"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement States */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-400" />
                    Engagement States
                  </CardTitle>
                  <CardDescription>
                    {engagement?.timeWindow || "Loading..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {engagement?.metrics?.map((metric, idx) => {
                      const stateColors: Record<string, string> = {
                        "Engaged": "from-green-500 to-emerald-600",
                        "Aware": "from-blue-500 to-cyan-600",
                        "Interested": "from-purple-500 to-pink-600",
                        "Considering": "from-yellow-500 to-orange-600",
                      };
                      const colorClass = stateColors[metric.state] || "from-slate-500 to-slate-600";
                      
                      return (
                        <div key={idx} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-white">{metric.state}</span>
                            <Badge className={`bg-gradient-to-r ${colorClass} text-white border-0`}>
                              {metric.accounts} accounts
                            </Badge>
                          </div>
                          {metric.amount && (
                            <div className="text-sm text-slate-400">
                              Pipeline: <span className="text-green-400 font-medium">${Number(metric.amount).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!engagement?.metrics || engagement.metrics.length === 0) && (
                      <div className="text-center py-8 text-slate-400">No engagement data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Buying Stage Pipeline */}
              <Card className="card-elevated">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Target className="h-5 w-5 text-yellow-400" />
                    Buying Stage Pipeline
                  </CardTitle>
                  <CardDescription>
                    {buyingStages?.timeframe || "Loading..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {buyingStages?.stages?.map((stage, idx) => {
                      const stageColors: Record<string, string> = {
                        "Target": "bg-slate-500",
                        "Awareness": "bg-blue-500",
                        "Consideration": "bg-cyan-500",
                        "Decision": "bg-purple-500",
                        "Purchase": "bg-green-500",
                      };
                      const colorClass = stageColors[stage.stage] || "bg-slate-500";
                      const maxAccounts = Math.max(...(buyingStages?.stages?.map(s => s.accounts) || [1]));
                      
                      return (
                        <div key={idx} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-slate-300">{stage.stage}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-white">{stage.accounts}</span>
                              {Number(stage.newPipeline) > 0 && (
                                <span className="text-xs text-green-400">
                                  +${(Number(stage.newPipeline) / 1000).toFixed(0)}k
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colorClass} transition-all group-hover:opacity-80`}
                              style={{ width: `${(stage.accounts / maxAccounts) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {buyingStages?.totalAccounts && (
                    <div className="mt-6 pt-4 border-t border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Total in Pipeline</span>
                        <span className="text-2xl font-bold text-white">{buyingStages.totalAccounts}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 6QA Performance Tab */}
          <TabsContent value="6qa" className="mt-6">
            <Card className="card-elevated">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  6QA Performance Metrics
                </CardTitle>
                <CardDescription>
                  6sense Qualified Accounts performance
                  {sixQAPerformance?.dataAsOf ? ` - Data as of ${new Date(sixQAPerformance.dataAsOf).toLocaleDateString()}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sixQAPerformance?.latest ? (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-slate-900 border border-green-500/20">
                        <div className="text-sm text-slate-400 mb-1">Total 6QA</div>
                        <div className="text-3xl font-bold text-green-400">
                          {sixQAPerformance.latest.total6QAs || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/10 to-slate-900 border border-cyan-500/20">
                        <div className="text-sm text-slate-400 mb-1">Worked</div>
                        <div className="text-3xl font-bold text-cyan-400">
                          {sixQAPerformance.latest.worked || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-slate-900 border border-yellow-500/20">
                        <div className="text-sm text-slate-400 mb-1">Unworked Gap</div>
                        <div className="text-3xl font-bold text-yellow-400">
                          {sixQAPerformance.latest.unworked || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-slate-900 border border-purple-500/20">
                        <div className="text-sm text-slate-400 mb-1">Work Rate</div>
                        <div className="text-3xl font-bold text-purple-400">
                          {sixQAPerformance.latest.workedPercent}%
                        </div>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">Avg Sales Activities</div>
                        <div className="text-xl font-bold text-white">
                          {sixQAPerformance.latest.avgSalesActivities || "-"}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">Avg Contacts Reached</div>
                        <div className="text-xl font-bold text-white">
                          {sixQAPerformance.latest.avgContactsReached || "-"}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">Avg Days to First Activity</div>
                        <div className="text-xl font-bold text-white">
                          {sixQAPerformance.latest.avgDaysToFirstActivity || "-"}
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="text-sm text-slate-400 mb-1">Avg Days Since Last Activity</div>
                        <div className="text-xl font-bold text-white">
                          {sixQAPerformance.latest.avgDaysSinceLastActivity || "-"}
                        </div>
                      </div>
                    </div>

                    {/* New 6QAs */}
                    {sixQAPerformance.latest.new6QAs !== null && sixQAPerformance.latest.new6QAs > 0 && (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30">
                        <div className="flex items-center gap-3">
                          <Zap className="h-6 w-6 text-green-400" />
                          <div>
                            <div className="text-lg font-bold text-white">
                              +{sixQAPerformance.latest.new6QAs} New 6QAs
                            </div>
                            <div className="text-sm text-slate-400">
                              Added on {new Date(sixQAPerformance.latest.day).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    No 6QA performance data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
