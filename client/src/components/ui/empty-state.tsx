import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Empty states say what would go here and offer the one action that fills it.
 * The icon sits in a recessed well rather than floating, so an empty region
 * still reads as a deliberate part of the layout.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-8" : "gap-3 py-14",
        className
      )}
    >
      {Icon && (
        <div className="grid size-10 place-items-center rounded-md border border-border-subtle bg-surface-sunken">
          <Icon className="size-4.5 text-ink-faint" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && (
          <p className="mx-auto max-w-sm text-xs text-ink-muted">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
