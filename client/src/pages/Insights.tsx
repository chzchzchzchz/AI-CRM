import { useState, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BarChart3, PieChart, TrendingUp, Loader2, Building2, Users, MapPin, Flame, X, ExternalLink, Filter, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { ContextualAI } from "@/components/ContextualAI";

type FilterType = "intent" | "industry" | "region" | "buyingStage" | null;

interface ActiveFilter {
  type: FilterType;
  value: string;
  label: string;
}

export default function Insights() {
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: calls } = trpc.gong.list.useQuery();
  const { data: contacts } = trpc.people.list.useQuery();

  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);

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

  const getIntentBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Hot</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Warm</Badge>;
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Cold</Badge>;
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
      </div>
    </div>
  );
}
