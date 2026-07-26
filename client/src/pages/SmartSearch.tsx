import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Sparkles, CornerDownLeft } from "lucide-react";
import { Link } from "wouter";

const EXAMPLE_QUERIES = [
  "Show me accounts with recent security incidents",
  "Who are the top priority contacts to reach out to?",
  "Find companies in financial services with high intent scores",
  "Which accounts mentioned competitors in recent calls?",
  "Show me accounts that are ready to buy",
  "Find CISOs at companies with 1000+ employees",
];

export default function SmartSearch() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const searchMutation = trpc.ai.search.useMutation();

  const handleSearch = async () => {
    if (!query.trim()) return;

    const result = await searchMutation.mutateAsync({ query });
    setSearchResults(result);
  };

  return (
    <div>

      <div className="container py-1 space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 rounded-sm bg-muted border border-border-strong">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">AI-Powered Search</h1>
            <p className="text-sm text-muted-foreground">
              Ask anything about your accounts, contacts, or sales data in plain language.
            </p>
          </div>
        </div>

        {/* Search — the one lead action on this screen */}
        <Card>
          <CardContent className="space-y-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. show me high-intent accounts in fintech, or who should I call this week?"
                  className="pl-10 bg-muted border-border-strong placeholder:text-ink-muted"
                />
              </div>
              <Button
                variant="signal"
                onClick={handleSearch}
                disabled={searchMutation.isPending || !query.trim()}
              >
                {searchMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching…</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" /> Search</>
                )}
              </Button>
            </div>

            {searchResults && (
              <div className="rounded-sm border border-border-strong bg-muted p-4">
                <p className="text-[0.6875rem] font-semibold tracking-[0.04em] text-ink-muted mb-1">
                  AI interpretation
                </p>
                <p className="text-foreground">{searchResults.explanation}</p>
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-muted">Intent</span>
                    <span className="text-accent">{searchResults.intent}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-ink-muted">Matches</span>
                    <span className="tabular-nums text-accent">{searchResults.resultCount ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {searchResults?.results?.length > 0 && (
              <div className="space-y-2">
                {searchResults.resultType === "contact"
                  ? searchResults.results.map((p: any) => (
                      <Link key={p.id} href={`/contacts/${p.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-sm bg-muted hover:bg-muted border border-border-strong hover:border-accent/30 transition-colors cursor-pointer">
                          <div>
                            <div className="text-foreground font-medium">{p.name}</div>
                            <div className="text-ink-muted text-xs">
                              {p.title}
                              {p.accountName ? ` · ${p.accountName}` : ""}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  : searchResults.results.map((a: any) => (
                      <Link key={a.id} href={`/accounts/${a.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-sm bg-muted hover:bg-muted border border-border-strong hover:border-accent/30 transition-colors cursor-pointer">
                          <div>
                            <div className="text-foreground font-medium">{a.name}</div>
                            <div className="text-ink-muted text-xs">
                              {[a.industry, a.region, a.buyingStage].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          {a.intentScore != null && (
                            <span className="text-accent text-sm tabular-nums">{a.intentScore}</span>
                          )}
                        </div>
                      </Link>
                    ))}
              </div>
            )}

            {searchResults && searchResults.resultCount === 0 && (
              <p className="text-sm text-muted-foreground">
                No matching records found for that query.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Example queries */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Try an example</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXAMPLE_QUERIES.map((example, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(example)}
                  className="group flex flex-wrap items-center justify-between gap-2 w-full text-left p-3 rounded-sm bg-muted hover:bg-muted border border-border-strong hover:border-accent/30 transition-colors text-ink-muted hover:text-foreground"
                >
                  <span className="text-sm">{example}</span>
                  <CornerDownLeft className="h-3.5 w-3.5 text-ink-subtle opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
