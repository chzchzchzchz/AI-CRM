import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Building2, Users, MapPin, TrendingUp, ExternalLink, Search,
  Filter, ArrowUpDown, Loader2, Target, Zap, Eye
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/LoadingSkeleton";

type SortField = "name" | "intentScore" | "employees" | "industry";
type SortOrder = "asc" | "desc";

export default function AccountsEnhanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("intentScore");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();

  // Extract unique values for filters
  const regions = useMemo(() => {
    if (!accounts) return [];
    return Array.from(new Set(accounts.map(a => a.region).filter(Boolean)));
  }, [accounts]);

  const industries = useMemo(() => {
    if (!accounts) return [];
    return Array.from(new Set(accounts.map(a => a.industry).filter(Boolean)));
  }, [accounts]);

  // Filter and sort accounts
  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];

    let filtered = accounts.filter(account => {
      // Search filter
      const matchesSearch = !searchQuery || 
        account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.domain?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        account.description?.toLowerCase().includes(searchQuery.toLowerCase());

      // Region filter
      const matchesRegion = regionFilter === "all" || account.region === regionFilter;

      // Industry filter
      const matchesIndustry = industryFilter === "all" || account.industry === industryFilter;

      // Intent filter
      let matchesIntent = true;
      if (intentFilter !== "all" && account.intentScore) {
        const score = parseInt(account.intentScore);
        if (intentFilter === "hot") matchesIntent = score >= 70;
        else if (intentFilter === "warm") matchesIntent = score >= 40 && score < 70;
        else if (intentFilter === "cold") matchesIntent = score < 40;
      }

      return matchesSearch && matchesRegion && matchesIndustry && matchesIntent;
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
  }, [accounts, searchQuery, regionFilter, industryFilter, intentFilter, sortField, sortOrder]);

  const getIntentBadge = (score: string) => {
    const numScore = parseInt(score);
    if (numScore >= 70) return { color: "bg-green-500/20 text-green-400 border-green-500/50", label: "Hot", icon: Zap };
    if (numScore >= 40) return { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50", label: "Warm", icon: TrendingUp };
    return { color: "bg-orange-500/20 text-orange-400 border-orange-500/50", label: "Cold", icon: Target };
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <AIAssistant context={{ type: "general" }} />

      <div className="container py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Target Accounts</h1>
            <p className="text-slate-400">
              {filteredAccounts.length} of {accounts?.length || 0} accounts
            </p>
          </div>
          <Link href="/email-generator">
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              Generate Outreach
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search accounts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Region Filter */}
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="All Regions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {regions.map(region => (
                    <SelectItem key={region} value={region!}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Industry Filter */}
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="All Industries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map(industry => (
                    <SelectItem key={industry} value={industry!}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Intent Filter */}
              <Select value={intentFilter} onValueChange={setIntentFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="All Intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intent</SelectItem>
                  <SelectItem value="hot">🔥 Hot (70+)</SelectItem>
                  <SelectItem value="warm">⚡ Warm (40-69)</SelectItem>
                  <SelectItem value="cold">❄️ Cold (&lt;40)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800">
              <ArrowUpDown className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-400">Sort by:</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("intentScore")}
                  className={sortField === "intentScore" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-400"}
                >
                  Intent {sortField === "intentScore" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("name")}
                  className={sortField === "name" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-400"}
                >
                  Name {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("employees")}
                  className={sortField === "employees" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-400"}
                >
                  Size {sortField === "employees" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accounts Grid */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : filteredAccounts.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="py-20 text-center">
              <Filter className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No accounts found</h3>
              <p className="text-slate-400">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map((account) => {
              const intentBadge = account.intentScore ? getIntentBadge(account.intentScore) : null;
              const IntentIcon = intentBadge?.icon;

              return (
                <Link key={account.id} href={`/accounts/${account.id}`}>
                  <Card className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-white group-hover:text-cyan-400 transition-colors text-lg mb-2 truncate">
                            {account.name}
                          </CardTitle>
                          {account.domain && (
                            <a
                              href={`https://${account.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 mb-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">{account.domain}</span>
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                          )}
                        </div>
                        {intentBadge && IntentIcon && (
                          <Badge variant="outline" className={intentBadge.color}>
                            <IntentIcon className="h-3 w-3 mr-1" />
                            {account.intentScore}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {account.description && (
                          <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                            {account.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {account.industry && (
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {account.industry}
                            </Badge>
                          )}
                          {account.employeeCount && (
                            <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {account.employeeCount}
                            </Badge>
                          )}
                          {account.region && (
                            <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                              <MapPin className="h-3 w-3 mr-1" />
                              {account.region}
                            </Badge>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-xs text-slate-500">View Details</span>
                          <Eye className="h-4 w-4 text-slate-600 group-hover:text-cyan-500 transition-colors" />
                        </div>
                      </div>
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
}
