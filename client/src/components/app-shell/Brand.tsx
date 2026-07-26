import { APP_LOGO, APP_TITLE } from "@/const";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * The product mark. Drawn rather than fetched so it inherits the accent token
 * and stays crisp at any density.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid place-items-center rounded-md bg-accent text-accent-foreground shadow-xs",
        "size-7",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-[55%]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 17.5 9 11l4 4 7.5-8" />
        <path d="M15.5 7H21v5.5" />
      </svg>
    </span>
  );
}

/**
 * Mark plus name, for sign-in screens.
 *
 * A custom VITE_APP_LOGO is honoured when set, but it renders at its natural
 * aspect ratio inside a fixed height. The previous treatment forced whatever
 * asset it found into a square box with `object-cover`, which sliced the
 * middle out of the default 188x40 wordmark.
 */
export function BrandLockup({
  className,
  subtitle,
}: {
  className?: string;
  subtitle?: React.ReactNode;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const hasCustomLogo = Boolean(import.meta.env.VITE_APP_LOGO) && !logoFailed;

  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", className)}>
      {hasCustomLogo ? (
        <img
          src={APP_LOGO}
          alt={APP_TITLE}
          className="h-9 w-auto max-w-56 object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div className="flex items-center gap-2.5">
          <BrandMark className="size-8" />
          <span className="text-lg font-semibold tracking-tight">{APP_TITLE}</span>
        </div>
      )}
      {subtitle && <p className="text-sm text-ink-muted">{subtitle}</p>}
    </div>
  );
}
