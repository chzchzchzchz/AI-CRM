import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, PieChart, TrendingUp, Loader2, Building2, Users, MapPin, Flame, X, ExternalLink, Filter, RefreshCw, Search, Target, Activity, Zap, Hash, ArrowUpRight, ArrowDownRight, Minus, Eye, Phone, Mail } from "lucide-react";
import { Link } from "wouter";
import { ContextualAI } from "@/components/ContextualAI";
import { useRep } from "@/contexts/RepContext";
import { RepSwitcher } from "@/components/RepSwitcher";
import { CompanyLogo } from "@/components/ui/company-logo";
import { MetricGrid } from "@/components/ui/metric";
import { StatCard } from "@/components/StatCard";

type FilterType = "intent" | "industry" | "region" | "buyingStage" | "keyword" | null;

interface ActiveFilter {
  type: FilterType;
  value: string;
  label: string;
  category?: string; // For keyword filtering
}

export default function Insights() {
  const { data: allAccounts, isLoading } = trpc.accounts.list.useQuery();
  
  // Get rep context for territory filtering
  const { matchesTerritory, repInfo, isRepMode } = useRep();
  
  // Filter accounts by rep territory
  const accounts = useMemo(() => {
    if (!allAccounts) return undefined;
    return allAccounts.filter((account: any) => {
      const employeeCount = parseInt(String(account.employeeCount || '0').replace(/[^0-9]/g, '') || '0');
      return matchesTerritory(account.region || '', employeeCount);
    });
  }, [allAccounts, matchesTerritory]);
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
    ? accounts.reduce((sum: number, a: any) => sum + (Number(a.intentScore) || 0), 0) / totalAccounts 
    : 0;

  // Group by industry
  const industryData = useMemo(() => {
    return accounts?.reduce((acc: Record<string, number>, account: any) => {
      const industry = account.industry || "Unknown";
      acc[industry] = (acc[industry] || 0) + 1;
      return acc;
    }, {}) || {};
  }, [accounts]);

  // Group by region
  const regionData = useMemo(() => {
    return accounts?.reduce((acc: Record<string, number>, account: any) => {
      const region = account.region || "Unknown";
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {}) || {};
  }, [accounts]);

  // Group by buying stage
  const buyingStageData = useMemo(() => {
    return accounts?.reduce((acc: Record<string, number>, account: any) => {
      const stage = account.sixsenseBuyingStage || "Unknown";
      acc[stage] = (acc[stage] || 0) + 1;
      return acc;
    }, {}) || {};
  }, [accounts]);

  // Intent distribution
  const intentBuckets = useMemo(() => {
    const buckets = { hot: 0, warm: 0, cold: 0 };
    accounts?.forEach((a: any) => {
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
    
    return accounts.filter((account: any) => {
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
        case "keyword":
          // Smart keyword filtering based on category and keyword content
          const keyword = activeFilter.value.toLowerCase();
          const category = activeFilter.category?.toLowerCase() || "";
          const securityStack = (account.securityStack || "").toLowerCase();
          const techStack = (account.techStack || "").toLowerCase();
          const rawData = account.rawData as Record<string, unknown> | null;
          const ssoProvider = (rawData?.['SSO Provider'] as string || "").toLowerCase();
          const intentScore = Number(account.intentScore) || 0;
          const buyingStage = (account.sixsenseBuyingStage || "").toLowerCase();
          
          // Competitor keywords - match accounts using that competitor
          if (category === "competitor") {
            const competitorMatches = 
              securityStack.includes(keyword) ||
              ssoProvider.includes(keyword) ||
              techStack.includes(keyword);
            if (competitorMatches) return true;
            // Also include high-intent accounts in Decision/Purchase stage
            if (intentScore >= 60 && ["decision", "purchase"].includes(buyingStage)) return true;
            return false;
          }
          
          // Threat keywords - show high-intent accounts (likely researching threats)
          if (category === "threat") {
            return intentScore >= 50; // Show accounts with moderate+ intent
          }
          
          // Compliance keywords - show accounts in regulated industries
          if (category === "compliance") {
            const regulatedIndustries = ["finance", "financial services", "healthcare", "insurance", "government", "banking"];
            const industry = (account.industry || "").toLowerCase();
            if (regulatedIndustries.some(ri => industry.includes(ri))) return true;
            return intentScore >= 60;
          }
          
          // Product keywords - show accounts in active buying stages
          if (category === "product") {
            const activeBuyingStages = ["consideration", "decision", "purchase"];
            if (activeBuyingStages.includes(buyingStage)) return true;
            return intentScore >= 70; // Hot leads
          }
          
          // Brand keywords ({COMPANY_NAME}) - show engaged accounts
          if (category === "brand") {
            const engagementActivities = Number(rawData?.engagementActivities) || 0;
            return engagementActivities > 0 || intentScore >= 60;
          }
          
          // Default: show high-intent accounts
          return intentScore >= 60;
        default:
          return false;
      }
    }).sort((a: any, b: any) => (Number(b.intentScore) || 0) - (Number(a.intentScore) || 0));
  }, [accounts, activeFilter]);

  const handleFilterClick = (type: FilterType, value: string, label: string, category?: string) => {
    if (activeFilter?.type === type && activeFilter?.value === value) {
      setActiveFilter(null);
    } else {
      setActiveFilter({ type, value, label, category });
    }
  };

  const clearFilter = () => setActiveFilter(null);

  const getIntentColor = (score: number) => {
    if (score >= 70) return "text-positive";
    if (score >= 40) return "text-caution";
    return "text-caution";
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      <div className="container max-w-[1500px] py-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-2">Data Analytics Studio</h1>
            <p className="text-ink-muted">
              {isRepMode ? `${repInfo?.region} territory • ` : ''}Click any chart segment to filter and explore accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RepSwitcher />
            {activeFilter && (
              <Button 
                variant="outline" 
                onClick={clearFilter}
                className="gap-2 border-accent/30 text-accent hover:bg-accent-subtle"
              >
                <X className="h-4 w-4" />
                Clear Filter
              </Button>
            )}
          </div>
        </div>

        {/* AI Bar */}
        <ContextualAI 
          context="insights"
          placeholder="Ask AI: What trends should I focus on?"
        />

        {/* Active Filter Banner */}
        {activeFilter && (
          <div className="mb-6 p-4 rounded-md bg-accent border border-accent/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-accent" />
                <span className="text-foreground font-medium">
                  Filtering by {activeFilter.type}: <span className="text-accent">{activeFilter.label}</span>
                </span>
                <Badge variant="outline" className="border-accent/30 text-accent">
                  {filteredAccounts.length} accounts
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilter} className="text-ink-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="overview" className="data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="keywords" className="data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <Hash className="h-4 w-4 mr-2" />
              Keywords ({keywords?.keywords?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="engagement" className="data-[state=active]:bg-positive-subtle data-[state=active]:text-positive">
              <Activity className="h-4 w-4 mr-2" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="6qa" className="data-[state=active]:bg-caution-subtle data-[state=active]:text-caution">
              <Target className="h-4 w-4 mr-2" />
              6QA Performance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <MetricGrid className="mb-6">
              <StatCard
                title="Accounts"
                value={activeFilter ? filteredAccounts.length : totalAccounts}
                subtitle={activeFilter ? `Filtered from ${totalAccounts}` : "Across all segments"}
                icon={Building2}
              />
              <StatCard
                title="Key contacts"
                value={totalContacts.toLocaleString()}
                subtitle="Decision makers"
                icon={Users}
              />
              <StatCard
                title="Hot leads"
                value={intentBuckets.hot}
                subtitle="Intent 70+"
                icon={Flame}
                tone="critical"
              />
              <StatCard
                title="Avg intent"
                value={avgIntent.toFixed(0)}
                subtitle="Buying intent level"
                icon={TrendingUp}
                tone="accent"
              />
            </MetricGrid>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Intent Distribution */}
              <Card className={`transition-all ${activeFilter?.type === "intent" ? "ring-2 ring-accent" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-accent" />
                    Intent Score Distribution
                  </CardTitle>
                  <CardDescription>Click to filter accounts</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Selectable rows rather than filled blocks: three saturated
                      panels stacked on top of each other read as alerts. */}
                  <div className="space-y-1">
                    {([
                      ["hot", "Hot", "70+", intentBuckets.hot, "var(--intent-5)"],
                      ["warm", "Warm", "40–69", intentBuckets.warm, "var(--intent-4)"],
                      ["cold", "Cold", "under 40", intentBuckets.cold, "var(--intent-1)"],
                    ] as const).map(([value, label, range, count, tone]) => {
                      const selected =
                        activeFilter?.type === "intent" && activeFilter?.value === value;
                      const pct = totalAccounts > 0 ? (count / totalAccounts) * 100 : 0;
                      return (
                        <button
                          key={value}
                          onClick={() => handleFilterClick("intent", value, `${label} (${range})`)}
                          aria-pressed={selected}
                          className={`w-full rounded-sm px-2.5 py-2 text-left transition-colors ${ selected ? "bg-accent-subtle" : "hover:bg-muted" }`}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="flex items-center gap-2 text-sm">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: tone }}
                              />
                              {label}
                              <span className="text-2xs text-ink-faint">{range}</span>
                            </span>
                            <span data-numeric className="text-sm font-medium tabular-nums">
                              {count}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                            <div
                              className="h-full rounded-full transition-[width] duration-500"
                              style={{ width: `${pct}%`, backgroundColor: tone }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Industries */}
              <Card className={`transition-all ${activeFilter?.type === "industry" ? "ring-2 ring-accent" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-accent" />
                    Top Industries
                  </CardTitle>
                  <CardDescription>Click to filter by industry</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(industryData)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 8)
                      .map(([industry, count]) => (
                        <button
                          key={industry}
                          onClick={() => handleFilterClick("industry", industry, industry)}
                          className={`w-full text-left p-2 rounded-sm transition-all ${ activeFilter?.type === "industry" && activeFilter?.value === industry ? "bg-accent-subtle border border-accent/30" : "hover:bg-muted" }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-ink-muted truncate max-w-[150px]">{industry}</span>
                            <span className="text-sm font-semibold text-foreground">{count as number}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent"
                              style={{ width: `${((count as number) / totalAccounts) * 100}%` }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Geographic Distribution */}
              <Card className={`transition-all ${activeFilter?.type === "region" ? "ring-2 ring-accent" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-accent" />
                    Geographic Distribution
                  </CardTitle>
                  <CardDescription>Click to filter by region</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(regionData)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 8)
                      .map(([region, count]) => (
                        <button
                          key={region}
                          onClick={() => handleFilterClick("region", region, region)}
                          className={`w-full text-left p-2 rounded-sm transition-all ${ activeFilter?.type === "region" && activeFilter?.value === region ? "bg-accent-subtle border border-accent/30" : "hover:bg-muted" }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-ink-muted">{region}</span>
                            <span className="text-sm font-semibold text-foreground">{count as number}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent"
                              style={{ width: `${((count as number) / totalAccounts) * 100}%` }}
                            />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Buying Stage Distribution */}
            <Card className={`mb-8 transition-all ${activeFilter?.type === "buyingStage" ? "ring-2 ring-accent" : ""}`}>
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-accent" />
                  Buying Stage Funnel
                </CardTitle>
                <CardDescription>Click stages to filter accounts in each phase</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(buyingStageData)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([stage, count]) => {
                      const stageColors: Record<string, string> = {
                        "Target": "bg-muted border-border hover:bg-muted",
                        "Awareness": "bg-accent-subtle border-accent/30 hover:bg-accent-subtle",
                        "Consideration": "bg-accent-subtle border-accent/30 hover:bg-accent-subtle",
                        "Decision": "bg-accent-subtle border-accent/30 hover:bg-accent-subtle",
                        "Purchase": "bg-positive-subtle border-positive/30 hover:bg-positive-subtle",
                      };
                      const colorClass = stageColors[stage] || "bg-muted border-border hover:bg-muted";
                      const isActive = activeFilter?.type === "buyingStage" && activeFilter?.value === stage;
                      
                      return (
                        <button
                          key={stage}
                          onClick={() => handleFilterClick("buyingStage", stage, stage)}
                          className={`px-4 py-3 rounded-md border transition-all ${ isActive ? "ring-2 ring-accent " + colorClass : colorClass }`}
                        >
                          <div className="text-2xl font-bold text-foreground">{count as number}</div>
                          <div className="text-sm text-ink-muted">{stage}</div>
                        </button>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Filtered Results Table */}
            {activeFilter && filteredAccounts.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">Filtered Accounts</CardTitle>
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
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Company</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Industry</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Region</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Buying Stage</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-ink-muted">Intent</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-ink-muted">Employees</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-ink-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 20).map((account: any) => (
                          <tr key={account.id} className="border-b border-border hover:bg-muted transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <CompanyLogo
                                  name={account.name}
                                  website={account.domain}
                                  size="md"
                                />
                                <div>
                                  <div className="font-medium text-foreground">{account.name}</div>
                                  <div className="text-xs text-ink-subtle">{account.domain}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-ink-muted">{account.industry || "Unknown"}</td>
                            <td className="py-3 px-4 text-sm text-ink-muted">{account.region || "Unknown"}</td>
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
                            <td className="py-3 px-4 text-center text-sm text-ink-muted">
                              {account.employeeCount?.toLocaleString() || "-"}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link href={`/accounts/${account.id}`}>
                                <Button variant="ghost" size="sm" className="gap-1 text-accent hover:text-accent">
                                  View <ExternalLink className="h-3 w-3" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredAccounts.length > 20 && (
                      <div className="text-center py-4 text-sm text-ink-muted">
                        Showing 20 of {filteredAccounts.length} accounts. 
                        <Link href="/accounts" className="text-accent hover:underline ml-1">View all in Accounts</Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state when filter has no results */}
            {activeFilter && filteredAccounts.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-ink-muted mb-4">No accounts found matching "{activeFilter.label}"</div>
                  <Button variant="outline" onClick={clearFilter}>Clear Filter</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="mt-6">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <Hash className="h-5 w-5 text-accent" />
                      6sense Intent Keywords
                    </CardTitle>
                    <CardDescription>
                      {keywords?.dataAsOf ? `Data as of ${new Date(keywords.dataAsOf).toLocaleDateString()}` : "Loading..."}
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                    <input
                      type="text"
                      placeholder="Search keywords..."
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-muted border border-border-strong rounded-sm text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredKeywords.map((kw, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleFilterClick("keyword", kw.keyword, `Keyword: ${kw.keyword}`, kw.category || undefined)}
                      className={`p-4 rounded-md bg-accent border transition-all cursor-pointer group ${activeFilter?.type === "keyword" && activeFilter?.value === kw.keyword ? "border-accent/30 ring-2 ring-accent" : "border-accent/30 hover:border-accent/30"}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-accent" />
                          <span className="font-medium text-foreground group-hover:text-accent transition-colors">
                            {kw.keyword}
                          </span>
                        </div>
                        {kw.category && (
                          <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                            {kw.category}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-muted rounded-sm p-2">
                          <div className="text-ink-muted text-xs">Total Accounts</div>
                          <div className="text-foreground font-bold">{kw.totalAccounts}</div>
                        </div>
                        <div className="bg-muted rounded-sm p-2">
                          <div className="text-ink-muted text-xs">Web Visits</div>
                          <div className="text-accent font-bold">{kw.accountsWithWebVisits}</div>
                        </div>
                        <div className="bg-muted rounded-sm p-2">
                          <div className="text-ink-muted text-xs">6QA</div>
                          <div className="text-positive font-bold">{kw.accountsWith6QA}</div>
                        </div>
                        <div className="bg-muted rounded-sm p-2">
                          <div className="text-ink-muted text-xs">Opportunities</div>
                          <div className="text-caution font-bold">{kw.accountsWithOpportunities}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredKeywords.length === 0 && (
                  <div className="text-center py-12 text-ink-muted">
                    {keywordSearch ? `No keywords matching "${keywordSearch}"` : "No keyword data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filtered Accounts Table for Keywords */}
            {activeFilter?.type === "keyword" && filteredAccounts.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-accent" />
                        Accounts Researching "{activeFilter.value}"
                      </CardTitle>
                      <CardDescription>
                        {filteredAccounts.length} accounts likely researching this topic based on {activeFilter.category || "intent"} signals
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilter} className="gap-2 border-accent/30 text-accent hover:bg-accent-subtle">
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Company</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Industry</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Buying Stage</th>
                          <th className="text-center py-3 px-4 text-sm font-medium text-ink-muted">Intent</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-ink-muted">Security Stack</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-ink-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 25).map((account: any) => (
                          <tr key={account.id} className="border-b border-border hover:bg-muted transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <CompanyLogo
                                  name={account.name}
                                  website={account.domain}
                                  size="md"
                                />
                                <div>
                                  <div className="font-medium text-foreground">{account.name}</div>
                                  <div className="text-xs text-ink-subtle">{account.domain}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-ink-muted">{account.industry || "Unknown"}</td>
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
                            <td className="py-3 px-4 text-sm text-ink-muted max-w-[200px] truncate">
                              {(() => {
                                const rawData = account.rawData as Record<string, unknown> | null;
                                const sso = rawData?.['SSO Provider'] as string || '';
                                return sso || account.securityStack?.slice(0, 50) || '-';
                              })()}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link href={`/accounts/${account.id}`}>
                                <Button variant="ghost" size="sm" className="gap-1 text-accent hover:text-accent">
                                  View <ExternalLink className="h-3 w-3" />
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredAccounts.length > 25 && (
                      <div className="text-center py-4 text-sm text-ink-muted">
                        Showing 25 of {filteredAccounts.length} accounts. 
                        <Link href="/accounts" className="text-accent hover:underline ml-1">View all in Accounts</Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state when keyword filter has no results */}
            {activeFilter?.type === "keyword" && filteredAccounts.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="text-ink-muted mb-4">No accounts found researching "{activeFilter.value}"</div>
                  <Button variant="outline" onClick={clearFilter} className="border-accent/30 text-accent">Clear Filter</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement States */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Activity className="h-5 w-5 text-positive" />
                    Engagement States
                  </CardTitle>
                  <CardDescription>
                    {engagement?.timeWindow || "Loading..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {engagement?.metrics?.map((metric, idx) => {
                      // Engagement states are a funnel, so they read on the
                      // cold -> hot intent ramp rather than as arbitrary hues.
                      const stateTone: Record<string, string> = {
                        Aware: "var(--intent-1)",
                        Interested: "var(--intent-2)",
                        Considering: "var(--intent-3)",
                        Engaged: "var(--intent-5)",
                      };
                      const tone = stateTone[metric.state] ?? "var(--intent-1)";

                      return (
                        <div key={idx} className="rounded-md border border-border-subtle bg-surface-sunken p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 font-medium">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: tone }}
                              />
                              {metric.state}
                            </span>
                            <span data-numeric className="text-xs text-ink-muted">
                              {metric.accounts} accounts
                            </span>
                          </div>
                          {metric.amount && (
                            <div className="text-sm text-ink-muted">
                              Pipeline: <span className="text-positive font-medium">${Number(metric.amount).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!engagement?.metrics || engagement.metrics.length === 0) && (
                      <div className="text-center py-8 text-ink-muted">No engagement data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Buying Stage Pipeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Target className="h-5 w-5 text-caution" />
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
                        "Target": "bg-muted",
                        "Awareness": "bg-accent",
                        "Consideration": "bg-accent",
                        "Decision": "bg-accent",
                        "Purchase": "bg-positive",
                      };
                      const colorClass = stageColors[stage.stage] || "bg-muted";
                      const maxAccounts = Math.max(...(buyingStages?.stages?.map(s => s.accounts) || [1]));
                      
                      return (
                        <div key={idx} className="group">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-ink-muted">{stage.stage}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-foreground">{stage.accounts}</span>
                              {Number(stage.newPipeline) > 0 && (
                                <span className="text-xs text-positive">
                                  +${(Number(stage.newPipeline) / 1000).toFixed(0)}k
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
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
                    <div className="mt-6 pt-4 border-t border-border-strong">
                      <div className="flex items-center justify-between">
                        <span className="text-ink-muted">Total in Pipeline</span>
                        <span className="text-2xl font-bold text-foreground">{buyingStages.totalAccounts}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 6QA Performance Tab */}
          <TabsContent value="6qa" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Zap className="h-5 w-5 text-caution" />
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
                      <div className="p-4 rounded-md bg-positive border border-positive/30">
                        <div className="text-sm text-ink-muted mb-1">Total 6QA</div>
                        <div className="text-2xl font-semibold text-positive">
                          {sixQAPerformance.latest.total6QAs || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-md bg-accent border border-accent/30">
                        <div className="text-sm text-ink-muted mb-1">Worked</div>
                        <div className="text-2xl font-semibold text-accent">
                          {sixQAPerformance.latest.worked || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-md bg-caution border border-caution/30">
                        <div className="text-sm text-ink-muted mb-1">Unworked Gap</div>
                        <div className="text-2xl font-semibold text-caution">
                          {sixQAPerformance.latest.unworked || 0}
                        </div>
                      </div>
                      <div className="p-4 rounded-md bg-accent border border-accent/30">
                        <div className="text-sm text-ink-muted mb-1">Work Rate</div>
                        <div className="text-2xl font-semibold text-accent">
                          {sixQAPerformance.latest.workedPercent}%
                        </div>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-md bg-muted border border-border-strong">
                        <div className="text-sm text-ink-muted mb-1">Avg Sales Activities</div>
                        <div className="text-xl font-bold text-foreground">
                          {sixQAPerformance.latest.avgSalesActivities || "-"}
                        </div>
                      </div>
                      <div className="p-4 rounded-md bg-muted border border-border-strong">
                        <div className="text-sm text-ink-muted mb-1">Avg Contacts Reached</div>
                        <div className="text-xl font-bold text-foreground">
                          {sixQAPerformance.latest.avgContactsReached || "-"}
                        </div>
                      </div>
                      <div className="p-4 rounded-md bg-muted border border-border-strong">
                        <div className="text-sm text-ink-muted mb-1">Avg Days to First Activity</div>
                        <div className="text-xl font-bold text-foreground">
                          {sixQAPerformance.latest.avgDaysToFirstActivity || "-"}
                        </div>
                      </div>
                      <div className="p-4 rounded-md bg-muted border border-border-strong">
                        <div className="text-sm text-ink-muted mb-1">Avg Days Since Last Activity</div>
                        <div className="text-xl font-bold text-foreground">
                          {sixQAPerformance.latest.avgDaysSinceLastActivity || "-"}
                        </div>
                      </div>
                    </div>

                    {/* New 6QAs */}
                    {sixQAPerformance.latest.new6QAs !== null && sixQAPerformance.latest.new6QAs > 0 && (
                      <div className="p-4 rounded-md bg-positive border border-positive/30">
                        <div className="flex items-center gap-3">
                          <Zap className="h-6 w-6 text-positive" />
                          <div>
                            <div className="text-lg font-bold text-foreground">
                              +{sixQAPerformance.latest.new6QAs} New 6QAs
                            </div>
                            <div className="text-sm text-ink-muted">
                              Added on {new Date(sixQAPerformance.latest.day).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-ink-muted">
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
