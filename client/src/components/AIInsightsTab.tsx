import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { RefreshCw, Clock, Target } from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";

interface AIInsightsTabProps {
  accountId: number;
}

export function AIInsightsTab({ accountId }: AIInsightsTabProps) {
  const [forceRefresh, setForceRefresh] = useState(false);
  const utils = trpc.useUtils();
  
  const { data, isLoading, isFetching } = trpc.ai.generateStrategicInsights.useQuery(
    { accountId, forceRefresh },
    { 
      staleTime: forceRefresh ? 0 : 5 * 60 * 1000, // 5 min cache unless forcing
      refetchOnWindowFocus: false
    }
  );

  const handleRefresh = async () => {
    try {
      // Invalidate the cache first
      await utils.ai.generateStrategicInsights.invalidate({ accountId });
      // Set forceRefresh to true to bypass cache
      setForceRefresh(true);
      // Refetch the data
      await utils.ai.generateStrategicInsights.refetch({ accountId, forceRefresh: true });
      // Reset forceRefresh after a delay so next normal load uses cache
      setTimeout(() => setForceRefresh(false), 500);
    } catch (error) {
      console.error('Failed to refresh insights:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Strategic Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-accent" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered buying signals, outreach strategies, and next best actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {data?.cached && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  Cached ({data.cacheAge}m ago)
                </Badge>
              )}
              <Button
                onClick={handleRefresh}
                variant="outline"
                size="sm"
                disabled={isLoading || isFetching}
              >
                <RefreshCw className={`h-4 w-4 ${(isLoading || isFetching) ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isLoading || isFetching) ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {forceRefresh ? "Regenerating insights..." : "Loading insights..."}
              </div>
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
              <div className="h-4 bg-muted rounded animate-pulse w-3/6" />
            </div>
          ) : data ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <SafeStreamdown>{data.recommendations}</SafeStreamdown>
            </div>
          ) : (
            <div className="p-4 rounded-sm bg-muted/50 text-center text-muted-foreground">
              No strategic insights available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
