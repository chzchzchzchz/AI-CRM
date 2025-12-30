import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Building2, Search as SearchIcon, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  const searchMutation = trpc.clay.search.useMutation({
    onSuccess: (data) => {
      setCurrentRequestId(data.requestId);
      toast.success("Search sent to Clay!");
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error(`Search failed: ${error.message}`);
    },
  });

  const { data: requests, refetch } = trpc.clay.listRequests.useQuery(undefined, {
    refetchInterval: 3000, // Poll every 3 seconds
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    searchMutation.mutate({ searchQuery: searchQuery.trim() });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "error":
      case "timeout":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      completed: "default",
      error: "destructive",
      timeout: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <Building2 className="h-8 w-8 text-blue-500" />
                <h1 className="text-2xl font-bold text-white">Target Account Dashboard</h1>
              </div>
            </Link>
            <div className="flex gap-2">
              <Link href="/accounts">
                <Button variant="outline" className="border-slate-700 text-white hover:bg-slate-800">
                  View Accounts
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Search Form */}
        <Card className="bg-slate-900/50 border-slate-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <SearchIcon className="h-6 w-6 text-blue-500" />
              Search Clay for Account Data
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter a company name to trigger enrichment from your Clay tables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-4">
              <Input
                placeholder="e.g., Anthropic, OpenAI, ZipRecruiter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                disabled={searchMutation.isPending}
              />
              <Button
                type="submit"
                disabled={searchMutation.isPending || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {searchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Searches */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Searches</CardTitle>
            <CardDescription className="text-slate-400">
              Track the status of your Clay enrichment requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!requests || requests.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <SearchIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No searches yet. Try searching for a company above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(request.status)}
                      <div className="flex-1">
                        <p className="text-white font-medium">{request.searchQuery}</p>
                        <p className="text-sm text-slate-500">
                          Request ID: {request.requestId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(request.status)}
                      <p className="text-sm text-slate-500">
                        {new Date(request.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
