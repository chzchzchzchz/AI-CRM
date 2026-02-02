import { useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Phone, Calendar, Clock, Building2, User, Search,
  ArrowUpDown, ExternalLink, PlayCircle,
  ChevronDown, ChevronUp, Users, MessageSquare
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SafeStreamdown } from "@/components/SafeStreamdown";

type SortField = "callDate" | "duration" | "company";
type SortOrder = "asc" | "desc";

export default function CallsEnhanced() {
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("callDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set());

  const { data: calls, isLoading } = trpc.gong.list.useQuery(undefined, { staleTime: 3 * 60 * 1000 });

  const companies = useMemo(() => {
    if (!calls) return [];
    return Array.from(new Set(calls.map((c: any) => c.company).filter(Boolean))).sort() as string[];
  }, [calls]);

  const filteredCalls = useMemo(() => {
    if (!calls) return [];

    let filtered = calls.filter((call: any) => {
      const matchesSearch = !searchQuery || 
        call.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.accountId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.transcriptUrl?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCompany = companyFilter === "all" || call.accountId === companyFilter;

      return matchesSearch && matchesCompany;
    });

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

  const handleToggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(order => order === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  }, [sortField]);

  const toggleExpanded = (callId: number) => {
    setExpandedCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(callId)) {
        newSet.delete(callId);
      } else {
        newSet.add(callId);
      }
      return newSet;
    });
  };

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
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-48 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const totalDuration = filteredCalls.reduce((acc: number, call: any) => {
    const mins = parseInt(call.duration?.replace(/[^0-9]/g, "") || "0");
    return acc + mins;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navigation />

      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-2xl shadow-lg">
                <Phone className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold tracking-tight">Gong Calls</h1>
                <p className="text-muted-foreground text-lg mt-1">
                  {filteredCalls.length} of {calls?.length || 0} calls
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="card-elevated border-l-4 border-l-cyan-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="h-4 w-4 text-cyan-500" />
                Total Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{filteredCalls.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Recorded conversations</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                Total Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Math.round(totalDuration / 60)}h</div>
              <p className="text-xs text-muted-foreground mt-1">{totalDuration} minutes</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-500" />
                Companies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{companies.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Unique accounts</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="card-elevated">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search calls..."
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
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Button
                variant={sortField === "callDate" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("callDate")}
              >
                Date
                {sortField === "callDate" && (
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                )}
              </Button>
              <Button
                variant={sortField === "duration" ? "default" : "outline"}
                size="sm"
                onClick={() => handleToggleSort("duration")}
              >
                Duration
                {sortField === "duration" && (
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
            </div>
          </CardContent>
        </Card>

        {/* Calls List */}
        {filteredCalls.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="py-16 text-center">
              <Phone className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">No calls found</h3>
              <p className="text-muted-foreground">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((call: any) => {
              const isExpanded = expandedCalls.has(call.id);
              
              return (
                <Card key={call.id} className="card-elevated">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="p-3 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl shadow-lg flex-shrink-0">
                          <Phone className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-xl line-clamp-1">
                            {call.title || "Untitled Call"}
                          </CardTitle>
                          <CardDescription className="flex flex-wrap items-center gap-4 mt-2">
                            {call.callDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {new Date(call.callDate).toLocaleDateString()}
                              </span>
                            )}
                            {call.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {call.duration}
                              </span>
                            )}
                            {call.accountId && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-4 w-4" />
                                {call.accountId}
                              </span>
                            )}
                            {call.participants && (
                              <span className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                {call.participants}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {call.recordingUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                              <PlayCircle className="mr-2 h-4 w-4" />
                              View in Gong
                              <ExternalLink className="ml-2 h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {(call.summary || call.transcriptUrl) && (
                    <CardContent className="space-y-4">
                      {call.summary && (
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Summary</span>
                          </div>
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <SafeStreamdown>{call.summary}</SafeStreamdown>
                          </div>
                        </div>
                      )}

                      {call.transcriptUrl && (
                        <div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(call.id)}
                            className="w-full justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              Transcript
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          
                          {isExpanded && (
                            <div className="mt-2 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground whitespace-pre-wrap">
                              {call.transcriptUrl}
                            </div>
                          )}
                        </div>
                      )}
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
