import { AlertTriangle } from "lucide-react";

/**
 * Several dashboard queries throw on a genuine failure now instead of quietly resolving
 * to [] (see server/intel/signals.ts, server/sixsense-analytics.ts,
 * server/priority-actions-router.ts) — every consumer page was written to read `data`
 * with a fallback (`data?.foo ?? 0`, `data?.bar.length`), which made a thrown error
 * indistinguishable from a real zero. Pass every query result feeding a page's numbers
 * so a load failure reads as "couldn't check," not "checked and found nothing."
 */
export function DataErrorBanner({ errors, message }: { errors: unknown[]; message: string }) {
  if (!errors.some(Boolean)) return null;
  return (
    <div className="flex items-center gap-2 rounded-sm border border-caution/30 bg-caution-subtle px-4 py-2.5 text-sm text-caution">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      {message}
    </div>
  );
}
