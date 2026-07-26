import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Link } from "wouter";

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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-accent" />
              <h1 className="text-xl font-semibold text-foreground">AI-Powered Search</h1>
            </div>
            <p className="text-ink-muted">
              Ask anything about your accounts, contacts, or sales data in natural language
            </p>
          </div>

          <Card className="bg-card border-border mb-8">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., 'show me high-intent accounts in fintech' or 'who should I call this week?'"
                  className="flex-1 bg-muted border-border-strong text-foreground placeholder:text-ink-subtle"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending || !query.trim()}
                  className="bg-accent hover:bg-accent"
                >
                  {searchMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>

              {searchResults && (
                <div className="mt-6 p-4 bg-muted rounded-sm border border-border-strong">
                  <p className="text-sm text-ink-muted mb-2">AI Interpretation:</p>
                  <p className="text-foreground">{searchResults.explanation}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-ink-muted">Intent:</span>
                      <span className="ml-2 text-accent">{searchResults.intent}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted">Sort By:</span>
                      <span className="ml-2 text-accent">{searchResults.sortBy}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Example Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    "Show me accounts with recent security incidents",
                    "Who are the top priority contacts to reach out to?",
                    "Find companies in financial services with high intent scores",
                    "Which accounts mentioned competitors in recent calls?",
                    "Show me accounts that are ready to buy",
                    "Find CISOs at companies with 1000+ employees"
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(example)}
                      className="w-full text-left p-3 rounded-sm bg-muted hover:bg-muted border border-border-strong hover:border-accent/30 transition-colors text-ink-muted hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
