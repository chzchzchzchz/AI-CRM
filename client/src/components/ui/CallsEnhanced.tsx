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
  Phone, Calendar, Clock, Building2, User, Search,
  Filter, ArrowUpDown, Loader2, ExternalLink, PlayCircle,
  ChevronDown, ChevronUp, Eye, Sparkles, FileText
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/LoadingSkeleton";
import { SafeStreamdown } from "@/components/SafeStreamdown";

type SortField = "callDate" | "duration" | "company";
type SortOrder = "asc" | "desc";

export default function CallsEnhanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("callDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set());

  const { data: calls, isLoading } = trpc.gong.list.useQuery();

  // Extract unique companies
  const companies = useMemo(() => {
    if (!calls) return [];
    return Array.from(new Set(calls.map((c: any) => c.company).filter(Boolean))).sort() as string[];
  }, [calls]);

  // Filter and sort calls
  const filteredCalls = useMemo(() => {
    if (!calls) return [];

    let filtered = calls.filter((call: any) => {
      // Search filter
      const matchesSearch = !searchQuery || 
        call.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.accountId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.transcriptUrl?.toLowerCase().includes(searchQuery.toLowerCase());

      // Company filter
      const matchesCompany = companyFilter === "all" || call.accountId === companyFilter;

      return matchesSearch && matchesCompany;
    });

    // Sort
    filtered.sort((a: any, b: any) => {
      let aVal: any, bVal: any;

      switch (sortField) {
        case "callDate":
          aVal = a.callDate ? new Date(a.callDate).getTime() : 0;
          bVal = b.callDate ? new Date(b.callDate).getTime() : 0;
          break;
        case "duration":
          aVal = parseInt(a.duration?.replace(/[^0-9]/g, "") || "0");
          bVal = parseInt(b.duration?.replace(/[^0-9]/g, "") || "0");
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

    return filtered;
  }, [calls, searchQuery, companyFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(field === "callDate" ? "desc" : "asc");
    }
  };

  const toggleExpand = (callId: number) => {
    const newExpanded = new Set(expandedCalls);
    if (newExpanded.has(callId)) {
      newExpanded.delete(callId);
    } else {
      newExpanded.add(callId);
    }
    setExpandedCalls(newExpanded);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "Unknown";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatDuration = (duration: string | null) => {
    if (!duration) return "Unknown";
    const match = duration.match(/(\d+)/);
    if (match) {
      const mins = parseInt(match[1]);
      if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hours}h ${remainingMins}m`;
      }
      return `${mins}m`;
    }
    return duration;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <AIAssistant context={{ type: "general" }} />

      <div className="container py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Gong Call Intelligence</h1>
            <p className="text-slate-400">
              {filteredCalls.length} of {calls?.length || 0} calls
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Search calls, transcripts, summaries..."
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
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800">
              <ArrowUpDown className="h-4 w-4 text-slate-500" />
              <span className="text-sm text-slate-400">Sort by:</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("callDate")}
                  className={sortField === "callDate" ? "bg-purple-500/10 text-purple-400" : "text-slate-400"}
                >
                  Date {sortField === "callDate" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("duration")}
                  className={sortField === "duration" ? "bg-purple-500/10 text-purple-400" : "text-slate-400"}
                >
                  Duration {sortField === "duration" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleSort("company")}
                  className={sortField === "company" ? "bg-purple-500/10 text-purple-400" : "text-slate-400"}
                >
                  Company {sortField === "company" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calls List */}
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : filteredCalls.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="py-20 text-center">
              <Filter className="h-16 w-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No calls found</h3>
              <p className="text-slate-400">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((call: any) => {
              const isExpanded = expandedCalls.has(call.id);

              return (
                <Card key={call.id} className="bg-slate-900/50 border-slate-800 hover:border-purple-500/50 transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Phone className="h-5 w-5 text-purple-400 shrink-0" />
                          <CardTitle className="text-white text-lg truncate">
                            {call.title || "Untitled Call"}
                          </CardTitle>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                          {call.accountId && (
                            <Link href={`/accounts/${call.accountId}`}>
                              <div className="flex items-center gap-1 hover:text-purple-400 transition-colors">
                                <Building2 className="h-4 w-4" />
                                <span>{call.accountId}</span>
                              </div>
                            </Link>
                          )}
                          {call.contact && (
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              <span>{call.contact}</span>
                            </div>
                          )}
                          {call.callDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(call.callDate)}</span>
                            </div>
                          )}
                          {call.duration && (
                            <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDuration(call.duration)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {call.recordingUrl && (
                          <a
                            href={call.recordingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                            >
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Play
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(call.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-4 border-t border-slate-800 pt-6">
                      {/* AI Summary */}
                      {call.summary && (
                        <div className="p-4 bg-gradient-to-br from-purple-950/20 to-pink-950/20 rounded-lg border border-purple-500/20">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="h-4 w-4 text-purple-400" />
                            <span className="text-sm font-semibold text-purple-400">AI Summary</span>
                          </div>
                          <SafeStreamdown className="text-slate-300 text-sm leading-relaxed">
                            {call.summary}
                          </SafeStreamdown>
                        </div>
                      )}

                      {/* Transcript */}
                      {call.transcriptUrl && (
                        <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-700">
                          <div className="flex items-center gap-2 mb-3">
                            <FileText className="h-4 w-4 text-cyan-400" />
                            <span className="text-sm font-semibold text-cyan-400">Transcript</span>
                          </div>
                          <div className="text-sm text-slate-400 leading-relaxed max-h-96 overflow-y-auto">
                            <SafeStreamdown>{call.transcriptUrl}</SafeStreamdown>
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        {call.callId && (
                          <div>
                            <span className="text-slate-500">Call ID</span>
                            <div className="text-slate-300 font-mono text-xs truncate">{call.callId}</div>
                          </div>
                        )}
                        {call.createdAt && (
                          <div>
                            <span className="text-slate-500">Created</span>
                            <div className="text-slate-300">{formatDate(call.createdAt)}</div>
                          </div>
                        )}
                        {call.accountId && (
                          <div>
                            <Link href={`/accounts/${call.accountId}`}>
                              <span className="text-slate-500">Account</span>
                              <div className="text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                View Account
                                <ExternalLink className="h-3 w-3" />
                              </div>
                            </Link>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
