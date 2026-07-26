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
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <BarChart3 className="h-5 w-5 text-accent" />
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
            <div className="flex flex-wrap items-center gap-2">
              <Server className="h-4 w-4 text-accent" />
              <h4 className="font-semibold text-sm">Technology Stack</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="bg-accent-subtle text-accent dark:text-accent border-accent/30"
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
            <div className="flex flex-wrap items-center gap-2">
              <Shield className="h-4 w-4 text-critical" />
              <h4 className="font-semibold text-sm">Security Stack</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {securityStack.map((tool, idx) => (
                <Badge 
                  key={idx} 
                  variant="secondary" 
                  className="bg-critical-subtle text-critical dark:text-critical border-critical/30"
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
