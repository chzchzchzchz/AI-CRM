import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { Link } from "wouter";
import {
  Phone, Calendar, Clock, Building2, Search,
  PlayCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Sparkles, Loader2
} from "lucide-react";


const CALLS_PER_PAGE = 50;

export default function Calls() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(new Set());
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [analyses, setAnalyses] = useState<Record<number, string>>({});

  const analyze = trpc.ai.analyzeCall.useMutation({
    onSuccess: (res: any, vars) => {
      // `available === false` means summary is the "AI generation is unavailable"
      // note, buried inside a JSON blob next to several genuinely-empty arrays —
      // nothing marked the object itself as a failure, so this used to render under
      // an "Analysis" heading exactly like a real one.
      if (res?.available === false) {
        toast.error("AI generation is unavailable right now — could not analyze this call.");
        setAnalyzingId(null);
        return;
      }
      const text = typeof res === "string" ? res : JSON.stringify(res, null, 2);
      setAnalyses(a => ({ ...a, [vars.callId]: text }));
      // Open the row so the result is visible where it was asked for.
      setExpandedCalls(prev => new Set(prev).add(vars.callId));
      setAnalyzingId(null);
    },
    onError: e => {
      toast.error(e.message);
      setAnalyzingId(null);
    },
  });

  // Use paginated query for performance
  const { data, isLoading } = trpc.gong.listPaginated.useQuery(
    { limit: CALLS_PER_PAGE, offset: (currentPage - 1) * CALLS_PER_PAGE },
    { staleTime: 3 * 60 * 1000 }
  );

  const calls = data?.calls || [];
  const totalCalls = data?.total || 0;
  const totalPages = Math.ceil(totalCalls / CALLS_PER_PAGE);

  // Client-side search filter (on current page only)
  // keyTopics / actionItems are stored as JSON strings (or arrays). Parse defensively.
  const parseList = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    try { const p = JSON.parse(v); return Array.isArray(p) ? p.map(String) : []; } catch { return [String(v)]; }
  };

  const filteredCalls = useMemo(() => {
    if (!searchQuery) return calls;
    const q = searchQuery.toLowerCase();
    return calls.filter((call: any) => {
      // Search the real columns (title, sentiment, and the topics/action-items that Gong
      // actually populates) — the old code searched call.summary, which is not a column.
      const haystack = [
        call.title,
        call.sentiment,
        ...parseList(call.keyTopics),
        ...parseList(call.actionItems),
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
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
      <div className="text-foreground">
        <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
          <div className="h-10 w-48 skeleton rounded" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-32 skeleton rounded-sm" />)}
          </div>
        </div>
      </div>
    );
  }

  const firstOnPage = totalCalls === 0 ? 0 : ((currentPage - 1) * CALLS_PER_PAGE) + 1;
  const lastOnPage = Math.min(currentPage * CALLS_PER_PAGE, totalCalls);

  return (
    <div className="text-foreground">

      <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
        {/* Header — lead with what matters: the corpus size, then how to move through it. */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Gong Calls</h1>
            <p className="text-ink-muted mt-1 text-sm">
              <span className="tabular-nums text-foreground">{totalCalls.toLocaleString()}</span> recorded{" "}
              {totalCalls === 1 ? "call" : "calls"} across{" "}
              <span className="tabular-nums text-foreground">{totalPages || 1}</span>{" "}
              {totalPages === 1 ? "page" : "pages"}.
            </p>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              placeholder="Search this page…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-border-strong text-foreground placeholder:text-ink-muted"
            />
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="text-sm text-ink-muted">
            Showing <span className="tabular-nums text-foreground">{firstOnPage}</span>–
            <span className="tabular-nums text-foreground">{lastOnPage}</span> of{" "}
            <span className="tabular-nums text-foreground">{totalCalls.toLocaleString()}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-border-strong text-ink-muted hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm px-3 text-ink-muted">
              Page <span className="tabular-nums text-foreground">{currentPage}</span> of{" "}
              <span className="tabular-nums text-foreground">{totalPages || 1}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="border-border-strong text-ink-muted hover:bg-muted hover:text-foreground"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calls List */}
        {filteredCalls.length === 0 ? (
          <Card className="bg-card border-border shadow-none">
            <CardContent className="py-12 text-center">
              <Phone className="h-12 w-12 mx-auto text-ink-subtle mb-3" />
              <h3 className="text-lg font-semibold text-foreground">No calls found</h3>
              <p className="text-ink-muted text-sm">Try a different search</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCalls.map((call: any) => {
              const isExpanded = expandedCalls.has(call.id);

              return (
                <Card
                  key={call.id}
                  className="bg-card border-border shadow-none transition-colors hover:border-accent/30"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-wrap items-start gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-muted rounded-sm">
                          <Phone className="h-4 w-4 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground line-clamp-1">
                            {call.title || "Untitled Call"}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-ink-muted">
                            {call.callDate && (
                              <span className="flex flex-wrap items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(call.callDate).toLocaleDateString()}
                              </span>
                            )}
                            {call.duration && (
                              <span className="flex flex-wrap items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span className="tabular-nums text-ink-muted">{call.duration}</span>
                              </span>
                            )}
                            {call.accountId && (
                              <Link href={`/accounts/${call.accountId}`} className="flex flex-wrap items-center gap-1 text-ink-muted hover:text-accent">
                                <Building2 className="h-3 w-3" />
                                Account #{call.accountId}
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 flex-shrink-0">
                        {/* Gong gives you the recording; this reads the transcript and
                            says what happened. The procedure existed and nothing called
                            it, so a call you hadn't sat in on was just a row. */}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={analyze.isPending}
                          onClick={() => {
                            setAnalyzingId(call.id);
                            analyze.mutate({ callId: call.id });
                          }}
                        >
                          {analyze.isPending && analyzingId === call.id ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1 h-3 w-3" />
                          )}
                          Analyse
                        </Button>
                        {call.recordingUrl && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="border-border-strong text-ink-muted hover:bg-muted hover:text-foreground"
                          >
                            <a href={call.recordingUrl} target="_blank" rel="noopener noreferrer">
                              <PlayCircle className="mr-1 h-3 w-3" />
                              Gong
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>

                    {parseList(call.keyTopics).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {parseList(call.keyTopics).map((topic: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 rounded-sm bg-muted text-xs text-ink-muted">{topic}</span>
                        ))}
                      </div>
                    )}
                    {parseList(call.actionItems).length > 0 && (
                      <div className="mt-2 p-3 rounded-sm bg-muted text-sm text-foreground">
                        <div className="text-xs text-ink-muted mb-1">Action items</div>
                        <ul className="list-disc list-inside space-y-0.5">
                          {parseList(call.actionItems).map((item: string, i: number) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {call.transcriptUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpanded(call.id)}
                        className="mt-2 w-full justify-between text-xs text-ink-muted hover:bg-muted hover:text-foreground"
                      >
                        <span>Transcript link</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    )}

                    {analyses[call.id] && (
                      <div className="mt-2 rounded-sm border border-accent/25 bg-accent-subtle p-3">
                        <p className="mb-1 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-accent">
                          <Sparkles className="h-3 w-3" />
                          Analysis
                        </p>
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                          <SafeStreamdown>{analyses[call.id]}</SafeStreamdown>
                        </div>
                      </div>
                    )}

                    {isExpanded && call.transcriptUrl && (
                      <div className="mt-2 p-3 rounded-sm bg-muted text-xs text-ink-muted">
                        {/* We only store the Gong link, not transcript text — say that plainly
                            rather than dressing a URL up as a transcript. */}
                        <p className="mb-1">No transcript text is stored locally for this call. Open it on Gong:</p>
                        <a
                          href={call.transcriptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline break-all"
                        >
                          {call.transcriptUrl}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Bottom Pagination */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="border-border-strong text-ink-muted hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {[...Array(Math.min(5, totalPages))].map((_, i) => {
            const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
            if (pageNum > totalPages || pageNum < 1) return null;
            const active = pageNum === currentPage;
            return (
              <Button
                key={pageNum}
                variant={active ? "signal" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(pageNum)}
                className={active
                  ? "tabular-nums"
                  : "border-border-strong text-ink-muted hover:bg-muted hover:text-foreground tabular-nums"}
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
            className="border-border-strong text-ink-muted hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
