import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Buttons carry a 1px inset highlight on their top edge and press down by a
 * single pixel. That is the whole trick: it reads as a physical control
 * rather than a coloured rectangle, without a gradient anywhere.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap",
    "rounded-md font-medium select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "active:translate-y-px",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "aria-invalid:border-critical",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-accent text-accent-foreground shadow-xs",
          "hover:brightness-[1.08]",
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:rounded-t-md",
          "after:bg-white/20",
        ],
        destructive: [
          "bg-critical text-critical-foreground shadow-xs",
          "hover:brightness-[1.08]",
          "focus-visible:ring-critical",
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:rounded-t-md",
          "after:bg-white/20",
        ],
        outline: [
          "border border-border bg-surface text-foreground shadow-xs",
          "hover:bg-muted hover:border-border-strong",
        ],
        secondary: [
          "bg-secondary text-secondary-foreground",
          "hover:bg-muted",
        ],
        ghost: "text-ink-muted hover:bg-muted hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline active:translate-y-0",
        /**
         * The single highest-intent action on a view. Kept as a named variant
         * so call sites keep expressing that intent, but it now resolves to
         * the accent rather than a hardcoded cyan-on-near-black pair.
         */
        signal: [
          "bg-accent text-accent-foreground font-semibold shadow-sm",
          "hover:brightness-[1.08]",
          "after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:rounded-t-md",
          "after:bg-white/20",
        ],
      },
      size: {
        default: "h-8 px-3 text-sm has-[>svg]:px-2.5",
        sm: "h-7 gap-1 rounded-sm px-2.5 text-xs has-[>svg]:px-2",
        lg: "h-10 rounded-lg px-5 text-base has-[>svg]:px-4",
        icon: "size-8",
        "icon-sm": "size-7 rounded-sm",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
