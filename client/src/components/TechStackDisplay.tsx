import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Shield, Server } from "lucide-react";

interface TechStackDisplayProps {
  techStack: string[] | null;
  securityStack: string[] | null;
}

export function TechStackDisplay({ techStack, securityStack }: TechStackDisplayProps) {
  const hasTechStack = techStack && Array.isArray(techStack) && techStack.length > 0;
  const hasSecurityStack = securityStack && Array.isArray(securityStack) && securityStack.length > 0;

  if (!hasTechStack && !hasSecurityStack) {
    return null;
  }

  return (
    <Card className="card-elevated border-l-4 border-l-cyan-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-cyan-500" />
          Technology Stack
        </CardTitle>
        <CardDescription>
          Technologies and tools used by this account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tech Stack */}
        {hasTechStack && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-500" />
              <h4 className="font-semibold text-sm">Technology Stack</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Security Stack */}
        {hasSecurityStack && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-red-500" />
              <h4 className="font-semibold text-sm">Security Stack</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {securityStack.map((tool, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
                >
                  {tool}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
