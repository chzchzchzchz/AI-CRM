import { cn } from "@/lib/utils";

/**
 * Every page opens the same way: an eyebrow for context, a title, one line of
 * description, and right-aligned actions. Consistency here is most of what
 * makes a multi-page app feel like one product.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <div className="text-2xs font-medium tracking-wider text-ink-faint uppercase">
            {eyebrow}
          </div>
        )}
        <h2 className="truncate text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="max-w-2xl text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** A titled band inside a page, for grouping cards under a subheading. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
