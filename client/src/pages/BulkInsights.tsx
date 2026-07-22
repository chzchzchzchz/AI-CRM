import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Navigation } from "../components/Navigation";
import { Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";

export default function BulkInsights() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<any>(null);

  const generateMutation = trpc.bulkInsights.generateForTopLeads.useMutation({
    onSuccess: (data) => {
      setResults(data);
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("Bulk insights generation failed:", error);
      setIsGenerating(false);
    }
  });

  const handleGenerate = (limit: number) => {
    setIsGenerating(true);
    setResults(null);
    generateMutation.mutate({ limit });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <Navigation />
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Bulk AI Insights Generation</h1>
        <p className="text-muted-foreground">
          Generate strategic recommendations for your top hot leads automatically
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Generate Insights for Top Hot Leads
            </CardTitle>
            <CardDescription>
              AI will analyze each account's contacts, intent score, and activity to generate standardized strategic recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => handleGenerate(10)}
                disabled={isGenerating}
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate for Top 10 Leads"
                )}
              </Button>

              <Button
                onClick={() => handleGenerate(25)}
                disabled={isGenerating}
                size="lg"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate for Top 25 Leads"
                )}
              </Button>

              <Button
                onClick={() => handleGenerate(50)}
                disabled={isGenerating}
                size="lg"
                variant="outline"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate for Top 50 Leads"
                )}
              </Button>
            </div>

            {isGenerating && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-muted-foreground">
                  Processing... This may take several minutes depending on the number of accounts.
                </p>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">How It Works:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Selects accounts with intent score 70+ (hot leads)</li>
                <li>• Fetches real contact data, call history, and account details</li>
                <li>• Generates standardized insights using AI (Executive Summary, Key Stakeholders, Talking Points, Next Actions, Risks)</li>
                <li>• Caches results in database for instant access</li>
                <li>• Takes ~3-5 seconds per account</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {results && (
          <Card>
            <CardHeader>
              <CardTitle>Generation Results</CardTitle>
              <CardDescription>
                Processed {results.total} accounts • {results.processed} successful • {results.failed} failed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">{results.total}</div>
                      <p className="text-xs text-muted-foreground">Total Accounts</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-green-600">{results.processed}</div>
                      <p className="text-xs text-muted-foreground">Successful</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <p className="font-medium">Account Details:</p>
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {results.results.map((result: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 border rounded-lg"
                      >
                        {result.success ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{result.accountName}</p>
                          {!result.success && (
                            <p className="text-sm text-red-600">{result.error}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm text-green-800">
                    ✅ Insights have been cached and are now available on each account's AI Insights tab. Navigate to any of the processed accounts to view their strategic recommendations.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </div>
  );
}
