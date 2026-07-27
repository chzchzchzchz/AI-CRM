import { useState, useMemo, useCallback, useEffect } from"react";
import { Card, CardContent } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Input } from"@/components/ui/input";
import { trpc } from"@/lib/trpc";
import { Link, useLocation } from"wouter";
import {
  User, Mail, Linkedin, MapPin, Building2, Search, ArrowUpDown, ExternalLink,
  Briefcase, Users, Sparkles, Phone, TrendingUp, Flame, Snowflake, ChevronRight, Target
} from"lucide-react";
import { ContextualAI } from"@/components/ContextualAI";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from"@/components/ui/select";
import { useRep } from"@/contexts/RepContext";
import { RepSwitcher } from"@/components/RepSwitcher";

type SortField ="priority" |"name" |"title" |"company";
type SortOrder ="asc" |"desc";

export default function ContactsEnhanced() {
  const [, navigate] = useLocation();
  const { repInfo, matchesTerritory, isRepMode } = useRep();

  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [titleFilter, setTitleFilter] = useState<string>("all");
  const [techFilter, setTechFilter] = useState<string>("all");
  // Not alphabetical. Sorting 10,000 contacts by first name opens the page on twelve
  // people called Ahmed — accurate, and useless. Default to the ones worth calling.
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [showAIPriority, setShowAIPriority] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const CONTACTS_PER_PAGE = 50;

  // Debounce the search so typing queries the server across ALL contacts (not just the
  // bounded first page), without a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // The true totals, so the header can say how much it is NOT showing.
  const { data: totals } = trpc.accounts.getStats.useQuery(undefined, { staleTime: 5 * 60 * 1000 });

  const { data: contacts, isLoading } = trpc.people.list.useQuery(
    { search: debouncedSearch || undefined },
    { staleTime: 3 * 60 * 1000 }
  );

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
  const MFA_PROVIDERS = ["Ping Identity","Okta","Duo Security","Azure AD","OneLogin","ForgeRock","Auth0","CyberArk","RSA SecurID","SailPoint","Saviynt","IBM Security Verify","Oracle Identity","SecureAuth","Thales SafeNet"
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
        (contact.name?.toLowerCase() ||"").includes(searchQuery.toLowerCase()) ||
        (contact.title?.toLowerCase() ||"").includes(searchQuery.toLowerCase()) ||
        (contact.company?.toLowerCase() ||"").includes(searchQuery.toLowerCase()) ||
        (contact.email?.toLowerCase() ||"").includes(searchQuery.toLowerCase());

      const matchesCompany = companyFilter ==="all" || contact.company === companyFilter;
      const matchesTitle = titleFilter ==="all" ||
        contact.title?.toLowerCase().includes(titleFilter.toLowerCase());

      // MFA Provider filter - check if contact's company uses the selected MFA provider
      let matchesTech = true;
      if (techFilter !=="all" && contact.company) {
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
        // Priority is numeric (account intent), the rest are text.
        if (sortField ==="priority") {
          const score = (c: any) => Number(c.accountIntentScore ?? c.intentScore ?? 0) || 0;
          const d = score(b) - score(a);
          return sortOrder ==="desc" ? d : -d;
        }

        let aVal: string, bVal: string;

        switch (sortField) {
          case"name":
            aVal = a.name?.toLowerCase() ||"";
            bVal = b.name?.toLowerCase() ||"";
            break;
          case"title":
            aVal = a.title?.toLowerCase() ||"";
            bVal = b.title?.toLowerCase() ||"";
            break;
          case"company":
            aVal = a.company?.toLowerCase() ||"";
            bVal = b.company?.toLowerCase() ||"";
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortOrder ==="asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder ==="asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [contacts, prioritizedContacts, showAIPriority, searchQuery, companyFilter, titleFilter, techFilter, sortField, sortOrder, territoryAccountIds, accountTechMap]);

  const handleToggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(order => order ==="asc" ?"desc" :"asc");
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

  const isDecisionMaker = (title?: string | null) =>
    !!title?.toLowerCase().match(/\b(ceo|cto|cfo|cio|vp|svp|evp|director|head)\b/);

  // Intent heat: tinted text + glyph + word, never color alone.
  const getHeat = (score: number) => {
    if (score >= 70) return { label:"Hot", Icon: Flame, text:"text-critical" };
    if (score >= 40) return { label:"Warm", Icon: TrendingUp, text:"text-caution" };
    return { label:"Cold", Icon: Snowflake, text:"text-accent" };
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
        <div className="container py-10 space-y-6 max-w-7xl">
          <div className="space-y-3">
            <div className="h-9 w-72 skeleton" />
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

  const decisionMakerCount = filteredContacts.filter((c: any) => isDecisionMaker(c.title)).length;

  // True when the server truncated: what came back is smaller than what exists.
  const isCapped =
    !debouncedSearch &&
    !!totals?.totalContacts &&
    (contacts?.length ?? 0) < totals.totalContacts;

  const stats: { key: string; label: string; value: number; Icon: any; text: string; hint: string }[] = [
    { key:"contacts", label:"Contacts", value: filteredContacts.length, Icon: Users, text:"text-foreground", hint:"In current view" },
    { key:"companies", label:"Companies", value: companies.length, Icon: Building2, text:"text-foreground", hint:"Unique accounts" },
    { key:"dm", label:"Decision makers", value: decisionMakerCount, Icon: Briefcase, text:"text-accent", hint:"C-level & VPs" },
  ];

  return (
    <div>

      <div className="container py-10 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-xl font-semibold tracking-tight">Contacts</h1>
            {/* The real total, not the size of the page we happened to fetch.
                This read "1500 of 1500 contacts" against a database of 10,023: the
                server caps its result at 1,500 and the client had no idea, so the page
                told you that you were looking at everything while hiding 85% of it. */}
            <p className="mt-1 text-sm text-ink-muted">
              <span className="tabular-nums text-ink-muted">{filteredContacts.length.toLocaleString()}</span> of{" "}
              <span className="tabular-nums text-ink-muted">{(totals?.totalContacts ?? contacts?.length ?? 0).toLocaleString()}</span> contacts
              {isCapped && (
                <> · <span className="text-caution">showing the first {(contacts?.length ?? 0).toLocaleString()} — search to narrow</span></>
              )}
              {repInfo && <> · {repInfo.label} territory</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RepSwitcher />
            <Button
              onClick={() => setShowAIPriority(!showAIPriority)}
              variant="outline"
              className={showAIPriority ?"border-accent/30 bg-accent-subtle text-accent hover:bg-accent-subtle" :""}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {showAIPriority ? (isPrioritizing ?"Prioritizing…" :"AI Priority On") :"AI Priority Off"}
            </Button>
            <Button asChild className="font-medium">
              <Link href="/outreach">
                <Mail className="mr-2 h-4 w-4" />
                Generate Outreach
              </Link>
            </Button>
          </div>
        </div>

        {/* AI Assistant Bar */}
        <ContextualAI context="contacts" placeholder="Ask AI: Who are the key decision makers?" />

        {/* Quick Stats - segmented readout */}
        <div className="grid grid-cols-3 rounded-md border border-border/60 bg-card divide-x divide-border/50 overflow-hidden">
          {stats.map((s) => (
            <div key={s.key} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-ink-muted">
                <s.Icon className={`h-3.5 w-3.5 ${s.text ==="text-foreground" ?"text-ink-muted" : s.text}`} />
                {s.label}
              </div>
              <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${s.text}`}>{s.value}</div>
              <div className="mt-0.5 text-[11px] text-ink-subtle">{s.hint}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="rounded-md border border-border/60 bg-card">
          <div className="p-4 sm:p-5">
            <div className="grid md:grid-cols-5 gap-3">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger aria-label="All Companies"><SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.map((company: string) => (
                    <SelectItem key={company} value={company!}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={titleFilter} onValueChange={setTitleFilter}>
                <SelectTrigger aria-label="All Titles"><SelectValue placeholder="All Titles" />
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
                <SelectTrigger aria-label="MFA Provider"><SelectValue placeholder="MFA Provider" />
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
                variant={sortField ==="priority" ?"default" :"outline"}
                size="sm"
                onClick={() => handleToggleSort("priority")}
                title="Account intent score, highest first"
              >
                Priority
                {sortField ==="priority" && <ArrowUpDown className="ml-2 h-4 w-4" />}
              </Button>
              <Button
                variant={sortField ==="name" ?"default" :"outline"}
                size="sm"
                onClick={() => handleToggleSort("name")}
              >
                Name
                {sortField ==="name" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                variant={sortField ==="company" ?"default" :"outline"}
                size="sm"
                onClick={() => handleToggleSort("company")}
              >
                Company
                {sortField ==="company" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                variant={sortField ==="title" ?"default" :"outline"}
                size="sm"
                onClick={() => handleToggleSort("title")}
              >
                Title
                {sortField ==="title" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              {showAIPriority && (
                <span className="ml-1 flex flex-wrap items-center gap-1 text-xs text-accent">
                  <Sparkles className="h-3.5 w-3.5" />
                  Ordered by AI priority
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contacts List */}
        {filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No contacts found</h3>
              <p className="text-ink-muted">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border border-border/60 bg-card divide-y divide-border/50 overflow-hidden">
            {paginatedContacts.map((contact: any) => {
              const intentRaw = (contact as any).accountIntentScore;
              const numScore = intentRaw != null ? parseInt(String(intentRaw)) : NaN;
              const hasScore = !Number.isNaN(numScore) && numScore > 0;
              const heat = getHeat(numScore);
              const HeatIcon = heat.Icon;
              const dm = isDecisionMaker(contact.title);
              const industry = (contact as any).accountIndustry;
              const phone = contact.phone || (contact as any).mobilePhone || (contact as any).directPhone;

              return (
                <div
                  key={contact.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/contacts/${contact.id}`)}
                  onKeyDown={(e) => {
                    if (e.key ==="Enter" || e.key ==="") {
                      e.preventDefault();
                      navigate(`/contacts/${contact.id}`);
                    }
                  }}
                  className="group flex flex-wrap items-center gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-surface/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-sm bg-muted border border-border/60 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-accent" />
                  </div>

                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[15px] text-foreground truncate group-hover:text-accent transition-colors">
                        {contact.name}
                      </span>
                      {dm && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-ink-muted bg-muted rounded px-1.5 py-0.5 flex-shrink-0">
                          <Target className="h-2.5 w-2.5" />
                          Decision maker
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted truncate">
                      {contact.title ||"No title"}
                    </div>
                  </div>

                  {/* Company + tags */}
                  <div className="hidden md:block w-48 flex-shrink-0 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-muted truncate">
                      <Building2 className="h-3.5 w-3.5 text-ink-subtle flex-shrink-0" />
                      <span className="truncate">{contact.company}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {contact.department && (
                        <span className="text-[10px] text-ink-muted bg-muted rounded px-1.5 py-0.5">{contact.department}</span>
                      )}
                      {industry && industry !=="Unknown" && (
                        <span className="text-[10px] text-ink-muted bg-muted rounded px-1.5 py-0.5">{industry}</span>
                      )}
                    </div>
                  </div>

                  {/* Channels */}
                  <div className="hidden xl:flex items-center gap-1.5 w-56 flex-shrink-0 text-xs text-ink-muted min-w-0">
                    {contact.email ? (
                      <>
                        <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </>
                    ) : (
                      <span className="text-ink-subtle">No email</span>
                    )}
                  </div>

                  {/* Quick channel affordances */}
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0 text-ink-subtle">
                    {phone && (
                      <span className="p-1.5" title={phone}>
                        <Phone className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {contact.location && (
                      <span className="p-1.5" title={contact.location}>
                        <MapPin className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {contact.linkedinUrl && (
                      <button
                        type="button"
                        aria-label="Open LinkedIn profile"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(contact.linkedinUrl,"_blank","noopener,noreferrer");
                        }}
                        className="p-1.5 rounded hover:bg-muted hover:text-accent transition-colors"
                      >
                        <Linkedin className="h-3.5 w-3.5" />
                        <ExternalLink className="hidden" />
                      </button>
                    )}
                  </div>

                  {/* Account intent */}
                  <div className="flex flex-wrap items-center gap-3 flex-shrink-0 pl-1">
                    <div className="text-right w-14">
                      {hasScore ? (
                        <>
                          <div className="text-lg leading-none tabular-nums text-accent">{numScore}</div>
                          <div className={`mt-1 flex items-center justify-end gap-1 text-[11px] font-medium ${heat.text}`}>
                            <HeatIcon className="h-3 w-3" />
                            {heat.label}
                          </div>
                        </>
                      ) : (
                        <div className="tabular-nums text-lg leading-none text-ink-subtle">—</div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-subtle group-hover:text-ink-muted transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
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
            <span className="px-4 py-2 text-sm text-ink-muted">
              Page <span className="tabular-nums text-ink-muted">{currentPage}</span> of{""}
              <span className="tabular-nums text-ink-muted">{totalPages}</span>
              {""}(<span className="tabular-nums text-ink-muted">{filteredContacts.length}</span> contacts)
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
