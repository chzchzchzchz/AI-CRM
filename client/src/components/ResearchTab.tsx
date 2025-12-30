import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Sparkles, TrendingUp, RefreshCw, Newspaper, Clock } from "lucide-react";
import { Streamdown } from "streamdown";

interface ResearchTabProps {
  accountId: number;
}

export function ResearchTab({ accountId }: ResearchTabProps) {
  const { data, isLoading, refetch } = trpc.ai.compileResearch.useQuery({ accountId });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* AI Research Compilation */}
      <Card className="card-elevated border-l-4 border-l-cyan-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-500" />
                AI Research Synthesis
              </CardTitle>
              <CardDescription>
                AI-compiled competitive intelligence, trigger events, and market insights
              </CardDescription>
            </div>
            {data && (
              <div className="flex items-center gap-2">
                {data.cached && (
                  <Badge variant="outline" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Cached ({data.cacheAge}m ago)
                  </Badge>
                )}
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
            </div>
          ) : data ? (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Streamdown>{data.insights}</Streamdown>
              </div>

              {/* Raw Trigger Events */}
              {data.rawTriggers && Object.keys(data.rawTriggers).length > 0 && (
                <Card className="bg-orange-500/5 border-orange-500/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      Trigger Events (Raw Data)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(data.rawTriggers).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium">{key}:</span>{" "}
                        <span className="text-muted-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Raw News Data */}
              {data.rawNews && Object.keys(data.rawNews).length > 0 && (
                <Card className="bg-blue-500/5 border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Newspaper className="h-4 w-4 text-blue-500" />
                      News & Funding (Raw Data)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(data.rawNews).map(([key, value]) => 
                      value ? (
                        <div key={key} className="text-sm">
                          <span className="font-medium">{key}:</span>{" "}
                          <span className="text-muted-foreground">{String(value)}</span>
                        </div>
                      ) : null
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="p-4 rounded-lg bg-muted/50 text-center text-muted-foreground">
              No research insights available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
