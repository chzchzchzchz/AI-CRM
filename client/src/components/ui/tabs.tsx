import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const TabsVariantContext = React.createContext<"underline" | "segmented">(
  "underline"
);

function Tabs({
  className,
  variant = "underline",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root> & {
  /**
   * `underline` for page-level navigation (reads as structure), `segmented`
   * for switching a single control's mode (reads as a setting).
   */
  variant?: "underline" | "segmented";
}) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-variant={variant}
        className={cn("flex flex-col gap-4", className)}
        {...props}
      />
    </TabsVariantContext.Provider>
  );
}

const tabsListVariants = cva("inline-flex w-fit items-center", {
  variants: {
    variant: {
      underline:
        "h-9 w-full justify-start gap-4 border-b border-border-subtle p-0",
      segmented: "h-8 gap-0.5 rounded-lg bg-surface-sunken p-0.5",
    },
  },
  defaultVariants: { variant: "underline" },
});

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium",
    "transition-[color,background-color,box-shadow] duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /* The active marker is an inset box-shadow so it lands exactly on the
           list's border line rather than a pixel above or below it. */
        underline: [
          "relative -mb-px h-9 rounded-none border-0 px-0.5 pb-2 text-sm",
          "text-ink-muted hover:text-foreground",
          "data-[state=active]:text-foreground",
          "data-[state=active]:shadow-[inset_0_-2px_0_0_var(--accent)]",
        ],
        segmented: [
          "h-7 flex-1 rounded-md px-3 text-xs",
          "text-ink-muted hover:text-foreground",
          "data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-xs",
        ],
      },
    },
    defaultVariants: { variant: "underline" },
  }
);

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
