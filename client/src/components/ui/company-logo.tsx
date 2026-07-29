import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";

/* ============================================================================
   Company logos, resolved from a domain.

   Accounts and contacts carry a website, so the real mark can be fetched
   instead of drawing a coloured letter tile. Sources are tried in order and
   each failure falls through to the next; if every source misses (common for
   private or fictional domains) we land on a monogram whose tint is derived
   from the domain, so the same company always gets the same colour.

   Resolvers are public favicon endpoints that need no API key. Self-hosters
   behind a strict CSP or an air gap can point VITE_LOGO_RESOLVER at their own
   service — `{domain}` and `{size}` are substituted — or set it to "off" to
   always use monograms.
   ========================================================================== */

const CUSTOM_RESOLVER = import.meta.env.VITE_LOGO_RESOLVER as string | undefined;

const DEFAULT_RESOLVERS = [
  (d: string, s: number) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
  (d: string, s: number) =>
    `https://www.google.com/s2/favicons?domain=${d}&sz=${s >= 64 ? 128 : 64}`,
];

function resolvers(): ((d: string, s: number) => string)[] {
  if (CUSTOM_RESOLVER === "off") return [];
  if (CUSTOM_RESOLVER) {
    return [
      (d, s) =>
        CUSTOM_RESOLVER.replace("{domain}", encodeURIComponent(d)).replace(
          "{size}",
          String(s)
        ),
      ...DEFAULT_RESOLVERS,
    ];
  }
  return DEFAULT_RESOLVERS;
}

/** Normalises anything account records tend to hold into a bare hostname. */
export function toDomain(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s || s === "-" || s === "n/a") return null;
  s = s.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  s = s.split("/")[0].split("?")[0].split("#")[0].split("@").pop() ?? s;
  // Must look like host.tld; bare words are not domains.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return null;
  return s;
}

/** Stable hash -> series token, so a company keeps its colour across renders. */
function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return `var(--series-${(Math.abs(h) % 6) + 1})`;
}

function monogramOf(name?: string | null, domain?: string | null): string {
  const src = (name || domain || "?").replace(/^(the|a)\s+/i, "").trim();
  const words = src.split(/[\s.\-_]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase() || "?";
}

const SIZE_CLASS = {
  xs: "size-5 text-2xs",
  sm: "size-6 text-2xs",
  md: "size-8 text-2xs",
  lg: "size-10 text-xs",
  xl: "size-14 text-sm",
} as const;

const SIZE_PX = { xs: 20, sm: 24, md: 32, lg: 40, xl: 56 } as const;

export function CompanyLogo({
  name,
  website,
  domain: domainProp,
  size = "md",
  className,
}: {
  name?: string | null;
  /** Raw value from the record — URL, host, or email domain all work. */
  website?: string | null;
  domain?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const domain = useMemo(
    () => toDomain(domainProp) ?? toDomain(website),
    [domainProp, website]
  );
  const chain = useMemo(() => (domain ? resolvers() : []), [domain]);
  const [attempt, setAttempt] = useState(0);

  const px = SIZE_PX[size];
  const exhausted = attempt >= chain.length;
  const monogram = monogramOf(name, domain);

  const shell = cn(
    "relative grid shrink-0 place-items-center overflow-hidden rounded-sm",
    "border border-border-subtle bg-surface",
    SIZE_CLASS[size],
    className
  );

  if (!domain || exhausted) {
    const tint = tintFor(domain || name || "?");
    return (
      <span
        className={shell}
        style={{
          // A wash of the company's tint keeps the grid varied without the
          // saturated blocks a fully-filled tile would produce.
          backgroundColor: `color-mix(in oklab, ${tint} 14%, var(--surface))`,
          color: tint,
          borderColor: `color-mix(in oklab, ${tint} 28%, var(--border-subtle))`,
        }}
        aria-hidden="true"
        title={name ?? undefined}
      >
        <span className="font-semibold tracking-tight">{monogram}</span>
      </span>
    );
  }

  return (
    <span className={shell} title={name ?? domain}>
      <img
        src={chain[attempt](domain, px)}
        alt=""
        width={px}
        height={px}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="size-full object-contain"
        onError={() => setAttempt(a => a + 1)}
      />
    </span>
  );
}
