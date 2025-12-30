import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Sparkles, FileText, RefreshCw, Clock } from "lucide-react";
import { Streamdown } from "streamdown";
import { TechStackAnalysis } from "./TechStackAnalysis";

interface OverviewTabProps {
  accountId: number;
  account: any;
}

export function OverviewTab({ accountId, account }: OverviewTabProps) {
  const { data, isLoading, refetch } = trpc.ai.compileOverview.useQuery({ accountId });

  // Parse stack data
  let stackData: any = {};
  try {
    if (account.techStack) {
      stackData = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
    }
  } catch (e) {
    console.error('Failed to parse stack data:', e);
  }

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* AI Executive Summary */}
      <Card className="card-elevated border-l-4 border-l-primary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Executive Summary
              </CardTitle>
              <CardDescription>
                AI-powered analysis of this account's strategic position and opportunities
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
                disabled={isLoading}
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
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
              <Streamdown>{data.summary}</Streamdown>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted/50 text-center text-muted-foreground">
              No summary available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Description */}
      {account.description && (
        <Card className="card-elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Company Description
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{account.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Technology Stack */}
      {Object.keys(stackData).length > 0 && (
        <TechStackAnalysis accountId={accountId} />
      )}
    </div>
  );
}
