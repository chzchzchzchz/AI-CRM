import { cn } from "@/lib/utils";
import { useId } from "react";

/* ============================================================================
   Charts, drawn by hand.

   These replace a charting library that was pulling in ~500kB (and a
   vulnerable lodash) to render what are, in this app, four shapes. Everything
   below is plain SVG sized by viewBox with `preserveAspectRatio="none"` where
   the shape should stretch, so it is responsive without a resize observer.

   Colours come from `--series-*` / `--intent-*` tokens, so charts restyle with
   the theme instead of hardcoding hex values.
   ========================================================================== */

export const SERIES_TOKENS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
] as const;

export function seriesColor(i: number) {
  return SERIES_TOKENS[i % SERIES_TOKENS.length];
}

/** Maps a 0–100 score onto the five-step cold→hot ramp. */
export function intentColor(score: number) {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 80) return "var(--intent-5)";
  if (s >= 60) return "var(--intent-4)";
  if (s >= 40) return "var(--intent-3)";
  if (s >= 20) return "var(--intent-2)";
  return "var(--intent-1)";
}

/* -------------------------------------------------------------------------- */

export type RankedDatum = {
  label: string;
  value: number;
  /** Overrides the derived colour when the row has its own meaning. */
  color?: string;
  meta?: React.ReactNode;
};

/**
 * The workhorse: a ranked horizontal bar list. Bars are scaled against the
 * largest value rather than the total, so the top row always fills the track
 * and small differences stay visible.
 */
export function RankedBars({
  data,
  max,
  showValue = true,
  formatValue = (n: number) => n.toLocaleString(),
  colorBy = "series",
  className,
  emptyLabel = "No data",
}: {
  data: RankedDatum[];
  max?: number;
  showValue?: boolean;
  formatValue?: (n: number) => string;
  colorBy?: "series" | "accent" | "intent";
  className?: string;
  emptyLabel?: string;
}) {
  if (!data.length) {
    return <p className="py-6 text-center text-xs text-ink-faint">{emptyLabel}</p>;
  }

  const ceiling = max ?? Math.max(...data.map(d => d.value), 1);

  return (
    <ul className={cn("space-y-2.5", className)}>
      {data.map((d, i) => {
        const pct = ceiling > 0 ? Math.max(0, (d.value / ceiling) * 100) : 0;
        const fill =
          d.color ??
          (colorBy === "accent"
            ? "var(--accent)"
            : colorBy === "intent"
              ? intentColor(d.value)
              : seriesColor(i));

        return (
          <li key={`${d.label}-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-xs text-ink-muted">
                {d.label}
              </span>
              {showValue && (
                <span
                  data-numeric
                  className="shrink-0 text-xs font-medium tabular-nums"
                >
                  {formatValue(d.value)}
                </span>
              )}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div
                className="h-full rounded-sm transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${pct}%`, backgroundColor: fill }}
                role="meter"
                aria-valuenow={d.value}
                aria-valuemin={0}
                aria-valuemax={ceiling}
                aria-label={d.label}
              />
            </div>
            {d.meta && <div className="mt-1 text-2xs text-ink-faint">{d.meta}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A compact trend line with an optional tinted area. Used inline in metric
 * tiles, so it carries no axes — it shows shape, not values.
 */
export function Sparkline({
  data,
  color = "var(--accent)",
  area = true,
  height = 32,
  className,
}: {
  data: number[];
  color?: string;
  area?: boolean;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();

  if (data.length < 2) {
    return <div style={{ height }} className={className} aria-hidden="true" />;
  }

  const W = 100;
  const H = 30;
  const min = Math.min(...data);
  const max = Math.max(...data);
  // A flat series would divide by zero; render it down the middle instead.
  const span = max - min || 1;
  const pad = 2;

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return [x, y] as const;
  });

  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const fill = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      height={height}
      className={cn("w-full overflow-visible", className)}
      aria-hidden="true"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fill} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Vertical bars for time-bucketed counts. Bars keep a minimum height so empty
 * buckets stay visible as gaps rather than vanishing.
 */
export function BarSeries({
  data,
  color = "var(--accent)",
  height = 96,
  formatValue = (n: number) => n.toLocaleString(),
  className,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
  className?: string;
}) {
  if (!data.length) {
    return <p className="py-6 text-center text-xs text-ink-faint">No data</p>;
  }
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className={className}>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="group relative flex min-w-0 flex-1 flex-col justify-end"
            title={`${d.label}: ${formatValue(d.value)}`}
          >
            <div
              className="w-full rounded-t-sm transition-[height] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:brightness-110"
              style={{
                height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 1.5)}%`,
                backgroundColor: d.value > 0 ? color : "var(--border)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <div
            key={`${d.label}-label-${i}`}
            className="min-w-0 flex-1 truncate text-center text-2xs text-ink-faint"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A donut for part-to-whole splits, drawn with stroke-dasharray on a single
 * circle per segment — no path math, and it animates cleanly.
 */
export function Donut({
  data,
  size = 132,
  thickness = 12,
  centerLabel,
  centerValue,
  className,
}: {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: React.ReactNode;
  centerValue?: React.ReactNode;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <div className={cn("flex items-center gap-5", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--surface-sunken)"
            strokeWidth={thickness}
          />
          {total > 0 &&
            data.map((d, i) => {
              const frac = d.value / total;
              const dash = frac * circumference;
              const seg = (
                <circle
                  key={`${d.label}-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color ?? seriesColor(i)}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
                </circle>
              );
              offset += dash;
              return seg;
            })}
        </svg>
        {(centerValue || centerLabel) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span data-numeric className="text-xl font-semibold tracking-tight">
              {centerValue}
            </span>
            <span className="text-2xs text-ink-faint">{centerLabel}</span>
          </div>
        )}
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d, i) => (
          <li key={`${d.label}-legend-${i}`} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: d.color ?? seriesColor(i) }}
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{d.label}</span>
            <span data-numeric className="shrink-0 font-medium tabular-nums">
              {d.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * A single 0–100 score rendered as a track. Colour follows the intent ramp so
 * a hot account is legible at a glance without reading the number.
 */
export function ScoreBar({
  score,
  showLabel = true,
  className,
}: {
  score: number;
  showLabel?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-sm transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${clamped}%`, backgroundColor: intentColor(clamped) }}
        />
      </div>
      {showLabel && (
        <span data-numeric className="w-7 shrink-0 text-right text-xs font-medium tabular-nums">
          {Math.round(clamped)}
        </span>
      )}
    </div>
  );
}
