import { useState, useMemo } from "react";
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
import { CompanyLogo } from "@/components/ui/company-logo";

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
  Target: "bg-surface-raised",
  Awareness: "bg-accent",
  Consideration: "bg-accent",
  Decision: "bg-accent",
  Purchase: "bg-accent",
};

// Heat = a status read on the near-black canvas: tint + glyph + word, never color alone.
// Emerald reads "strong/healthy", amber "cooling/mid", slate "low" — red stays reserved for hard alerts.
function heatMeta(score: number) {
  if (score >= 70) return { label: "Hot", glyph: "▲", text: "text-positive", bar: "bg-positive", soft: "bg-positive-subtle", edge: "border-positive/30" };
  if (score >= 40) return { label: "Warm", glyph: "●", text: "text-caution", bar: "bg-caution", soft: "bg-caution-subtle", edge: "border-caution/30" };
  return { label: "Cold", glyph: "○", text: "text-ink-muted", bar: "bg-surface-raised", soft: "bg-muted", edge: "border-border-strong" };
}

const CARD = "bg-card border-border shadow-none";

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
  const { data: brain } = trpc.intel.brain.useQuery();

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
      <div className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      <div className="container py-1">
        {/* Workspace Brain — what this tool knows that no single silo does. Verified
            figures computed by code; lessons accumulated by the AI across learning cycles,
            each citing the evidence it saw. */}
        {brain && (
          <div className="mb-6 rounded-sm border border-accent/30 bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-accent">
                Workspace Brain
                <span className="ml-2 tabular-nums text-xs text-ink-muted">
                  cycle {brain.cycles}{brain.learning ? " · learning…" : ""}
                </span>
              </h2>
              <span className="tabular-nums text-xs text-ink-muted">
                {brain.snapshot.totals.accounts} accts · ${brain.snapshot.totals.openPipeline.toLocaleString()} open · {brain.snapshot.totals.hotAccounts} hot
              </span>
            </div>
            {brain.snapshot.risks.length > 0 && (
              <p className="text-xs text-caution mb-2">⚠ {brain.snapshot.risks[0]}</p>
            )}
            {brain.lessons.length > 0 ? (
              <ul className="space-y-1.5">
                {brain.lessons.slice(0, 4).map((l: any, i: number) => (
                  <li key={i} className="text-sm text-foreground leading-snug">
                    • {l.lesson}
                    {l.evidence && <span className="text-xs text-ink-muted"> — {l.evidence}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-ink-muted">No accumulated lessons yet — the brain learns in the background as data changes.</p>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Data Analytics Studio</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {isRepMode ? `${repInfo?.region} territory · ` : ''}Every figure is computed from live account data — click any segment to drill in.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
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
          <div className="mb-6 p-4 rounded-md bg-accent/[0.06] border border-accent/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-4 w-4 text-accent" />
                <span className="text-foreground text-sm">
                  Filtering by {activeFilter.type}: <span className="text-accent font-medium">{activeFilter.label}</span>
                </span>
                <Badge variant="outline" className="border-accent/30 text-accent tabular-nums">
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
            <TabsTrigger value="engagement" className="data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <Activity className="h-4 w-4 mr-2" />
              Engagement
            </TabsTrigger>
            <TabsTrigger value="6qa" className="data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <Target className="h-4 w-4 mr-2" />
              6QA Performance
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            {/* Portfolio pulse — one lead read (hot leads) with supporting stats, not a grid of identical cards */}
            <Card className={`${CARD} mb-8`}>
              <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                <div className="lg:w-72 lg:pr-6 lg:border-r lg:border-border">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-ink-muted">
                    <Flame className="h-4 w-4 text-positive" />
                    Hot leads right now
                  </div>
                  <div className="mt-3 flex flex-wrap items-baseline gap-3">
                    <span className="tabular-nums text-5xl font-semibold text-accent leading-none">
                      {intentBuckets.hot}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-positive">
                      <span aria-hidden>▲</span> Hot
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">
                    Accounts at intent <span className="tabular-nums">70+</span> — the queue to work before a competitor does.
                  </p>
                </div>

                <div className="flex-1 grid grid-cols-3 divide-x divide-border">
                  <div className="pr-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
                      <Building2 className="h-3.5 w-3.5" /> Accounts
                    </div>
                    <div className="mt-2 tabular-nums text-2xl text-foreground">
                      {activeFilter ? filteredAccounts.length : totalAccounts}
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {activeFilter ? `filtered from ${totalAccounts}` : "in territory"}
                    </div>
                  </div>
                  <div className="px-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
                      <Users className="h-3.5 w-3.5" /> Key contacts
                    </div>
                    <div className="mt-2 tabular-nums text-2xl text-foreground">
                      {totalContacts.toLocaleString()}
                    </div>
                    <div className="text-xs text-ink-muted mt-1">decision makers</div>
                  </div>
                  <div className="pl-4">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-muted">
                      <Activity className="h-3.5 w-3.5" /> Avg intent
                    </div>
                    <div className="mt-2 tabular-nums text-2xl text-accent">
                      {avgIntent.toFixed(0)}
                    </div>
                    <div className="text-xs text-ink-muted mt-1">
                      {totalCalls.toLocaleString()} calls logged
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Intent Distribution */}
              <Card className={`${CARD} transition-colors ${activeFilter?.type === "intent" ? "ring-1 ring-accent" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                    <Activity className="h-4 w-4 text-accent" />
                    Intent distribution
                  </CardTitle>
                  <CardDescription className="text-ink-muted">Split of the queue by heat — click to filter</CardDescription>
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
                            active ? `${meta.soft} ${meta.edge}` : "border-border hover:bg-muted"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className={`text-sm font-medium flex items-center gap-1.5 ${meta.text}`}>
                              <span aria-hidden>{meta.glyph}</span> {b.label}
                              <span className="text-ink-muted font-normal">· {b.range}</span>
                            </span>
                            <span className="tabular-nums text-lg text-foreground">{b.count}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${meta.bar} rounded-sm`} style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Industries */}
              <Card className={`${CARD} transition-colors ${activeFilter?.type === "industry" ? "ring-1 ring-accent" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Top industries
                  </CardTitle>
                  <CardDescription className="text-ink-muted">Account volume by industry</CardDescription>
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
                            className={`w-full text-left p-2 rounded-sm transition-colors ${ active ? "bg-accent-subtle ring-1 ring-accent" : "hover:bg-muted" }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-sm text-ink-muted truncate max-w-[150px]">{industry}</span>
                              <span className="tabular-nums text-sm text-foreground">{count as number}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent rounded-sm"
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
              <Card className={`${CARD} transition-colors ${activeFilter?.type === "region" ? "ring-1 ring-accent" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                    <MapPin className="h-4 w-4 text-accent" />
                    Geographic distribution
                  </CardTitle>
                  <CardDescription className="text-ink-muted">Account volume by region</CardDescription>
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
                            className={`w-full text-left p-2 rounded-sm transition-colors ${ active ? "bg-accent-subtle ring-1 ring-accent" : "hover:bg-muted" }`}
                          >
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-sm text-ink-muted">{region}</span>
                              <span className="tabular-nums text-sm text-foreground">{count as number}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent rounded-sm"
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
            <Card className={`${CARD} mb-8 transition-colors ${activeFilter?.type === "buyingStage" ? "ring-1 ring-accent" : ""}`}>
              <CardHeader>
                <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                  <Target className="h-4 w-4 text-accent" />
                  Buying-stage funnel
                </CardTitle>
                <CardDescription className="text-ink-muted">Accounts by 6sense stage, earliest to latest — click a stage to filter</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {orderedStages.map(([stage, count]) => {
                    const isActive = activeFilter?.type === "buyingStage" && activeFilter?.value === stage;
                    const bar = stageBar[stage] || "bg-surface-raised";
                    const pct = ((count as number) / maxStageCount) * 100;
                    return (
                      <button
                        key={stage}
                        onClick={() => handleFilterClick("buyingStage", stage, stage)}
                        className={`w-full text-left rounded-sm p-2 transition-colors ${ isActive ? "bg-accent-subtle ring-1 ring-accent" : "hover:bg-muted" }`}
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="w-28 shrink-0 text-sm text-ink-muted">{stage}</span>
                          <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden">
                            <div className={`h-full ${bar} rounded-md`} style={{ width: `${Math.max(pct, 3)}%` }} />
                          </div>
                          <span className="w-12 shrink-0 text-right tabular-nums text-sm text-foreground">
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-foreground text-base">Filtered accounts</CardTitle>
                      <CardDescription className="text-ink-muted">
                        {filteredAccounts.length} accounts matching “{activeFilter.label}”
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilter} className="gap-2 border-border-strong text-ink-muted hover:bg-muted">
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
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Company</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Industry</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Region</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Buying stage</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Intent</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Employees</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 20).map((account: any) => {
                          const meta = heatMeta(Number(account.intentScore) || 0);
                          return (
                            <tr key={account.id} className="border-b border-border hover:bg-muted transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  <CompanyLogo name={account.name} website={account.domain} size="md" />
                                  <div>
                                    <div className="font-medium text-foreground">{account.name}</div>
                                    <div className="text-xs text-ink-muted">{account.domain}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-ink-muted">{account.industry || "Unknown"}</td>
                              <td className="py-3 px-4 text-sm text-ink-muted">{account.region || "Unknown"}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-xs border-border-strong text-ink-muted">
                                  {account.sixsenseBuyingStage || "Unknown"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-flex items-center gap-1.5 tabular-nums ${meta.text}`}>
                                  <span aria-hidden>{meta.glyph}</span>{account.intentScore || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-sm text-ink-muted">
                                {account.employeeCount?.toLocaleString() || "—"}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link href={`/accounts/${account.id}`}>
                                  <Button variant="ghost" size="sm" className="gap-1 text-accent hover:text-accent">
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
              <Card className={CARD}>
                <CardContent className="py-12 text-center">
                  <div className="text-ink-muted mb-4">No accounts found matching “{activeFilter.label}”</div>
                  <Button variant="outline" onClick={clearFilter} className="border-border-strong text-ink-muted hover:bg-muted">Clear Filter</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords" className="mt-6">
            <Card className={`${CARD} mb-6`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                      <Hash className="h-4 w-4 text-accent" />
                      6sense intent keywords
                    </CardTitle>
                    <CardDescription className="text-ink-muted">
                      {keywords?.dataAsOf ? `Data as of ${new Date(keywords.dataAsOf).toLocaleDateString()}` : "Loading…"}
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                    <input
                      type="text"
                      placeholder="Search keywords…"
                      value={keywordSearch}
                      onChange={(e) => setKeywordSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-muted border border-border-strong rounded-md text-foreground text-sm placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent/30"
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
                        className={`p-4 rounded-sm bg-card border transition-colors cursor-pointer group ${active ? "border-accent/30 ring-1 ring-accent" : "border-border hover:border-accent/30"}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <Hash className="h-4 w-4 text-accent shrink-0" />
                            <span className="font-medium text-foreground truncate group-hover:text-accent transition-colors">
                              {kw.keyword}
                            </span>
                          </div>
                          {kw.category && (
                            <Badge variant="outline" className="text-xs border-border-strong text-ink-muted shrink-0">
                              {kw.category}
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-muted rounded-md p-2">
                            <div className="text-ink-muted text-xs">Accounts</div>
                            <div className="text-foreground tabular-nums">{kw.totalAccounts}</div>
                          </div>
                          <div className="bg-muted rounded-md p-2">
                            <div className="text-ink-muted text-xs">Web visits</div>
                            <div className="text-accent tabular-nums">{kw.accountsWithWebVisits}</div>
                          </div>
                          <div className="bg-muted rounded-md p-2">
                            <div className="text-ink-muted text-xs">6QA</div>
                            <div className="text-positive tabular-nums">{kw.accountsWith6QA}</div>
                          </div>
                          <div className="bg-muted rounded-md p-2">
                            <div className="text-ink-muted text-xs">Opps</div>
                            <div className="text-caution tabular-nums">{kw.accountsWithOpportunities}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredKeywords.length === 0 && (
                  <div className="text-center py-12 text-ink-muted">
                    {keywordSearch ? `No keywords matching “${keywordSearch}”` : "No keyword data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Filtered Accounts Table for Keywords */}
            {activeFilter?.type === "keyword" && filteredAccounts.length > 0 && (
              <Card className={CARD}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                        <Building2 className="h-4 w-4 text-accent" />
                        Accounts researching “{activeFilter.value}”
                      </CardTitle>
                      <CardDescription className="text-ink-muted">
                        {filteredAccounts.length} accounts likely researching this topic, from {activeFilter.category || "intent"} signals
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={clearFilter} className="gap-2 border-border-strong text-ink-muted hover:bg-muted">
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
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Company</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Industry</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Buying stage</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Intent</th>
                          <th className="text-left py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Security stack</th>
                          <th className="text-right py-3 px-4 text-xs font-semibold tracking-wide text-ink-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.slice(0, 25).map((account: any) => {
                          const meta = heatMeta(Number(account.intentScore) || 0);
                          return (
                            <tr key={account.id} className="border-b border-border hover:bg-muted transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap items-center gap-3">
                                  <CompanyLogo name={account.name} website={account.domain} size="md" />
                                  <div>
                                    <div className="font-medium text-foreground">{account.name}</div>
                                    <div className="text-xs text-ink-muted">{account.domain}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-sm text-ink-muted">{account.industry || "Unknown"}</td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className="text-xs border-border-strong text-ink-muted">
                                  {account.sixsenseBuyingStage || "Unknown"}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className={`inline-flex items-center gap-1.5 tabular-nums ${meta.text}`}>
                                  <span aria-hidden>{meta.glyph}</span>{account.intentScore || 0}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-sm text-ink-muted max-w-[200px] truncate">
                                {(() => {
                                  const rawData = account.rawData as Record<string, unknown> | null;
                                  const sso = rawData?.['SSO Provider'] as string || '';
                                  return sso || account.securityStack?.slice(0, 50) || '—';
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
                          );
                        })}
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
              <Card className={CARD}>
                <CardContent className="py-12 text-center">
                  <div className="text-ink-muted mb-4">No accounts found researching “{activeFilter.value}”</div>
                  <Button variant="outline" onClick={clearFilter} className="border-border-strong text-ink-muted hover:bg-muted">Clear Filter</Button>
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
                  <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                    <Activity className="h-4 w-4 text-accent" />
                    Engagement states
                  </CardTitle>
                  <CardDescription className="text-ink-muted">
                    {engagement?.timeWindow || "Loading…"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {engagement?.metrics?.map((metric, idx) => (
                      <div key={idx} className="p-4 rounded-sm bg-muted border border-border">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-medium text-foreground">{metric.state}</span>
                          <span className="tabular-nums text-lg text-accent">{metric.accounts}</span>
                        </div>
                        {metric.amount && (
                          <div className="mt-1 text-sm text-ink-muted">
                            Pipeline <span className="text-positive tabular-nums">${Number(metric.amount).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {(!engagement?.metrics || engagement.metrics.length === 0) && (
                      <div className="text-center py-8 text-ink-muted">No engagement data available</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Buying Stage Pipeline */}
              <Card className={CARD}>
                <CardHeader>
                  <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                    <Target className="h-4 w-4 text-accent" />
                    Buying-stage pipeline
                  </CardTitle>
                  <CardDescription className="text-ink-muted">
                    {buyingStages?.timeframe || "Loading…"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {buyingStages?.stages?.map((stage, idx) => {
                      const bar = stageBar[stage.stage] || "bg-surface-raised";
                      const maxAccounts = Math.max(...(buyingStages?.stages?.map(s => s.accounts) || [1]));
                      return (
                        <div key={idx} className="group">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-ink-muted">{stage.stage}</span>
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="tabular-nums text-sm text-foreground">{stage.accounts}</span>
                              {Number(stage.newPipeline) > 0 && (
                                <span className="text-xs text-positive tabular-nums">
                                  +${(Number(stage.newPipeline) / 1000).toFixed(0)}k
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${bar} rounded-sm transition-all group-hover:opacity-80`}
                              style={{ width: `${(stage.accounts / maxAccounts) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {buyingStages?.totalAccounts && (
                    <div className="mt-6 pt-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-muted">Total in pipeline</span>
                        <span className="tabular-nums text-2xl text-foreground">{buyingStages.totalAccounts}</span>
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
                <CardTitle className="text-foreground text-base flex flex-wrap items-center gap-2">
                  <Zap className="h-4 w-4 text-accent" />
                  6QA performance
                </CardTitle>
                <CardDescription className="text-ink-muted">
                  6sense Qualified Accounts
                  {sixQAPerformance?.dataAsOf ? ` · data as of ${new Date(sixQAPerformance.dataAsOf).toLocaleDateString()}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sixQAPerformance?.latest ? (
                  <div className="space-y-6">
                    {/* Headline funnel row: total → worked → gap → rate */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-muted rounded-sm overflow-hidden">
                      <div className="bg-card p-4">
                        <div className="text-xs font-semibold tracking-wide text-ink-muted">Total 6QA</div>
                        <div className="mt-2 tabular-nums text-2xl text-accent">
                          {sixQAPerformance.latest.total6QAs || 0}
                        </div>
                      </div>
                      <div className="bg-card p-4">
                        <div className="text-xs font-semibold tracking-wide text-ink-muted flex flex-wrap items-center gap-1.5">
                          <span aria-hidden className="text-positive">▲</span> Worked
                        </div>
                        <div className="mt-2 tabular-nums text-2xl text-positive">
                          {sixQAPerformance.latest.worked || 0}
                        </div>
                      </div>
                      <div className="bg-card p-4">
                        <div className="text-xs font-semibold tracking-wide text-ink-muted flex flex-wrap items-center gap-1.5">
                          <span aria-hidden className="text-caution">●</span> Unworked gap
                        </div>
                        <div className="mt-2 tabular-nums text-2xl text-caution">
                          {sixQAPerformance.latest.unworked || 0}
                        </div>
                      </div>
                      <div className="bg-card p-4">
                        <div className="text-xs font-semibold tracking-wide text-ink-muted">Work rate</div>
                        <div className="mt-2 tabular-nums text-2xl text-foreground">
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
                        <div key={m.label} className="p-4 rounded-sm bg-muted border border-border">
                          <div className="text-xs text-ink-muted">{m.label}</div>
                          <div className="mt-1 tabular-nums text-xl text-foreground">
                            {m.value ?? "—"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* New 6QAs */}
                    {sixQAPerformance.latest.new6QAs !== null && sixQAPerformance.latest.new6QAs > 0 && (
                      <div className="p-4 rounded-sm bg-positive/[0.08] border border-positive/30">
                        <div className="flex flex-wrap items-center gap-3">
                          <Zap className="h-5 w-5 text-positive shrink-0" />
                          <div>
                            <div className="text-foreground font-medium">
                              <span className="tabular-nums">+{sixQAPerformance.latest.new6QAs}</span> new 6QAs
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
