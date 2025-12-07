import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  borderColor: "blue" | "red" | "orange" | "cyan" | "purple" | "yellow" | "green" | "pink";
  className?: string;
}

const borderColorClasses = {
  blue: "border-l-[#3B82F6]",
  red: "border-l-[#EF4444]",
  orange: "border-l-[#F97316]",
  cyan: "border-l-[#06B6D4]",
  purple: "border-l-[#8B5CF6]",
  yellow: "border-l-[#EAB308]",
  green: "border-l-[#10B981]",
  pink: "border-l-[#EC4899]",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  borderColor,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "p-6 border-l-4",
        borderColorClasses[borderColor],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            {Icon && <Icon className="h-4 w-4" />}
            <span>{title}</span>
          </div>
          <div className="text-3xl font-bold mb-1">{value}</div>
          {subtitle && (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
