import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";

export type Trend = {
  value: number;
  /** Where up is bad (churn, cost), set this so colour follows meaning. */
  inverted?: boolean;
  label?: string;
};

/**
 * One number, stated plainly. The value carries the visual weight; the label
 * and delta stay quiet. Deltas are coloured by whether they are *good*, not by
 * their sign — a falling churn rate is positive news.
 */
export function Metric({
  label,
  value,
  trend,
  icon: Icon,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  trend?: Trend;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-card px-4 py-3.5", className)}>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 shrink-0 text-ink-faint" />}
        <span className="truncate text-2xs font-medium tracking-wide text-ink-muted uppercase">
          {label}
        </span>
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          data-numeric
          className="text-2xl leading-none font-semibold tracking-tight"
        >
          {value}
        </span>
        {trend && <TrendPill {...trend} />}
      </div>

      {hint && <p className="mt-1.5 text-2xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function TrendPill({ value, inverted = false, label }: Trend) {
  const flat = Math.abs(value) < 0.05;
  const good = inverted ? value < 0 : value > 0;
  const Icon = flat ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      data-numeric
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        flat ? "text-ink-faint" : good ? "text-positive" : "text-critical"
      )}
      title={label}
    >
      <Icon className="size-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/**
 * Metric tiles butted together with 1px gaps, so the group reads as a single
 * instrument panel rather than a row of floating cards.
 */
export function MetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("metric-grid", className)}>{children}</div>;
}
