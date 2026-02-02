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
  User, Mail, Linkedin, MapPin, Building2, Search,
  Filter, ArrowUpDown, Loader2, ExternalLink, Briefcase, Eye
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { toast } from "sonner";

type SortField = "name" | "title" | "company";
type SortOrder = "asc" | "desc";

export default function ContactsEnhanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [titleFilter, setTitleFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const { data: contacts, isLoading } = trpc.people.list.useQuery();

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
        // Extract key title words (CEO, VP, Director, Manager, etc.)
        const words = c.title.toLowerCase().match(/\b(ceo|cto|cfo|cio|ciso|vp|svp|evp|director|head|manager|lead|engineer|analyst|specialist)\b/g);
        words?.forEach((w: string) => keywords.add(w));
      }
    });
    return Array.from(keywords).sort();
  }, [contacts]);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];

    let filtered = contacts.filter((contact: any) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        (contact.name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        contact.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (contact.company?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase());

      // Company filter
      const matchesCompany = companyFilter === "all" || contact.company === companyFilter;

      // Title filter
      const matchesTitle = titleFilter === "all" || 
        contact.title?.toLowerCase().includes(titleFilter.toLowerCase());

      return matchesSearch && matchesCompany && matchesTitle;
    });

    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal: string, bVal: string;

      switch (sortField) {
        case "name":
          aVal = (a.name || "").toLowerCase();
          bVal = (b.name || "").toLowerCase();
          break;
        case "title":
          aVal = a.title?.toLowerCase() || "";
          bVal = b.title?.toLowerCase() || "";
          break;
        case "company":
          aVal = (a.company || "").toLowerCase();
          bVal = (b.company || "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [contacts, searchQuery, companyFilter, titleFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <AIAssistant context={{ type: "general" }} />

      <div className="container py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Key Contacts</h1>
            <p className="text-slate-400">
              {filteredContacts.length} of {contacts?.length || 0} contacts
            </p>
          </div>
          <Link href="/email-generator">
            <Button className="bg-green-600 hover:bg-green-700">
              Generate Outreach
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Company Filter */}
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {companies.slice(0, 50).map((company: string) => (
                    <SelectItem key={company} value={company!}>{company}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Title Filter */}
              <Select value={titleFilter} onValueChange={setTitleFilter}>
                <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                  <SelectValue placeholder="All Titles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Titles</SelectItem>
                  {titleKeywords.map(keyword => (
                    <SelectItem key={keyword} value={keyword}>{keyword.toUpperCase()}</SelectItem>
                  ))}
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
                  onClick={() => toggleSort("name")}
                  className={sortField === "name" ? "bg-green-500/10 text-green-400" : "text-slate-400"}
                >
                  Name {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("title")}
                  className={sortField === "title" ? "bg-green-500/10 text-green-400" : "text-slate-400"}
                >
                  Title {sortField === "title" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("company")}
                  className={sortField === "company" ? "bg-green-500/10 text-green-400" : "text-slate-400"}
                >
                  Company {sortField === "company" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contacts Grid */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : filteredContacts.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="py-20 text-center">
              <Filter className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No contacts found</h3>
              <p className="text-slate-400">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact: any) => (
              <Link key={contact.id} href={`/contacts/${contact.id}`}>
                <Card className="bg-slate-900/50 border-slate-800 hover:border-green-500/50 transition-all cursor-pointer group h-full">
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-white group-hover:text-green-400 transition-colors text-base mb-1 truncate">
                          {contact.name}
                        </CardTitle>
                        {contact.title && (
                          <p className="text-sm text-slate-400 line-clamp-2">{contact.title}</p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Company */}
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-cyan-400 shrink-0" />
                        <span className="text-slate-300 truncate">{contact.company}</span>
                      </div>

                      {/* Email */}
                      {contact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-purple-400 shrink-0" />
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              copyEmail(contact.email!);
                            }}
                            className="text-purple-400 hover:text-purple-300 truncate text-left"
                          >
                            {contact.email}
                          </button>
                        </div>
                      )}

                      {/* LinkedIn */}
                      {contact.linkedinUrl && (
                        <div className="flex items-center gap-2 text-sm">
                          <Linkedin className="h-4 w-4 text-blue-400 shrink-0" />
                          <a
                            href={contact.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            LinkedIn Profile
                            <ExternalLink className="h-3 w-3 inline ml-1" />
                          </a>
                        </div>
                      )}

                      {/* Location */}
                      {contact.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-yellow-400 shrink-0" />
                          <span className="text-slate-400 truncate">{contact.location}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs text-slate-500">View Profile</span>
                        <Eye className="h-4 w-4 text-slate-600 group-hover:text-green-500 transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
