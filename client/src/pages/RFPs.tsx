import { useState } from "react";
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
    // Key is optional — the server uses SAM_GOV_API_KEY when the field is blank.
    scrapeMutation.mutate(apiKey ? { apiKey } : {});
  };

  const filteredRFPs = rfps.filter((rfp: any) => {
    const matchesSearch = !searchQuery || 
      rfp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (rfp.agency && rfp.agency.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rfp.description && rfp.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = true; // type field removed from schema
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div>

      <div className="container py-1 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground mb-2">RFP Monitor</h1>
            <p className="text-ink-muted">
              Track open government RFPs from SAM.gov
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {stats && (
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-card border border-border rounded-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">{stats.total}</div>
                  <div className="text-xs text-ink-muted">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-positive">{stats.open}</div>
                  <div className="text-xs text-ink-muted">Open</div>
                </div>
              </div>
            )}
            <Button
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              className="bg-accent hover:bg-accent gap-2"
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
          <Card>
            <CardContent className="p-6">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-ink-muted mb-2 block">
                    SAM.gov API Key
                  </label>
                  <p className="text-xs text-ink-muted mb-3">
                    Get your API key from{" "}
                    <a
                      href="https://sam.gov/content/system-accounts"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline underline-offset-2"
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
                      className="bg-canvas border-border-strong text-foreground"
                    />
                    <Button
                      onClick={handleScrape}
                      disabled={!apiKey || scrapeMutation.isPending}
                      className="bg-accent hover:bg-accent"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
            <Input
              placeholder="Search RFPs by title, agency, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Filter by category" className="w-48 bg-card border-border text-foreground">
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
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : filteredRFPs.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-ink-subtle mx-auto mb-4" />
              <p className="text-ink-muted mb-2">No RFPs found</p>
              <p className="text-sm text-ink-muted">
                {rfps.length === 0 
                  ? "Click 'Scrape SAM.gov' to fetch the latest opportunities"
                  : "Try adjusting your search or filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRFPs.map((rfp: any) => {
              // keywords field removed from schema
              
              return (
                <Card key={rfp.id} className="bg-card border-border hover:border-accent/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{rfp.title}</h3>
                          <Badge 
                            variant="outline" 
                            className="border-accent/30 text-accent"
                          >
                            RFP
                          </Badge>
                          {rfp.status === "open" && (
                            <Badge variant="outline" className="border-positive/30 text-positive">
                              Open
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted mb-3">
                          <span className="flex flex-wrap items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {rfp.agency}
                          </span>
                          {rfp.responseDeadline && (
                            <span className="flex flex-wrap items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Deadline: {new Date(rfp.responseDeadline).toLocaleDateString()}
                            </span>
                          )}
                          {rfp.awardAmount && (
                            <span className="flex flex-wrap items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              ${rfp.awardAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {rfp.description && (
                          <p className="text-ink-muted text-sm mb-3 line-clamp-2">
                            {rfp.description}
                          </p>
                        )}
                        {/* Keywords field removed from schema */}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-accent/30 text-accent hover:bg-accent-subtle"
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
