import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Badges are tinted, not filled. A wall of saturated pills is the fastest way
 * to make a dense table unreadable, so the default treatment is a low-chroma
 * wash with a matching border and full-strength text.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap",
    "rounded-full border px-2 py-0.5 text-2xs font-medium",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
    "transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background outline-none",
  ],
  {
    variants: {
      variant: {
        default: "border-accent/25 bg-accent-subtle text-accent",
        secondary: "border-border-subtle bg-muted text-ink-muted",
        outline: "border-border text-ink-muted",
        solid: "border-transparent bg-accent text-accent-foreground",
        positive: "border-positive/25 bg-positive-subtle text-positive",
        caution: "border-caution/30 bg-caution-subtle text-caution",
        critical: "border-critical/25 bg-critical-subtle text-critical",
        destructive: "border-critical/25 bg-critical-subtle text-critical",
      },
      size: {
        default: "px-2 py-0.5 text-2xs",
        sm: "px-1.5 py-0 text-2xs",
        lg: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/**
 * A status dot with an optional label. Cheaper than a badge visually, so it
 * works inside table rows where a pill would shout.
 */
function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & {
  tone?: "neutral" | "accent" | "positive" | "caution" | "critical";
  pulse?: boolean;
}) {
  const toneClass = {
    neutral: "bg-ink-faint",
    accent: "bg-accent",
    positive: "bg-positive",
    caution: "bg-caution",
    critical: "bg-critical",
  }[tone];

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs", className)}
      {...props}
    >
      <span className="relative flex size-1.5 shrink-0">
        {pulse && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              toneClass
            )}
          />
        )}
        <span
          className={cn("relative inline-flex size-1.5 rounded-full", toneClass)}
        />
      </span>
      {children}
    </span>
  );
}

export { Badge, badgeVariants, StatusDot };
