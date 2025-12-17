import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Sparkles, RefreshCw, Clock, Target } from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";

interface AIInsightsTabProps {
  accountId: number;
}

export function AIInsightsTab({ accountId }: AIInsightsTabProps) {
  const { data, isLoading, refetch } = trpc.ai.generateStrategicInsights.useQuery({ accountId });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* AI Strategic Insights */}
      <Card className="card-elevated border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-500" />
                Strategic Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered buying signals, outreach strategies, and next best actions
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
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
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
            <div className="p-4 rounded-lg bg-muted/50 text-center text-muted-foreground">
              No strategic insights available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
