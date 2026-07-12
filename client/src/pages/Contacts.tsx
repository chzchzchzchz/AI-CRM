import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import {
  User, Mail, Linkedin, MapPin, Building2, Search,
  Filter, ArrowUpDown, ExternalLink, Briefcase, Eye, Users, Sparkles, Phone, TrendingUp
} from "lucide-react";
import { ContextualAI } from "@/components/ContextualAI";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRep, REP_OPTIONS } from "@/contexts/RepContext";
import { RepSwitcher } from "@/components/RepSwitcher";

type SortField = "name" | "title" | "company";
type SortOrder = "asc" | "desc";

export default function ContactsEnhanced() {
  const [, navigate] = useLocation();
  const { selectedRep, repInfo, matchesTerritory, isRepMode } = useRep();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [titleFilter, setTitleFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [showAIPriority, setShowAIPriority] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const CONTACTS_PER_PAGE = 50;

  const { data: contacts, isLoading } = trpc.people.list.useQuery(undefined, {
    staleTime: 3 * 60 * 1000
  });

  // Get accounts for territory filtering
  const { data: accounts } = trpc.accounts.list.useQuery(undefined, {
    staleTime: 3 * 60 * 1000
  });

  // Get account IDs in rep's territory
  const territoryAccountIds = useMemo(() => {
    if (!accounts || !isRepMode) return null;
    return new Set(
      accounts
        .filter((acc: any) => matchesTerritory(acc.region || '', acc.employeeCount || 0))
        .map((acc: any) => acc.name?.toLowerCase())
    );
  }, [accounts, isRepMode, matchesTerritory]);

  const { data: prioritizedContacts, isLoading: isPrioritizing } = trpc.people.prioritize.useQuery(
    {},
    { enabled: showAIPriority }
  );

  // Extract unique values for filters
  const companies = useMemo(() => {
    if (!contacts) return [];
    return Array.from(new Set(contacts.map((c: any) => c.company).filter(Boolean))).sort() as string[];
  }, [contacts]);

  const titleKeywords = useMemo(() => {
    if (!contacts) return [];
    const keywords = new Set<string>();
    contacts.forEach((c: any) => {
      if (c.title) {
        const words = c.title.toLowerCase().match(/\b(ceo|cto|cfo|cio|ciso|vp|svp|evp|director|head|manager|lead|engineer|analyst|specialist)\b/g);
        words?.forEach((w: string) => keywords.add(w));
      }
    });
    return Array.from(keywords).sort();
  }, [contacts]);

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
          const providerLower = provider.toLowerCase();
          const shortName = providerLower.split(' ')[0];
          if (techLower.includes(providerLower) || techLower.includes(shortName)) {
            foundProviders.add(provider);
          }
        });
      }
    });
    
    return Array.from(foundProviders).sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  // Create account name to tech stack mapping
  const accountTechMap = useMemo(() => {
    if (!accounts) return new Map<string, string>();
    const map = new Map<string, string>();
    accounts.forEach((account: any) => {
      if (account.name && account.techStack) {
        map.set(account.name.toLowerCase(), String(account.techStack).toLowerCase());
      }
    });
    return map;
  }, [accounts]);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    // Use prioritized contacts when AI Priority is on
    const sourceContacts = showAIPriority && prioritizedContacts ? prioritizedContacts : contacts;
    if (!sourceContacts) return [];

    let filtered = sourceContacts.filter((contact: any) => {
      // Territory filter - only show contacts from accounts in rep's territory
      const matchesTerritory = !territoryAccountIds || 
        territoryAccountIds.has(contact.company?.toLowerCase() || '');
      
      const matchesSearch = !searchQuery || 
        (contact.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (contact.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (contact.company?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (contact.email?.toLowerCase() || "").includes(searchQuery.toLowerCase());

      const matchesCompany = companyFilter === "all" || contact.company === companyFilter;
      const matchesTitle = titleFilter === "all" || 
        contact.title?.toLowerCase().includes(titleFilter.toLowerCase());

      // MFA Provider filter - check if contact's company uses the selected MFA provider
      let matchesTech = true;
      if (techFilter !== "all" && contact.company) {
        const companyTech = accountTechMap.get(contact.company.toLowerCase()) || '';
        const filterLower = techFilter.toLowerCase();
        const shortName = filterLower.split(' ')[0];
        matchesTech = companyTech.includes(filterLower) || companyTech.includes(shortName);
      }

      return matchesTerritory && matchesSearch && matchesCompany && matchesTitle && matchesTech;
    });

    // Skip manual sorting if AI Priority is on (already sorted by priority)
    if (!showAIPriority) {
      filtered.sort((a: any, b: any) => {
        let aVal: string, bVal: string;

        switch (sortField) {
          case "name":
            aVal = a.name?.toLowerCase() || "";
            bVal = b.name?.toLowerCase() || "";
            break;
          case "title":
            aVal = a.title?.toLowerCase() || "";
            bVal = b.title?.toLowerCase() || "";
            break;
          case "company":
            aVal = a.company?.toLowerCase() || "";
            bVal = b.company?.toLowerCase() || "";
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [contacts, prioritizedContacts, showAIPriority, searchQuery, companyFilter, titleFilter, techFilter, sortField, sortOrder, territoryAccountIds, accountTechMap]);

  const handleToggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(order => order === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  }, [sortField]);

  // Paginated contacts
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * CONTACTS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + CONTACTS_PER_PAGE);
  }, [filteredContacts, currentPage, CONTACTS_PER_PAGE]);

  const totalPages = Math.ceil(filteredContacts.length / CONTACTS_PER_PAGE);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

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
              <div key={i} className="h-48 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navigation />

      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl shadow-lg">
                <Users className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold tracking-tight">Contacts</h1>
                <p className="text-muted-foreground text-lg mt-1">
                  {filteredContacts.length} of {contacts?.length || 0} contacts
                  {repInfo && <span className="ml-2 text-sm">• {repInfo.label} territory</span>}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <RepSwitcher />
            <Button
              onClick={() => setShowAIPriority(!showAIPriority)}
              variant={showAIPriority ? "default" : "outline"}
              className={showAIPriority ? "gradient-primary text-white" : ""}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {showAIPriority ? "AI Priority On" : "AI Priority Off"}
            </Button>
            <Button asChild className="gradient-primary text-white shadow-lg hover:shadow-xl">
              <Link href="/outreach">
                <Mail className="mr-2 h-5 w-5" />
                Generate Outreach
              </Link>
            </Button>
          </div>
        </div>

        {/* AI Assistant Bar */}
        <ContextualAI context="contacts" placeholder="Ask AI: Who are the key decision makers?" />

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="card-elevated border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                Total Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredContacts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active contacts</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-500" />
                Companies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique companies</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-cyan-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-cyan-500" />
                Decision Makers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {filteredContacts.filter((c: any) => 
                  c.title?.toLowerCase().match(/\b(ceo|cto|cfo|cio|vp|svp|evp|director|head)\b/)
                ).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">C-level & VPs</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company: string) => (
                    <SelectItem key={company} value={company!}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={titleFilter} onValueChange={setTitleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Titles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Titles</SelectItem>
                  {titleKeywords.map(keyword => (
                    <SelectItem key={keyword} value={keyword}>
                      {keyword.toUpperCase()}
                    </SelectItem>
                  ))}
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
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Sort by:</span>
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
                variant={sortField === "company" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("company")}
              >
                Company
                {sortField === "company" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                variant={sortField === "title" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("title")}
              >
                Title
                {sortField === "title" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Grid */}
        {filteredContacts.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-16 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No contacts found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {paginatedContacts.map((contact: any) => (
                <Card
                  key={contact.id}
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  className="card-elevated hover:scale-[1.02] transition-all cursor-pointer group h-full">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg flex-shrink-0">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl group-hover:text-primary transition-colors line-clamp-1">
                          {contact.name}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-1">
                          {contact.title || "No title"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Company with Intent Score */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm flex-1 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="line-clamp-1 font-medium">{contact.company}</span>
                      </div>
                      {(contact as any).accountIntentScore && (
                        <Badge variant={Number((contact as any).accountIntentScore) >= 70 ? "default" : Number((contact as any).accountIntentScore) >= 40 ? "secondary" : "outline"} className={Number((contact as any).accountIntentScore) >= 70 ? "bg-red-500" : Number((contact as any).accountIntentScore) >= 40 ? "bg-amber-500" : ""}>
                          {(contact as any).accountIntentScore}%
                        </Badge>
                      )}
                    </div>

                    {/* Department & Industry */}
                    <div className="flex flex-wrap gap-2">
                      {contact.department && (
                        <Badge variant="outline" className="text-xs">
                          {contact.department}
                        </Badge>
                      )}
                      {(contact as any).accountIndustry && (contact as any).accountIndustry !== "Unknown" && (
                        <Badge variant="outline" className="text-xs">
                          {(contact as any).accountIndustry}
                        </Badge>
                      )}
                    </div>

                    {/* Email */}
                    {contact.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{contact.email}</span>
                      </div>
                    )}

                    {/* Phone */}
                    {(contact.phone || (contact as any).mobilePhone || (contact as any).directPhone) && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{contact.phone || (contact as any).mobilePhone || (contact as any).directPhone}</span>
                      </div>
                    )}

                    {/* LinkedIn */}
                    {contact.linkedinUrl && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Linkedin className="h-4 w-4 flex-shrink-0" />
                        <a 
                          href={contact.linkedinUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="hover:text-primary transition-colors line-clamp-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          LinkedIn Profile
                          <ExternalLink className="inline h-3 w-3 ml-1" />
                        </a>
                      </div>
                    )}

                    {/* Location */}
                    {contact.location && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="line-clamp-1">{contact.location}</span>
                      </div>
                    )}


                    {/* Action Button */}
                    <Button 
                      variant="outline" 
                      className="w-full group-hover:border-primary group-hover:text-primary mt-2"
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/contacts/${contact.id}`;
                      }}
                    >
                      View Profile
                      <Eye className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="px-4 py-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({filteredContacts.length} contacts)
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              Last
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
