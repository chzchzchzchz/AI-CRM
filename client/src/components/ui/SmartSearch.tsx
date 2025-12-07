import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Navigation } from "@/components/Navigation";
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
    <div className="min-h-screen bg-slate-950">
      <Navigation onSearchClick={() => {}} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="h-8 w-8 text-cyan-500" />
              <h1 className="text-4xl font-bold text-white">AI-Powered Search</h1>
            </div>
            <p className="text-slate-400">
              Ask anything about your accounts, contacts, or sales data in natural language
            </p>
          </div>

          <Card className="bg-slate-900 border-slate-800 mb-8">
            <CardContent className="p-6">
              <div className="flex gap-4">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="e.g., 'show me high-intent accounts in fintech' or 'who should I call this week?'"
                  className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searchMutation.isPending || !query.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {searchMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Search</>
                  )}
                </Button>
              </div>

              {searchResults && (
                <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-sm text-slate-400 mb-2">AI Interpretation:</p>
                  <p className="text-white">{searchResults.explanation}</p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Intent:</span>
                      <span className="ml-2 text-cyan-400">{searchResults.intent}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Sort By:</span>
                      <span className="ml-2 text-cyan-400">{searchResults.sortBy}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Example Queries</CardTitle>
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
                      className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-colors text-slate-300 hover:text-white"
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
