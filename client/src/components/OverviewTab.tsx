import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Sparkles, FileText, RefreshCw, Clock } from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { TechStackDisplay } from "./TechStackDisplay";

interface OverviewTabProps {
  accountId: number;
  account: any;
}

export function OverviewTab({ accountId, account }: OverviewTabProps) {
  const { data, isLoading, refetch } = trpc.ai.compileOverview.useQuery({ accountId });

  // Parse tech stack and security stack data
  let techStack: string[] | null = null;
  let securityStack: string[] | null = null;
  
  try {
    if (account.techStack) {
      techStack = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
    }
  } catch (e) {
    console.error('Failed to parse tech stack:', e);
  }
  
  try {
    if (account.securityStack) {
      securityStack = typeof account.securityStack === 'string' ? JSON.parse(account.securityStack) : account.securityStack;
    }
  } catch (e) {
    console.error('Failed to parse security stack:', e);
  }

  const handleRefresh = () => {
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* AI Executive Summary */}
      <Card>
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
              <SafeStreamdown>{data.summary}</SafeStreamdown>
            </div>
          ) : (
            <div className="p-4 rounded-sm bg-muted/50 text-center text-muted-foreground">
              No summary available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Description */}
      {account.description && (
        <Card>
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
      <TechStackDisplay techStack={techStack} securityStack={securityStack} />
    </div>
  );
}
