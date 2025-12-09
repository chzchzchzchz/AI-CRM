import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { Sparkles, RefreshCw, Clock, Target, TrendingUp, Users, MessageSquare, Lightbulb, AlertTriangle, BarChart3 } from "lucide-react";
import { Streamdown } from "streamdown";

interface AIInsightsTabProps {
  accountId: number;
}

export function AIInsightsTab({ accountId }: AIInsightsTabProps) {
  const { data, isLoading, refetch } = trpc.ai.generateStrategicInsights.useQuery({ accountId });

  const handleRefresh = () => {
    refetch();
  };

  // Parse the markdown sections from the AI response
  const parseSections = (content: string) => {
    const sections: Record<string, string> = {};
    const sectionRegex = /## (.+?)\n([\s\S]+?)(?=\n## |$)/g;
    let match;
    
    while ((match = sectionRegex.exec(content)) !== null) {
      const title = match[1].trim();
      const body = match[2].trim();
      sections[title] = body;
    }
    
    return sections;
  };

  const sections = data?.recommendations ? parseSections(data.recommendations) : {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Account Activation Brief
          </h3>
          <p className="text-sm text-muted-foreground">
            AI-powered intelligence for cold outreach
          </p>
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
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-5 bg-muted rounded animate-pulse w-1/3" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-muted rounded animate-pulse w-4/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data && sections ? (
        <div className="space-y-4">
          {/* Why This Account Is Worth Our Time */}
          {sections["Why This Account Is Worth Our Time"] && (
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Why This Account Is Worth Our Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{sections["Why This Account Is Worth Our Time"]}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Who to Contact First */}
          {sections["Who to Contact First"] && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Who to Contact First
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{sections["Who to Contact First"]}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Predicted Value Prop */}
          {sections["Predicted Value Prop"] && (
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  Predicted Value Prop
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{sections["Predicted Value Prop"]}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation Starting Point */}
          {sections["Conversation Starting Point"] && (
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-orange-500" />
                  Conversation Starting Point
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{sections["Conversation Starting Point"]}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Suggested Outreach Message */}
          {sections["Suggested Outreach Message"] && (
            <Card className="border-l-4 border-l-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-cyan-500" />
                  Suggested Outreach Message
                </CardTitle>
                <CardDescription>Copy and customize this message</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="font-mono text-sm p-3 bg-background rounded border">
                  <Streamdown>{sections["Suggested Outreach Message"]}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Landmine Warnings */}
          {sections["Landmine Warnings"] && (
            <Alert variant="destructive" className="border-l-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Landmine Warnings</div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Streamdown>{sections["Landmine Warnings"]}</Streamdown>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Confidence Level */}
          {sections["Confidence Level"] && (
            <Card className="border-l-4 border-l-gray-500">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-gray-500" />
                  Confidence Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground">
                  <Streamdown>{sections["Confidence Level"]}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No activation brief available</p>
            <Button onClick={handleRefresh} variant="outline" size="sm" className="mt-4">
              Generate Brief
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
