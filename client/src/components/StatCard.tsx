import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single figure in a panel. The old version painted a 4px left border in one
 * of eight hues, which turned any row of stats into a rainbow. Tone is now
 * carried by a small icon tint and nothing else — the number itself stays in
 * foreground ink so a row of tiles reads as one instrument.
 */
type Tone = "neutral" | "accent" | "positive" | "caution" | "critical";

/** Legacy colour names map onto the semantic tones they were standing in for. */
const TONE_BY_LEGACY_COLOR: Record<string, Tone> = {
  blue: "accent",
  cyan: "accent",
  purple: "accent",
  pink: "accent",
  green: "positive",
  yellow: "caution",
  orange: "caution",
  red: "critical",
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "text-ink-faint",
  accent: "text-accent",
  positive: "text-positive",
  caution: "text-caution",
  critical: "text-critical",
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  borderColor?: keyof typeof TONE_BY_LEGACY_COLOR;
  tone?: Tone;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  borderColor,
  tone,
  className,
  onClick,
}: StatCardProps) {
  const resolved: Tone =
    tone ?? (borderColor ? TONE_BY_LEGACY_COLOR[borderColor] : undefined) ?? "neutral";

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      onClick={onClick}
      className={cn(
        "bg-card px-4 py-3.5 text-left",
        onClick &&
          "transition-colors hover:bg-muted/60 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={cn("size-3.5 shrink-0", TONE_CLASS[resolved])} />}
        <span className="truncate text-2xs font-medium tracking-wide text-ink-muted uppercase">
          {title}
        </span>
      </div>

      <div
        data-numeric
        className="mt-1.5 text-2xl leading-none font-semibold tracking-tight"
      >
        {value}
      </div>

      {subtitle && <div className="mt-1.5 text-2xs text-ink-faint">{subtitle}</div>}
    </Comp>
  );
}
