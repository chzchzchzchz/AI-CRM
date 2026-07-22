import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Sparkles, CornerDownLeft } from "lucide-react";
import { Navigation } from "@/components/Navigation";
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
    <div className="min-h-screen bg-background">
      <Navigation onSearchClick={() => {}} />

      <div className="container py-6 space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
            <Sparkles className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI-Powered Search</h1>
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="e.g. show me high-intent accounts in fintech, or who should I call this week?"
                  className="pl-10 bg-slate-800 border-slate-700 placeholder:text-slate-400"
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
              <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4">
                <p className="text-[0.6875rem] font-semibold tracking-[0.04em] text-slate-400 mb-1">
                  AI interpretation
                </p>
                <p className="text-foreground">{searchResults.explanation}</p>
                <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Intent</span>
                    <span className="text-cyan-400">{searchResults.intent}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Matches</span>
                    <span className="font-mono text-cyan-400">{searchResults.resultCount ?? 0}</span>
                  </div>
                </div>
              </div>
            )}

            {searchResults?.results?.length > 0 && (
              <div className="space-y-2">
                {searchResults.resultType === "contact"
                  ? searchResults.results.map((p: any) => (
                      <Link key={p.id} href={`/contacts/${p.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer">
                          <div>
                            <div className="text-foreground font-medium">{p.name}</div>
                            <div className="text-slate-400 text-xs">
                              {p.title}
                              {p.accountName ? ` · ${p.accountName}` : ""}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))
                  : searchResults.results.map((a: any) => (
                      <Link key={a.id} href={`/accounts/${a.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-colors cursor-pointer">
                          <div>
                            <div className="text-foreground font-medium">{a.name}</div>
                            <div className="text-slate-400 text-xs">
                              {[a.industry, a.region, a.buyingStage].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          {a.intentScore != null && (
                            <span className="text-cyan-400 text-sm font-mono">{a.intentScore}</span>
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
                  className="group flex items-center justify-between gap-2 w-full text-left p-3 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-colors text-slate-300 hover:text-foreground"
                >
                  <span className="text-sm">{example}</span>
                  <CornerDownLeft className="h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
