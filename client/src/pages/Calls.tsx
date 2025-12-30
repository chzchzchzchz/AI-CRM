import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navigation } from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Phone, Calendar, Clock, Building2, Search,
  ArrowUpDown, ExternalLink, PlayCircle,
  ChevronDown, ChevronUp, MessageSquare, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const CALLS_PER_PAGE = 50;

export default function Calls() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set());

  // Use paginated query for performance
  const { data, isLoading } = trpc.gong.listPaginated.useQuery(
    { limit: CALLS_PER_PAGE, offset: (currentPage - 1) * CALLS_PER_PAGE },
    { staleTime: 3 * 60 * 1000 }
  );

  const calls = data?.calls || [];
  const totalCalls = data?.total || 0;
  const totalPages = Math.ceil(totalCalls / CALLS_PER_PAGE);

  // Client-side search filter (on current page only)
  const filteredCalls = useMemo(() => {
    if (!searchQuery) return calls;
    return calls.filter((call: any) => {
      return call.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        call.summary?.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [calls, searchQuery]);

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
  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-8 space-y-6 max-w-6xl">
          <div className="h-10 w-48 skeleton rounded" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-lg" />)}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 skeleton rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container py-8 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gong Calls</h1>
            <p className="text-muted-foreground">
              {totalCalls.toLocaleString()} total calls
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-cyan-500" />
                <div>
                  <p className="text-2xl font-bold">{totalCalls.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-indigo-500" />
                <div>
                  <p className="text-2xl font-bold">Page {currentPage}</p>
                  <p className="text-sm text-muted-foreground">of {totalPages} pages</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{CALLS_PER_PAGE}</p>
                  <p className="text-sm text-muted-foreground">Per page</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search this page..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {((currentPage - 1) * CALLS_PER_PAGE) + 1} - {Math.min(currentPage * CALLS_PER_PAGE, totalCalls)} of {totalCalls.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm px-3">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calls List */}
        {filteredCalls.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="text-lg font-semibold">No calls found</h3>
              <p className="text-muted-foreground text-sm">Try a different search</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCalls.map((call: any) => {
              const isExpanded = expandedCalls.has(call.id);
              
              return (
                <Card key={call.id} className="hover:bg-muted/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-cyan-500/10 rounded-lg">
                          <Phone className="h-4 w-4 text-cyan-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-1">
                            {call.title || "Untitled Call"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                            {call.callDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(call.callDate).toLocaleDateString()}
                              </span>
                            )}
                            {call.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {call.duration}
                              </span>
                            )}
                            {call.accountId && (
                              <Link href={`/accounts/${call.accountId}`} className="flex items-center gap-1 hover:text-foreground">
                                <Building2 className="h-3 w-3" />
                                Account #{call.accountId}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {call.recordingUrl && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                              <PlayCircle className="mr-1 h-3 w-3" />
                              Gong
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>

                    {call.summary && (
                      <div className="mt-3 p-3 rounded bg-muted/50 text-sm">
                        {call.summary.slice(0, 200)}{call.summary.length > 200 ? '...' : ''}
                      </div>
                    )}

                    {call.transcriptUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(call.id)}
                        className="mt-2 w-full justify-between text-xs"
                      >
                        <span>View Transcript</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    )}
                    
                    {isExpanded && call.transcriptUrl && (
                      <div className="mt-2 p-3 rounded bg-muted/50 text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {call.transcriptUrl}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Bottom Pagination */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
            if (pageNum > totalPages || pageNum < 1) return null;
            return (
              <Button
                key={pageNum}
                variant={pageNum === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </Button>
            );
          })}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
