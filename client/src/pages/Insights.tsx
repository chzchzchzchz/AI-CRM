import { useState, useMemo } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, Loader2, Building2, Users, MapPin, Flame, X, ExternalLink, Filter, RefreshCw, Search, Target, Activity, Zap, Hash } from "lucide-react";
import { Link } from "wouter";
import { ContextualAI } from "@/components/ContextualAI";
import { useRep } from "@/contexts/RepContext";
import { RepSwitcher } from "@/components/RepSwitcher";

type FilterType = "intent" | "industry" | "region" | "buyingStage" | "keyword" | null;

interface ActiveFilter {
  type: FilterType;
  value: string;
  label: string;
  category?: string; // For keyword filtering
}

// Canonical funnel order so stages read as a progression, not a bar chart sorted by size.
const STAGE_ORDER = ["Target", "Awareness", "Consideration", "Decision", "Purchase"];

// Sequential cyan ramp: deeper cyan = closer to purchase. Signal-Cyan is the data voice.
const stageBar: Record<string, string> = {
  Target: "bg-slate-600",
  Awareness: "bg-cyan-900",
  Consideration: "bg-cyan-700",
  Decision: "bg-cyan-500",
  Purchase: "bg-cyan-300",
};

// Heat = a status read on the near-black canvas: tint + glyph + word, never color alone.
// Emerald reads "strong/healthy", amber "cooling/mid", slate "low" — red stays reserved for hard alerts.
function heatMeta(score: number) {
  if (score >= 70) return { label: "Hot", glyph: "▲", text: "text-emerald-400", bar: "bg-emerald-500", soft: "bg-emerald-500/10", edge: "border-emerald-500/40" };
  if (score >= 40) return { label: "Warm", glyph: "●", text: "text-amber-400", bar: "bg-amber-500", soft: "bg-amber-500/10", edge: "border-amber-500/40" };
  return { label: "Cold", glyph: "○", text: "text-slate-400", bar: "bg-slate-600", soft: "bg-slate-800/60", edge: "border-slate-700" };
}

const CARD = "bg-slate-900 border-slate-800 shadow-none";

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

  const getIntentColor = (score: number) => heatMeta(score).text;

  // Ordered stage entries for the funnel (progression order, unknown stages appended).
  const orderedStages = useMemo(() => {
    return Object.entries(buyingStageData).sort(([a], [b]) => {
      const ia = STAGE_ORDER.indexOf(a);
      const ib = STAGE_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [buyingStageData]);
  const maxStageCount = Math.max(1, ...Object.values(buyingStageData).map((n) => n as number));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Data Analytics Studio</h1>
            <p className="mt-1 text-sm text-slate-400">
              {isRepMode ? `${repInfo?.region} territory · ` : ''}Every figure is computed from live account data — click any segment to drill in.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <RepSwitcher />
            {activeFilter && (
              <Button
                variant="outline"
                onClick={clearFilter}
                className="gap-2 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
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
          <div className="mb-6 p-4 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/25">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-cyan-400" />
                <span className="text-slate-200 text-sm">
                  Filtering by {activeFilter.type}: <span className="text-cyan-300 font-medium">{activeFilter.label}</span>
                </span>
                <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 font-mono tabular-nums">
                  {filteredAccounts.length} accounts
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilter} className="text-slate-400 hover:text-slate-100">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="keywords" className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <Hash className="h-4 w-4 mr-2" />
              Keywords ({keywords?.keywords?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="engagement" className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <Activity className="h-4 w-4 mr-2" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="6qa" className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300">
              <Target className="h-4 w-4 mr-2" />
              6QA Performance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            {/* Portfolio pulse — one lead read (hot leads) with supporting stats, not a grid of identical cards */}
            <Card className={`${CARD} mb-8`}>
              <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                <div className="lg:w-72 lg:pr-6 lg:border-r lg:border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400">
                    <Flame className="h-4 w-4 text-emerald-400" />
                    Hot leads right now
                  </div>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-mono tabular-nums text-5xl font-semibold text-cyan-400 leading-none">
                      {intentBuckets.hot}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
                      <span aria-hidden>▲</span> Hot
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    Accounts at intent <span className="font-mono">70+</span> — the queue to work before a competitor does.
                  </p>
                </div>

                <div className="flex-1 grid grid-cols-3 divide-x divide-slate-800">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                      <Building2 className="h-3.5 w-3.5" /> Accounts
                    </div>
                    <div className="mt-2 font-mono tabular-nums text-2xl text-slate-100">
                      {activeFilter ? filteredAccounts.length : totalAccounts}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {activeFilter ? `filtered from ${totalAccounts}` : "in territory"}
                    </div>
                  </div>
                  <div className="px-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                      <Users className="h-3.5 w-3.5" /> Key contacts
                    </div>
                    <div className="mt-2 font-mono tabular-nums text-2xl text-slate-100">
                      {totalContacts.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">decision makers</div>
                  </div>
                  <div className="pl-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                      <Activity className="h-3.5 w-3.5" /> Avg intent
                    </div>
                    <div className="mt-2 font-mono tabular-nums text-2xl text-cyan-400">
                      {avgIntent.toFixed(0)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {totalCalls.toLocaleString()} calls logged
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Intent Distribution */}
              <Card className={`${CARD} transition-colors ${activeFilter?.type === "intent" ? "ring-1 ring-cyan-500/60" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Intent distribution
                  </CardTitle>
                  <CardDescription className="text-slate-400">Split of the queue by heat — click to filter</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {([
                      { key: "hot", label: "Hot", range: "70+", count: intentBuckets.hot },
                      { key: "warm", label: "Warm", range: "40–69", count: intentBuckets.warm },
                      { key: "cold", label: "Cold", range: "<40", count: intentBuckets.cold },
                    ] as const).map((b) => {
                      const meta = b.key === "hot" ? heatMeta(70) : b.key === "warm" ? heatMeta(40) : heatMeta(0);
                      const active = activeFilter?.type === "intent" && activeFilter?.value === b.key;
                      const pct = totalAccounts ? (b.count / totalAccounts) * 100 : 0;
                      return (
                        <button
                          key={b.key}
                          onClick={() => handleFilterClick("intent", b.key, `${b.label} Leads (${b.range})`)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            active ? `${meta.soft} ${meta.edge}` : "border-slate-800 hover:bg-slate-800/40"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium flex items-center gap-1.5 ${meta.text}`}>
                              <span aria-hidden>{meta.glyph}</span> {b.label}
                              <span className="text-slate-400 font-normal">· {b.range}</span>
                            </span>
                            <span className="font-mono tabular-nums text-lg text-slate-100">{b.count}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full ${meta.bar} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Industries */}
              <Card className={`${CARD} transition-colors ${activeFilter?.type === "industry" ? "ring-1 ring-cyan-500/60" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-cyan-400" />
                    Top industries
                  </CardTitle>
                  <CardDescription className="text-slate-400">Account volume by industry</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {Object.entries(industryData)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 8)
                      .map(([industry, count]) => {
                        const active = activeFilter?.type === "industry" && activeFilter?.value === industry;
                        return (
                          <button
                            key={industry}
                            onClick={() => handleFilterClick("industry", industry, industry)}
                            className={`w-full text-left p-2 rounded-lg transition-colors ${
                              active ? "bg-cyan-500/10 ring-1 ring-cyan-500/50" : "hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-sm text-slate-300 truncate max-w-[150px]">{industry}</span>
                              <span className="font-mono tabular-nums text-sm text-slate-100">{count as number}</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full"
                                style={{ width: `${((count as number) / totalAccounts) * 100}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Geographic Distribution */}
              <Card className={`${CARD} transition-colors ${activeFilter?.type === "region" ? "ring-1 ring-cyan-500/60" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-cyan-400" />
                    Geographic distribution
                  </CardTitle>
                  <CardDescription className="text-slate-400">Account volume by region</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {Object.entries(regionData)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .slice(0, 8)
                      .map(([region, count]) => {
                        const active = activeFilter?.type === "region" && activeFilter?.value === region;
                        return (
                          <button
                            key={region}
                            onClick={() => handleFilterClick("region", region, region)}
                            className={`w-full text-left p-2 rounded-lg transition-colors ${
                              active ? "bg-cyan-500/10 ring-1 ring-cyan-500/50" : "hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-sm text-slate-300">{region}</span>
                              <span className="font-mono tabular-nums text-sm text-slate-100">{count as number}</span>
                            </div>
                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${((count as number) / totalAccounts) * 100}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Buying Stage Funnel */}
            <Card className={`${CARD} mb-8 transition-colors ${activeFilter?.type === "buyingStage" ? "ring-1 ring-cyan-500/60" : ""}`}>
              <CardHeader>
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-cyan-400" />
                  Buying-stage funnel
                </CardTitle>
                <CardDescription className="text-slate-400">Accounts by 6sense stage, earliest to latest — click a stage to filter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {orderedStages.map(([stage, count]) => {
                    const isActive = activeFilter?.type === "buyingStage" && activeFilter?.value === stage;
                    const bar = stageBar[stage] || "bg-slate-600";
                    const pct = ((count as number) / maxStageCount) * 100;
                    return (
                      <button
                        key={stage}
                        onClick={() => handleFilterClick("buyingStage", stage, stage)}
                        className={`w-full text-left rounded-lg p-2 transition-colors ${
                          isActive ? "bg-cyan-500/10 ring-1 ring-cyan-500/50" : "hover:bg-slate-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-28 shrink-0 text-sm text-slate-300">{stage}</span>
                          <div className="flex-1 h-6 rounded-md bg-slate-800/70 overflow-hidden">
                            <div className={`h-full ${bar} rounded-md`} style={{ width: `${Math.max(pct, 3)}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right font-mono tabular-nums text-sm text-slate-100">
                            {count as number}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Filtered Results Table */}
            {activeFilter && filteredAccounts.length > 0 && (
              <Card className={CARD}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-slate-100 text-base">Filtered accounts</CardTitle>
                      <CardDescription className="text-slate-400">
                        {filteredAccounts.length} accounts matching “{activeFilter.label}”
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilter} className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
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
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Company</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Industry</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Region</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Buying stage</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Intent</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Employees</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 20).map((account: any) => {
                          const meta = heatMeta(Number(account.intentScore) || 0);
                          return (
                            <tr key={account.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-semibold text-sm">
                                    {account.name?.charAt(0) || "?"}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-100">{account.name}</div>
                                    <div className="text-xs text-slate-400">{account.domain}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-300">{account.industry || "Unknown"}</td>
                              <td className="py-3 px-4 text-sm text-slate-300">{account.region || "Unknown"}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                                  {account.sixsenseBuyingStage || "Unknown"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-flex items-center gap-1.5 font-mono tabular-nums ${meta.text}`}>
                                  <span aria-hidden>{meta.glyph}</span>{account.intentScore || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-mono tabular-nums text-sm text-slate-300">
                                {account.employeeCount?.toLocaleString() || "—"}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link href={`/accounts/${account.id}`}>
                                  <Button variant="ghost" size="sm" className="gap-1 text-cyan-300 hover:text-cyan-200">
                                    View <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredAccounts.length > 20 && (
                      <div className="text-center py-4 text-sm text-slate-400">
                        Showing 20 of {filteredAccounts.length} accounts.
                        <Link href="/accounts" className="text-cyan-300 hover:underline ml-1">View all in Accounts</Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state when filter has no results */}
            {activeFilter && filteredAccounts.length === 0 && (
              <Card className={CARD}>
                <CardContent className="py-12 text-center">
                  <div className="text-slate-400 mb-4">No accounts found matching “{activeFilter.label}”</div>
                  <Button variant="outline" onClick={clearFilter} className="border-slate-700 text-slate-300 hover:bg-slate-800">Clear Filter</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="mt-6">
            <Card className={`${CARD} mb-6`}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                      <Hash className="h-4 w-4 text-cyan-400" />
                      6sense intent keywords
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {keywords?.dataAsOf ? `Data as of ${new Date(keywords.dataAsOf).toLocaleDateString()}` : "Loading…"}
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search keywords…"
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-md text-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredKeywords.map((kw, idx) => {
                    const active = activeFilter?.type === "keyword" && activeFilter?.value === kw.keyword;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleFilterClick("keyword", kw.keyword, `Keyword: ${kw.keyword}`, kw.category || undefined)}
                        className={`p-4 rounded-lg bg-slate-900 border transition-colors cursor-pointer group ${active ? "border-cyan-500/60 ring-1 ring-cyan-500/40" : "border-slate-800 hover:border-cyan-500/40"}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <Hash className="h-4 w-4 text-cyan-400 shrink-0" />
                            <span className="font-medium text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                              {kw.keyword}
                            </span>
                          </div>
                          {kw.category && (
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-300 shrink-0">
                              {kw.category}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-slate-800/60 rounded-md p-2">
                            <div className="text-slate-400 text-xs">Accounts</div>
                            <div className="text-slate-100 font-mono tabular-nums">{kw.totalAccounts}</div>
                          </div>
                          <div className="bg-slate-800/60 rounded-md p-2">
                            <div className="text-slate-400 text-xs">Web visits</div>
                            <div className="text-cyan-400 font-mono tabular-nums">{kw.accountsWithWebVisits}</div>
                          </div>
                          <div className="bg-slate-800/60 rounded-md p-2">
                            <div className="text-slate-400 text-xs">6QA</div>
                            <div className="text-emerald-400 font-mono tabular-nums">{kw.accountsWith6QA}</div>
                          </div>
                          <div className="bg-slate-800/60 rounded-md p-2">
                            <div className="text-slate-400 text-xs">Opps</div>
                            <div className="text-amber-400 font-mono tabular-nums">{kw.accountsWithOpportunities}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredKeywords.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    {keywordSearch ? `No keywords matching “${keywordSearch}”` : "No keyword data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filtered Accounts Table for Keywords */}
            {activeFilter?.type === "keyword" && filteredAccounts.length > 0 && (
              <Card className={CARD}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-cyan-400" />
                        Accounts researching “{activeFilter.value}”
                      </CardTitle>
                      <CardDescription className="text-slate-400">
                        {filteredAccounts.length} accounts likely researching this topic, from {activeFilter.category || "intent"} signals
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilter} className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
                      <X className="h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-800">
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Company</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Industry</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Buying stage</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Intent</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Security stack</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-slate-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 25).map((account: any) => {
                          const meta = heatMeta(Number(account.intentScore) || 0);
                          return (
                            <tr key={account.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 font-semibold text-sm">
                                    {account.name?.charAt(0) || "?"}
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-100">{account.name}</div>
                                    <div className="text-xs text-slate-400">{account.domain}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-300">{account.industry || "Unknown"}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">
                                  {account.sixsenseBuyingStage || "Unknown"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-flex items-center gap-1.5 font-mono tabular-nums ${meta.text}`}>
                                  <span aria-hidden>{meta.glyph}</span>{account.intentScore || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-300 max-w-[200px] truncate">
                                {(() => {
                                  const rawData = account.rawData as Record<string, unknown> | null;
                                  const sso = rawData?.['SSO Provider'] as string || '';
                                  return sso || account.securityStack?.slice(0, 50) || '—';
                                })()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link href={`/accounts/${account.id}`}>
                                  <Button variant="ghost" size="sm" className="gap-1 text-cyan-300 hover:text-cyan-200">
                                    View <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredAccounts.length > 25 && (
                      <div className="text-center py-4 text-sm text-slate-400">
                        Showing 25 of {filteredAccounts.length} accounts.
                        <Link href="/accounts" className="text-cyan-300 hover:underline ml-1">View all in Accounts</Link>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Empty state when keyword filter has no results */}
            {activeFilter?.type === "keyword" && filteredAccounts.length === 0 && (
              <Card className={CARD}>
                <CardContent className="py-12 text-center">
                  <div className="text-slate-400 mb-4">No accounts found researching “{activeFilter.value}”</div>
                  <Button variant="outline" onClick={clearFilter} className="border-slate-700 text-slate-300 hover:bg-slate-800">Clear Filter</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Engagement States */}
              <Card className={CARD}>
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-cyan-400" />
                    Engagement states
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {engagement?.timeWindow || "Loading…"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {engagement?.metrics?.map((metric, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-100">{metric.state}</span>
                          <span className="font-mono tabular-nums text-lg text-cyan-400">{metric.accounts}</span>
                        </div>
                        {metric.amount && (
                          <div className="mt-1 text-sm text-slate-400">
                            Pipeline <span className="text-emerald-400 font-mono tabular-nums">${Number(metric.amount).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {(!engagement?.metrics || engagement.metrics.length === 0) && (
                      <div className="text-center py-8 text-slate-400">No engagement data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Buying Stage Pipeline */}
              <Card className={CARD}>
                <CardHeader>
                  <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-400" />
                    Buying-stage pipeline
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {buyingStages?.timeframe || "Loading…"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {buyingStages?.stages?.map((stage, idx) => {
                      const bar = stageBar[stage.stage] || "bg-slate-600";
                      const maxAccounts = Math.max(...(buyingStages?.stages?.map(s => s.accounts) || [1]));
                      return (
                        <div key={idx} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-slate-300">{stage.stage}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono tabular-nums text-sm text-slate-100">{stage.accounts}</span>
                              {Number(stage.newPipeline) > 0 && (
                                <span className="text-xs text-emerald-400 font-mono tabular-nums">
                                  +${(Number(stage.newPipeline) / 1000).toFixed(0)}k
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${bar} rounded-full transition-all group-hover:opacity-80`}
                              style={{ width: `${(stage.accounts / maxAccounts) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {buyingStages?.totalAccounts && (
                    <div className="mt-6 pt-4 border-t border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total in pipeline</span>
                        <span className="font-mono tabular-nums text-2xl text-slate-100">{buyingStages.totalAccounts}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 6QA Performance Tab */}
          <TabsContent value="6qa" className="mt-6">
            <Card className={CARD}>
              <CardHeader>
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-cyan-400" />
                  6QA performance
                </CardTitle>
                <CardDescription className="text-slate-400">
                  6sense Qualified Accounts
                  {sixQAPerformance?.dataAsOf ? ` · data as of ${new Date(sixQAPerformance.dataAsOf).toLocaleDateString()}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sixQAPerformance?.latest ? (
                  <div className="space-y-6">
                    {/* Headline funnel row: total → worked → gap → rate */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800 rounded-lg overflow-hidden">
                      <div className="bg-slate-900 p-4">
                        <div className="text-xs font-semibold tracking-wide text-slate-400">Total 6QA</div>
                        <div className="mt-2 font-mono tabular-nums text-3xl text-cyan-400">
                          {sixQAPerformance.latest.total6QAs || 0}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4">
                        <div className="text-xs font-semibold tracking-wide text-slate-400 flex items-center gap-1.5">
                          <span aria-hidden className="text-emerald-400">▲</span> Worked
                        </div>
                        <div className="mt-2 font-mono tabular-nums text-3xl text-emerald-400">
                          {sixQAPerformance.latest.worked || 0}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4">
                        <div className="text-xs font-semibold tracking-wide text-slate-400 flex items-center gap-1.5">
                          <span aria-hidden className="text-amber-400">●</span> Unworked gap
                        </div>
                        <div className="mt-2 font-mono tabular-nums text-3xl text-amber-400">
                          {sixQAPerformance.latest.unworked || 0}
                        </div>
                      </div>
                      <div className="bg-slate-900 p-4">
                        <div className="text-xs font-semibold tracking-wide text-slate-400">Work rate</div>
                        <div className="mt-2 font-mono tabular-nums text-3xl text-slate-100">
                          {sixQAPerformance.latest.workedPercent}%
                        </div>
                      </div>
                    </div>

                    {/* Additional Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { label: "Avg sales activities", value: sixQAPerformance.latest.avgSalesActivities },
                        { label: "Avg contacts reached", value: sixQAPerformance.latest.avgContactsReached },
                        { label: "Avg days to first activity", value: sixQAPerformance.latest.avgDaysToFirstActivity },
                        { label: "Avg days since last activity", value: sixQAPerformance.latest.avgDaysSinceLastActivity },
                      ].map((m) => (
                        <div key={m.label} className="p-4 rounded-lg bg-slate-800/50 border border-slate-800">
                          <div className="text-xs text-slate-400">{m.label}</div>
                          <div className="mt-1 font-mono tabular-nums text-xl text-slate-100">
                            {m.value ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* New 6QAs */}
                    {sixQAPerformance.latest.new6QAs !== null && sixQAPerformance.latest.new6QAs > 0 && (
                      <div className="p-4 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/25">
                        <div className="flex items-center gap-3">
                          <Zap className="h-5 w-5 text-emerald-400 shrink-0" />
                          <div>
                            <div className="text-slate-100 font-medium">
                              <span className="font-mono tabular-nums">+{sixQAPerformance.latest.new6QAs}</span> new 6QAs
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
