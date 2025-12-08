import { memo, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Building2, Users, MapPin, TrendingUp, ExternalLink, Search,
  Filter, ArrowUpDown, Target, Zap, Eye, Flame, Mail, Sparkles
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortField = "name" | "intentScore" | "employees" | "industry";
type SortOrder = "asc" | "desc";

const AccountsEnhanced = memo(function AccountsEnhanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("intentScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery(undefined, {
    staleTime: 3 * 60 * 1000
  });

  // Extract unique values for filters
  const regions = useMemo(() => {
    if (!accounts) return [];
    return Array.from(new Set(accounts.map(a => a.region).filter(Boolean)));
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

    let filtered = accounts.filter(account => {
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
        const score = parseInt(account.intentScore);
        if (intentFilter === "hot") matchesIntent = score >= 70;
        else if (intentFilter === "warm") matchesIntent = score >= 40 && score < 70;
        else if (intentFilter === "cold") matchesIntent = score < 40;
      }

      return matchesSearch && matchesRegion && matchesIndustry && matchesRelationship && matchesIntent;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "intentScore":
          aVal = parseInt(a.intentScore || "0");
          bVal = parseInt(b.intentScore || "0");
          break;
        case "employees":
          aVal = parseInt(a.employeeCount?.replace(/[^0-9]/g, "") || "0");
          bVal = parseInt(b.employeeCount?.replace(/[^0-9]/g, "") || "0");
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
  }, [accounts, searchQuery, regionFilter, industryFilter, relationshipFilter, intentFilter, sortField, sortOrder]);

  const getIntentBadge = (score: string) => {
    const numScore = parseInt(score);
    if (numScore >= 70) return { 
      color: "badge-danger", 
      label: "Hot", 
      icon: Flame,
      gradient: "from-red-600 to-orange-600"
    };
    if (numScore >= 40) return { 
      color: "badge-warning", 
      label: "Warm", 
      icon: TrendingUp,
      gradient: "from-orange-600 to-amber-600"
    };
    return { 
      color: "badge-primary", 
      label: "Cold", 
      icon: Target,
      gradient: "from-blue-600 to-cyan-600"
    };
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navigation />
        <div className="container py-12 space-y-8 max-w-7xl">
          <div className="space-y-4">
            <div className="h-12 w-96 skeleton" />
            <div className="h-6 w-64 skeleton" />
          </div>
          <div className="h-32 skeleton rounded-xl" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hotCount = filteredAccounts.filter(a => parseInt(a.intentScore || "0") >= 70).length;
  const warmCount = filteredAccounts.filter(a => {
    const score = parseInt(a.intentScore || "0");
    return score >= 40 && score < 70;
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navigation />

      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold tracking-tight">Target Accounts</h1>
                <p className="text-muted-foreground text-lg mt-1">
                  {filteredAccounts.length} of {accounts?.length || 0} accounts
                </p>
              </div>
            </div>
          </div>
          <Button asChild className="gradient-primary text-white shadow-lg hover:shadow-xl">
            <Link href="/outreach">
              <Mail className="mr-2 h-5 w-5" />
              Generate Outreach
            </Link>
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="card-elevated border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Flame className="h-4 w-4 text-red-500" />
                Hot Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">{hotCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Intent score 70+</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                Warm Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{warmCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Intent score 40-69</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-500" />
                Total Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredAccounts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active accounts</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-6 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                  {regions.map(region => (
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
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Sort by:</span>
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
          </CardContent>
        </Card>

        {/* Accounts Grid */}
        {filteredAccounts.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-16 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No accounts found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAccounts.map((account) => {
              const intentBadge = getIntentBadge(account.intentScore || "0");
              const IntentIcon = intentBadge.icon;

              return (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <Card className="card-elevated hover:scale-[1.02] transition-all cursor-pointer group h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">
                            {account.name}
                          </CardTitle>
                          <CardDescription className="mt-1 line-clamp-1">
                            {account.domain}
                          </CardDescription>
                        </div>
                        <div className={`p-2 bg-gradient-to-br ${intentBadge.gradient} rounded-lg shadow-lg flex-shrink-0`}>
                          <IntentIcon className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Intent Score */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Intent Score</span>
                        <Badge className={intentBadge.color}>
                          {account.intentScore} {intentBadge.label}
                        </Badge>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 text-sm">
                        {account.industry && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4 flex-shrink-0" />
                            <span className="line-clamp-1">{account.industry}</span>
                          </div>
                        )}
                        {account.employeeCount && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4 flex-shrink-0" />
                            <span>{account.employeeCount} employees</span>
                          </div>
                        )}
                        {account.region && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span>{account.region}</span>
                          </div>
                        )}
                      </div>

                      {/* Relationship Badge */}
                      {account.relationship && (
                        <Badge variant="outline" className="w-fit">
                          {account.relationship}
                        </Badge>
                      )}

                      {/* Action Button */}
                      <Button 
                        variant="outline" 
                        className="w-full group-hover:border-primary group-hover:text-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          window.location.href = `/accounts/${account.id}`;
                        }}
                      >
                        View Details
                        <Eye className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
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
