import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva(
  "text-card-foreground flex flex-col rounded-xl transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  {
    variants: {
      variant: {
        /** The default: a surface lifted off the canvas by a hairline. */
        default: "bg-card border border-border-subtle shadow-xs",
        /** For panels that sit on top of other surfaces (menus, dialogs). */
        raised: "bg-surface-raised border border-border shadow-md",
        /** Recessed wells — filter bars, empty states, code blocks. */
        sunken: "bg-surface-sunken border border-border-subtle",
        /** Structure without a visible container. */
        ghost: "bg-transparent",
      },
      interactive: {
        true: "cursor-pointer hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background outline-none",
        false: "",
      },
    },
    defaultVariants: { variant: "default", interactive: false },
  }
);

function Card({
  className,
  variant,
  interactive,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, interactive }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min items-start gap-1 px-5 pt-4 pb-3",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-action]:items-center",
        "[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-sm leading-tight font-semibold tracking-[-0.01em]",
        className
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-ink-muted text-xs leading-relaxed", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-5 pb-4", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center gap-2 px-5 pt-3 pb-4 [.border-t]:pt-3",
        className
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
};
