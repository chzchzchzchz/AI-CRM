import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, Sparkles, Loader2, Shield, Lock, 
  Cloud, MessageSquare, Code, Server, AlertTriangle
} from "lucide-react";

interface TechStackAnalysisProps {
  accountId: number;
}

const categoryConfig = {
  mfa: { label: "MFA Providers", icon: Lock, color: "text-critical" },
  sso: { label: "SSO Providers", icon: Shield, color: "text-caution" },
  edr: { label: "EDR/Security", icon: AlertTriangle, color: "text-caution" },
  crm: { label: "CRM Systems", icon: BarChart3, color: "text-accent" },
  communication: { label: "Communication Tools", icon: MessageSquare, color: "text-positive" },
  development: { label: "Development Tools", icon: Code, color: "text-accent" },
  cloud: { label: "Cloud Infrastructure", icon: Cloud, color: "text-accent" },
  security: { label: "Security Tools", icon: Shield, color: "text-accent" },
  other: { label: "Other Technologies", icon: Server, color: "text-ink-subtle" }
};

export function TechStackAnalysis({ accountId }: TechStackAnalysisProps) {
  const [analyzed, setAnalyzed] = useState(false);
  const analyzeMutation = trpc.ai.analyzeTechStack.useMutation();

  const handleAnalyze = async () => {
    try {
      await analyzeMutation.mutateAsync({ accountId });
      setAnalyzed(true);
    } catch (error) {
      console.error("Failed to analyze tech stack:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Technology Stack
        </CardTitle>
        <CardDescription>
          AI-powered analysis of technologies and tools used by this account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analyzed ? (
          <Button 
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending}
            className="text-foreground"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze Tech Stack with AI
              </>
            )}
          </Button>
        ) : null}

        {analyzeMutation.data && (
          <div className="space-y-6">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const Icon = config.icon;
              const technologies = analyzeMutation.data.categories[key as keyof typeof analyzeMutation.data.categories] || [];
              
              return (
                <div key={key} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${config.color}`} />
                    <h4 className="font-semibold">{config.label}</h4>
                  </div>
                  <div className="pl-7">
                    {technologies.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None detected</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {technologies.map((tech: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-sm">
                            {tech}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {analyzeMutation.isError && (
          <div className="p-4 rounded-sm bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              Failed to analyze technology stack. Please try again.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
