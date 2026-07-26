import { memo, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreBar } from "@/components/ui/charts";
import { MetricGrid } from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanyLogo } from "@/components/ui/company-logo";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  ArrowUpDown, Building2, ChevronRight, Flame, Mail, Search, TrendingUp,
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
  const [, setLocation] = useLocation();

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
      <div className="container max-w-[1500px] space-y-5 py-1">
        <div className="space-y-2">
          <div className="skeleton h-6 w-56" />
          <div className="skeleton h-4 w-40" />
        </div>
        <div className="skeleton h-11 w-full" />
        <div className="skeleton h-20 w-full" />
        <div className="skeleton h-[420px] w-full" />
      </div>
    );
  }

  const hotCount = filteredAccounts.filter((a: any) => parseInt(String(a.intentScore || "0")) >= 70).length;
  const warmCount = filteredAccounts.filter((a: any) => {
    const score = parseInt(String(a.intentScore || "0"));
    return score >= 40 && score < 70;
  }).length;

  const filtersActive =
    searchQuery !== "" ||
    regionFilter !== "all" ||
    industryFilter !== "all" ||
    relationshipFilter !== "all" ||
    intentFilter !== "all" ||
    techFilter !== "all";

  const resetFilters = () => {
    setSearchQuery("");
    setRegionFilter("all");
    setIndustryFilter("all");
    setRelationshipFilter("all");
    setIntentFilter("all");
    setTechFilter("all");
  };

  return (
    <div className="container max-w-[1500px] space-y-5 py-1">
      <PageHeader
        title="Target Accounts"
        description={
          isRepMode
            ? `${filteredAccounts.length} accounts in the ${repInfo?.region} territory`
            : `${filteredAccounts.length} accounts across all territories`
        }
        actions={
          <>
            <RepSwitcher />
            <Button asChild>
              <Link href="/outreach">
                <Mail className="size-4" />
                Generate outreach
              </Link>
            </Button>
          </>
        }
      />

      <ContextualAI
        context="accounts"
        placeholder="Ask about these accounts…"
      />

      {/* Intent split — each tile is a filter. */}
      <MetricGrid>
        <StatCard
          title="Hot"
          value={hotCount}
          subtitle="Intent 70+"
          icon={Flame}
          tone="critical"
          onClick={() => setIntentFilter(intentFilter === "hot" ? "all" : "hot")}
          className={intentFilter === "hot" ? "bg-muted" : undefined}
        />
        <StatCard
          title="Warm"
          value={warmCount}
          subtitle="Intent 40–69"
          icon={TrendingUp}
          tone="caution"
          onClick={() => setIntentFilter(intentFilter === "warm" ? "all" : "warm")}
          className={intentFilter === "warm" ? "bg-muted" : undefined}
        />
        <StatCard
          title="In view"
          value={filteredAccounts.length}
          subtitle={filtersActive ? "Filtered" : "All accounts"}
          icon={Building2}
          onClick={resetFilters}
        />
      </MetricGrid>

      {/* Filter bar */}
      <Card variant="sunken">
        <CardContent className="flex flex-wrap items-center gap-2 p-2.5">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search accounts…"
              className="pl-8"
            />
          </div>

          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="h-8 w-auto min-w-28 text-xs"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="h-8 w-auto min-w-28 text-xs"><SelectValue placeholder="Industry" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All industries</SelectItem>
              {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={relationshipFilter} onValueChange={setRelationshipFilter}>
            <SelectTrigger className="h-8 w-auto min-w-24 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="Customer">Customer</SelectItem>
              <SelectItem value="Prospect">Prospect</SelectItem>
              <SelectItem value="Opportunity">Opportunity</SelectItem>
            </SelectContent>
          </Select>

          {mfaProviders.length > 0 && (
            <Select value={techFilter} onValueChange={setTechFilter}>
              <SelectTrigger className="h-8 w-auto min-w-24 text-xs"><SelectValue placeholder="Identity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any identity stack</SelectItem>
                {mfaProviders.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Accounts table */}
      <Card className="overflow-hidden">
        {filteredAccounts.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No accounts match these filters"
            description="Widen the search or clear the filters to see the full list."
            action={<Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead field="name" label="Account" sortField={sortField} sortOrder={sortOrder} onSort={handleToggleSort} />
                <SortableHead field="intentScore" label="Intent" sortField={sortField} sortOrder={sortOrder} onSort={handleToggleSort} className="w-40" />
                <TableHead className="hidden md:table-cell">Stage</TableHead>
                <SortableHead field="industry" label="Industry" sortField={sortField} sortOrder={sortOrder} onSort={handleToggleSort} className="hidden lg:table-cell" />
                <SortableHead field="employees" label="Employees" sortField={sortField} sortOrder={sortOrder} onSort={handleToggleSort} className="hidden lg:table-cell text-right" />
                <TableHead className="hidden xl:table-cell">Region</TableHead>
                <TableHead className="hidden xl:table-cell">Activity</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((account: any) => {
                const score = parseInt(String(account.intentScore || "0"));
                const raw = (account.rawData as Record<string, any>) || {};
                const days = raw.daysSinceLastEngagement ?? raw.lastSalesActivityDays;
                const stage = account.sixsenseBuyingStage || account.relationship;

                return (
                  <TableRow
                    key={account.id}
                    className="group cursor-pointer"
                    onClick={() => setLocation(`/accounts/${account.id}`)}
                  >
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CompanyLogo name={account.name} website={account.domain} size="md" />
                        <div className="min-w-0">
                          <div className="truncate font-medium group-hover:text-accent">
                            {account.name}
                          </div>
                          <div className="truncate text-2xs text-ink-faint">
                            {account.domain}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <ScoreBar score={score} />
                    </TableCell>

                    <TableCell className="hidden md:table-cell">
                      {stage ? (
                        <Badge variant="secondary">{stage}</Badge>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </TableCell>

                    <TableCell className="hidden max-w-40 truncate text-ink-muted lg:table-cell">
                      {account.industry || "—"}
                    </TableCell>

                    <TableCell data-numeric className="hidden text-right text-ink-muted tabular-nums lg:table-cell">
                      {account.employeeCount
                        ? Number(String(account.employeeCount).replace(/[^0-9]/g, "")).toLocaleString()
                        : "—"}
                    </TableCell>

                    <TableCell className="hidden text-ink-muted xl:table-cell">
                      {account.region || "—"}
                    </TableCell>

                    <TableCell className="hidden xl:table-cell">
                      {days === null || days === undefined ? (
                        <span className="text-ink-faint">—</span>
                      ) : (
                        <StatusDot
                          tone={days <= 7 ? "positive" : days <= 30 ? "caution" : "critical"}
                          className="text-ink-muted"
                        >
                          {days}d ago
                        </StatusDot>
                      )}
                    </TableCell>

                    <TableCell>
                      <ChevronRight className="size-4 text-ink-faint transition-colors group-hover:text-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
});

/** Header cell that toggles sort and shows the current direction. */
function SortableHead({
  field,
  label,
  sortField,
  sortOrder,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const active = sortField === field;
  return (
    <TableHead className={className}>
      <button
        onClick={e => {
          e.stopPropagation();
          onSort(field);
        }}
        className="inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground"
      >
        {label}
        <ArrowUpDown
          className={cn(
            "size-3 transition-opacity",
            active ? "opacity-100 text-accent" : "opacity-0"
          )}
        />
        {active && <span className="sr-only">{sortOrder === "asc" ? "ascending" : "descending"}</span>}
      </button>
    </TableHead>
  );
}

export default function Accounts() {
  return <AccountsEnhanced />;
}
