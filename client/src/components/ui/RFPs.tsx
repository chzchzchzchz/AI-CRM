import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Search, ExternalLink, Calendar, DollarSign, Building2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function RFPs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const { data: rfps = [], isLoading, refetch } = trpc.rfps.list.useQuery({
    status: "open",
    limit: 100
  });

  const { data: stats } = trpc.rfps.stats.useQuery();

  const scrapeMutation = trpc.rfps.scrape.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        refetch();
        setShowApiKeyInput(false);
      } else {
        toast.error(`Scraping failed: ${result.error}`);
      }
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    }
  });

  const handleScrape = () => {
    if (!apiKey) {
      toast.error("Please enter your SAM.gov API key");
      return;
    }
    scrapeMutation.mutate({ apiKey });
  };

  const filteredRFPs = rfps.filter(rfp => {
    const matchesSearch = !searchQuery || 
      rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rfp.agency.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rfp.description && rfp.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || rfp.type === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />

      <div className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">RFP Monitor</h1>
            <p className="text-slate-400">
              Track open RFPs for MFA, SSO, and Zero Trust from SAM.gov
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="flex items-center gap-4 px-4 py-2 bg-slate-900/50 border border-slate-800 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400">{stats.total}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{stats.open}</div>
                  <div className="text-xs text-slate-500">Open</div>
                </div>
              </div>
            )}
            <Button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="bg-cyan-600 hover:bg-cyan-700 gap-2"
              disabled={scrapeMutation.isPending}
            >
              {scrapeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Scrape SAM.gov
                </>
              )}
            </Button>
          </div>
        </div>

        {showApiKeyInput && (
          <Card className="card-elevated">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    SAM.gov API Key
                  </label>
                  <p className="text-xs text-slate-500 mb-3">
                    Get your API key from{" "}
                    <a
                      href="https://sam.gov/content/system-accounts"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline"
                    >
                      SAM.gov System Accounts
                    </a>
                  </p>
                  <div className="flex gap-3">
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your SAM.gov API key"
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                    <Button
                      onClick={handleScrape}
                      disabled={!apiKey || scrapeMutation.isPending}
                      className="bg-cyan-600 hover:bg-cyan-700"
                    >
                      Start Scraping
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search RFPs by title, agency, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-800 text-white"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 bg-slate-900/50 border-slate-800 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="private">Private Sector</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        ) : filteredRFPs.length === 0 ? (
          <Card className="card-elevated">
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No RFPs found</p>
              <p className="text-sm text-slate-500">
                {rfps.length === 0 
                  ? "Click 'Scrape SAM.gov' to fetch the latest opportunities"
                  : "Try adjusting your search or filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRFPs.map((rfp) => {
              const keywords = rfp.keywords ? JSON.parse(rfp.keywords as any) : {};
              
              return (
                <Card key={rfp.id} className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">{rfp.title}</h3>
                          <Badge 
                            variant="outline" 
                            className={rfp.type === "government" 
                              ? "border-cyan-500/30 text-cyan-400" 
                              : "border-purple-500/30 text-purple-400"}
                          >
                            {rfp.type === "government" ? "Government" : "Private"}
                          </Badge>
                          {rfp.status === "open" && (
                            <Badge variant="outline" className="border-green-500/30 text-green-400">
                              Open
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {rfp.agency}
                          </span>
                          {rfp.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Deadline: {new Date(rfp.deadline).toLocaleDateString()}
                            </span>
                          )}
                          {rfp.budget && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              {rfp.budget}
                            </span>
                          )}
                        </div>
                        {rfp.description && (
                          <p className="text-slate-300 text-sm mb-3 line-clamp-2">
                            {rfp.description}
                          </p>
                        )}
                        {Object.keys(keywords).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {(Object.entries(keywords) as [string, any][]).map(([key, value]) => (
                              value && (
                                <Badge key={key} variant="secondary" className="bg-slate-800/50 text-slate-300">
                                  {String(value)}
                                </Badge>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                        onClick={() => rfp.url && window.open(rfp.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View RFP
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
