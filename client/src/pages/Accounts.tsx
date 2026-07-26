import { memo, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Building2, Users, MapPin, TrendingUp, Search, ArrowUpDown, Flame,
  Mail, Snowflake, Clock, Activity, ChevronRight
} from "lucide-react";
import { ContextualAI } from "@/components/ContextualAI";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRep } from "@/contexts/RepContext";
import { RepSwitcher } from "@/components/RepSwitcher";
import { CompanyLogo } from "@/components/ui/company-logo";

type SortField = "name" | "intentScore" | "employees" | "industry";
type SortOrder = "asc" | "desc";

const AccountsEnhanced = memo(function AccountsEnhanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("intentScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Get rep context for territory filtering
  const { matchesTerritory, repInfo, isRepMode } = useRep();

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery(undefined, {
    staleTime: 3 * 60 * 1000
  });

  // Extract unique values for filters
  const regions = useMemo(() => {
    if (!accounts) return [];
    return Array.from(new Set(accounts.map((a: any) => a.region).filter(Boolean))) as string[];
  }, [accounts]);

  // MFA/Identity Provider options - hardcoded list of identity/auth vendors
  const MFA_PROVIDERS = [
    "Ping Identity",
    "Okta",
    "Duo Security",
    "Azure AD",
    "OneLogin",
    "ForgeRock",
    "Auth0",
    "CyberArk",
    "RSA SecurID",
    "SailPoint",
    "Saviynt",
    "IBM Security Verify",
    "Oracle Identity",
    "SecureAuth",
    "Thales SafeNet"
  ];

  // Extract MFA/Identity providers found in accounts' techStack
  const mfaProviders = useMemo(() => {
    if (!accounts) return [];
    const foundProviders = new Set<string>();

    accounts.forEach((account: any) => {
      if (account.techStack) {
        const techLower = String(account.techStack).toLowerCase();
        MFA_PROVIDERS.forEach(provider => {
          // Check for provider name in tech stack (case insensitive)
          const providerLower = provider.toLowerCase();
          const shortName = providerLower.split(' ')[0]; // e.g., "ping" from "Ping Identity"
          if (techLower.includes(providerLower) || techLower.includes(shortName)) {
            foundProviders.add(provider);
          }
        });
      }
    });

    // Return sorted list of found providers
    return Array.from(foundProviders).sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  const industries = ["AI", "Software", "Finance", "Manufacturing", "Other"];

  const normalizeIndustry = (industry: string | null | undefined): string => {
    if (!industry) return "Other";
    const lower = industry.toLowerCase().trim();

    if (lower === "ai" || lower === "artificial intelligence" || lower === "machine learning" ||
        lower === "ai/ml" || lower.startsWith("ai ") || lower.endsWith(" ai")) return "AI";

    if (lower === "software" || lower === "saas" || lower === "technology" ||
        lower === "software development" || lower === "enterprise software" ||
        lower.includes("software") && !lower.includes("services")) return "Software";

    if (lower === "finance" || lower === "banking" || lower === "fintech" ||
        lower === "financial services" || lower.includes("bank") ||
        lower.includes("financial")) return "Finance";

    if (lower === "manufacturing" || lower === "industrial" ||
        lower.includes("manufacturing") || lower.includes("production") ||
        lower.includes("factory")) return "Manufacturing";

    return "Other";
  };

  // Filter and sort accounts
  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];

    let filtered = accounts.filter((account: any) => {
      // Rep territory filter (if in rep mode)
      const employeeCount = parseInt(String(account.employeeCount || '0').replace(/[^0-9]/g, '') || '0');
      const matchesRepTerritory = matchesTerritory(account.region || '', employeeCount);
      if (!matchesRepTerritory) return false;

      const matchesSearch = !searchQuery ||
        account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.description?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRegion = regionFilter === "all" || account.region === regionFilter;
      const matchesRelationship = relationshipFilter === "all" || account.relationship === relationshipFilter;

      const normalizedIndustry = normalizeIndustry(account.industry);
      const matchesIndustry = industryFilter === "all" || normalizedIndustry === industryFilter;

      let matchesIntent = true;
      if (intentFilter !== "all" && account.intentScore) {
        const score = parseInt(String(account.intentScore));
        if (intentFilter === "hot") matchesIntent = score >= 70;
        else if (intentFilter === "warm") matchesIntent = score >= 40 && score < 70;
        else if (intentFilter === "cold") matchesIntent = score < 40;
      }

      // MFA Provider filter - match by provider name or short name
      let matchesTech = true;
      if (techFilter !== "all") {
        const accountTech = String(account.techStack || '').toLowerCase();
        const filterLower = techFilter.toLowerCase();
        const shortName = filterLower.split(' ')[0]; // e.g., "ping" from "Ping Identity"
        matchesTech = accountTech.includes(filterLower) || accountTech.includes(shortName);
      }

      return matchesSearch && matchesRegion && matchesIndustry && matchesRelationship && matchesIntent && matchesTech;
    });

    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "intentScore":
          aVal = parseInt(String(a.intentScore || "0"));
          bVal = parseInt(String(b.intentScore || "0"));
          break;
        case "employees":
          aVal = parseInt(String(a.employeeCount || "0").replace(/[^0-9]/g, "") || "0");
          bVal = parseInt(String(b.employeeCount || "0").replace(/[^0-9]/g, "") || "0");
          break;
        case "industry":
          aVal = a.industry || "";
          bVal = b.industry || "";
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [accounts, searchQuery, regionFilter, industryFilter, relationshipFilter, intentFilter, techFilter, sortField, sortOrder]);

  // Intent heat: tinted text + glyph + word, never color alone.
  const getHeat = (score: number) => {
    if (score >= 70) return { label: "Hot", Icon: Flame, text: "text-critical" };
    if (score >= 40) return { label: "Warm", Icon: TrendingUp, text: "text-caution" };
    return { label: "Cold", Icon: Snowflake, text: "text-accent" };
  };

  const handleToggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(order => order === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }, [sortField]);

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="container py-10 space-y-6 max-w-7xl">
          <div className="space-y-3">
            <div className="h-9 w-80 skeleton" />
            <div className="h-5 w-56 skeleton" />
          </div>
          <div className="h-20 skeleton rounded-md" />
          <div className="h-16 skeleton rounded-md" />
          <div className="rounded-md border border-border/60 divide-y divide-border/50 overflow-hidden">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-none" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hotCount = filteredAccounts.filter((a: any) => parseInt(String(a.intentScore || "0")) >= 70).length;
  const warmCount = filteredAccounts.filter((a: any) => {
    const score = parseInt(String(a.intentScore || "0"));
    return score >= 40 && score < 70;
  }).length;

  const stats: { key: string; label: string; value: number; Icon: any; text: string; hint: string; filter: string }[] = [
    { key: "hot", label: "Hot leads", value: hotCount, Icon: Flame, text: "text-critical", hint: "Intent 70+", filter: "hot" },
    { key: "warm", label: "Warm leads", value: warmCount, Icon: TrendingUp, text: "text-caution", hint: "Intent 40–69", filter: "warm" },
    { key: "all", label: "Total accounts", value: filteredAccounts.length, Icon: Building2, text: "text-foreground", hint: "Reset intent filter", filter: "all" },
  ];

  return (
    <div>

      <div className="container py-10 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-xl font-semibold tracking-tight">Target Accounts</h1>
            <p className="mt-1 text-sm text-ink-muted">
              <span className="tabular-nums text-ink-muted">{filteredAccounts.length}</span> accounts
              {isRepMode && <> · {repInfo?.region} territory</>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RepSwitcher />
            <Button asChild className="bg-accent text-foreground hover:bg-accent font-medium">
              <Link href="/outreach">
                <Mail className="mr-2 h-4 w-4" />
                Generate Outreach
              </Link>
            </Button>
          </div>
        </div>

        {/* AI Assistant Bar */}
        <ContextualAI context="accounts" placeholder="Ask AI: Which accounts have the highest intent?" />

        {/* Quick Stats - segmented, clickable intent filters */}
        <div className="grid grid-cols-3 rounded-md border border-border/60 bg-card divide-x divide-border/50 overflow-hidden">
          {stats.map((s) => {
            const active = intentFilter === s.filter;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setIntentFilter(s.filter)}
                aria-pressed={active}
                className={`text-left px-4 py-4 sm:px-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${active ? "bg-surface/[0.04]" : "hover:bg-surface/[0.025]"}`}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
                  <s.Icon className={`h-3.5 w-3.5 ${s.text}`} />
                  {s.label}
                </div>
                <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.text}`}>{s.value}</div>
                <div className="mt-0.5 text-[11px] text-ink-subtle">{s.hint}{active ? " · active" : ""}</div>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="rounded-md border border-border/60 bg-card">
          <div className="p-4 sm:p-5">
            <div className="grid md:grid-cols-7 gap-3">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                  <Input
                    placeholder="Search accounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map((region: string) => (
                    <SelectItem key={region} value={region!}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map(industry => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Prospect">Prospects</SelectItem>
                  <SelectItem value="Customer">Customers</SelectItem>
                  <SelectItem value="Partner">Partners</SelectItem>
                  <SelectItem value="POV">POVs</SelectItem>
                </SelectContent>
              </Select>

              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intent</SelectItem>
                  <SelectItem value="hot">Hot (70+)</SelectItem>
                  <SelectItem value="warm">Warm (40-69)</SelectItem>
                  <SelectItem value="cold">Cold (&lt;40)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="MFA Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All MFA</SelectItem>
                  {mfaProviders.map((provider: string) => (
                    <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/50">
              <span className="text-xs font-medium text-ink-muted">Sort by</span>
              <Button
                variant={sortField === "intentScore" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("intentScore")}
              >
                Intent Score
                {sortField === "intentScore" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                variant={sortField === "name" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("name")}
              >
                Name
                {sortField === "name" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                variant={sortField === "employees" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("employees")}
              >
                Size
                {sortField === "employees" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Accounts List */}
        {filteredAccounts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No accounts found</h3>
              <p className="text-ink-muted">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
            {filteredAccounts.map((account: any) => {
              const numScore = parseInt(String(account.intentScore || "0"));
              const hasScore = !!account.intentScore && numScore > 0;
              const heat = getHeat(numScore);
              const HeatIcon = heat.Icon;

              const rawData = (account.rawData as Record<string, any>) || {};
              const daysSinceActivity = rawData.daysSinceLastEngagement ?? rawData.lastSalesActivityDays;
              const salesActivities = rawData.salesActivities || 0;

              const freshText =
                daysSinceActivity == null ? "" :
                daysSinceActivity <= 7 ? "text-positive" :
                daysSinceActivity <= 30 ? "text-caution" : "text-critical";

              return (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <div className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                    {/* Company Logo */}
                    <CompanyLogo name={account.name} website={account.domain} size="md" />

                    {/* Identity + meta */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[15px] text-foreground truncate group-hover:text-accent transition-colors">
                          {account.name}
                        </span>
                        {account.relationship && (
                          <span className="hidden sm:inline text-[10px] font-medium uppercase tracking-wide text-ink-muted bg-muted rounded px-1.5 py-0.5 flex-shrink-0">
                            {account.relationship}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                        <span className="truncate">{account.domain}</span>
                        {account.industry && (
                          <span className="flex items-center gap-1 before:content-['·'] before:text-ink-subtle">
                            <Building2 className="h-3 w-3" />{account.industry}
                          </span>
                        )}
                        {account.employeeCount && (
                          <span className="flex items-center gap-1 before:content-['·'] before:text-ink-subtle">
                            <Users className="h-3 w-3" />{account.employeeCount}
                          </span>
                        )}
                        {account.region && (
                          <span className="flex items-center gap-1 before:content-['·'] before:text-ink-subtle">
                            <MapPin className="h-3 w-3" />{account.region}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Freshness signals */}
                    <div className="hidden lg:flex items-center gap-4 flex-shrink-0 text-xs">
                      {daysSinceActivity != null && (
                        <span className={`flex items-center gap-1 ${freshText}`}>
                          <Clock className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{daysSinceActivity}d</span>
                        </span>
                      )}
                      {salesActivities > 0 && (
                        <span className="flex items-center gap-1 text-ink-muted">
                          <Activity className="h-3.5 w-3.5" />
                          <span className="tabular-nums">{salesActivities}</span>
                        </span>
                      )}
                    </div>

                    {/* Intent score + heat */}
                    <div className="flex items-center gap-3 flex-shrink-0 pl-1">
                      <div className="text-right w-16">
                        <div className="text-lg leading-none tabular-nums text-accent">
                          {hasScore ? numScore : <span className="text-ink-subtle">—</span>}
                        </div>
                        {hasScore && (
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] font-medium ${heat.text}`}>
                            <HeatIcon className="h-3 w-3" />
                            {heat.label}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-ink-subtle group-hover:text-ink-muted transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default function Accounts() {
  return <AccountsEnhanced />;
}
