import { and, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { accounts, contacts, organizations, usageEvents, users } from "../../drizzle/schema";

/**
 * What an organization is allowed, and what it has actually used.
 *
 * This is the enforcement half of billing. It deliberately is not the pricing half: there
 * are no plan names here, no prices, and no default limits. A missing limit means
 * unlimited, so on every existing deployment this changes precisely nothing until an
 * operator decides a number — because a guessed cap is worse than no cap. It would fire on
 * a real customer, mid-work, for a rule nobody chose.
 *
 * ── Counting ─────────────────────────────────────────────────────────────────────────
 *
 * Seats, accounts and contacts are counted from the rows that already exist. A meter for
 * them would be a second number that can disagree with the first, and when it does the
 * customer is right and you are explaining a bug. AI calls leave no rows of their own, so
 * those are recorded as they happen, one row per call — a running total cannot be
 * re-aggregated over a different window or explained to someone disputing an invoice.
 */

export type LimitKind = "seats" | "accounts" | "contacts" | "aiCallsPerMonth";

export type Entitlements = Partial<Record<LimitKind, number>>;

export type Usage = Record<LimitKind, number>;

export const LIMIT_KINDS: { key: LimitKind; label: string; unit: string }[] = [
  { key: "seats", label: "Seats", unit: "people in this workspace" },
  { key: "accounts", label: "Accounts", unit: "companies" },
  { key: "contacts", label: "Contacts", unit: "people at those companies" },
  { key: "aiCallsPerMonth", label: "AI calls", unit: "this calendar month" },
];

/** The start of the current calendar month, UTC — the window AI calls are counted over. */
export function monthStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function entitlementsFor(db: any, orgId: number): Promise<Entitlements> {
  if (!db) return {};
  try {
    const [row] = await db
      .select({ entitlements: organizations.entitlements })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const raw = row?.entitlements;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Entitlements = {};
    for (const { key } of LIMIT_KINDS) {
      const v = (parsed as any)[key];
      // Only a finite, non-negative number is a limit. Anything else — null, "", "many",
      // NaN — means unset, which means unlimited. A malformed value must not become a
      // cap of zero and lock a customer out of their own workspace.
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[key] = v;
    }
    return out;
  } catch {
    // Unreadable entitlements mean no enforcement, not total enforcement. Failing open is
    // right here: the downside is an unbilled overage, and the alternative is refusing a
    // paying customer their own product because a JSON column would not parse.
    return {};
  }
}

async function count(db: any, table: any, where: any): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(table).where(where);
  return Number(row?.n ?? 0);
}

export async function usageFor(db: any, orgId: number, now: Date = new Date()): Promise<Usage> {
  if (!db) return { seats: 0, accounts: 0, contacts: 0, aiCallsPerMonth: 0 };
  const [seats, accountCount, contactCount, aiCalls] = await Promise.all([
    count(db, users, eq(users.orgId, orgId)),
    count(db, accounts, eq(accounts.orgId, orgId)),
    count(db, contacts, eq(contacts.orgId, orgId)),
    count(
      db,
      usageEvents,
      and(
        eq(usageEvents.orgId, orgId),
        eq(usageEvents.kind, "ai_call"),
        gte(usageEvents.at, monthStart(now))
      )
    ),
  ]);
  return {
    seats,
    accounts: accountCount,
    contacts: contactCount,
    aiCallsPerMonth: aiCalls,
  };
}

export type LimitCheck = {
  kind: LimitKind;
  limit: number;
  used: number;
  adding: number;
  allowed: boolean;
};

/**
 * Would adding `adding` of `kind` exceed this organization's limit?
 *
 * Returns the numbers rather than a bare boolean so a caller can say "47 of 50 seats used,
 * this invitation would be the 51st" instead of "limit reached", which tells a person
 * nothing about what to do next.
 */
export async function checkLimit(
  db: any,
  orgId: number,
  kind: LimitKind,
  adding = 1
): Promise<LimitCheck | null> {
  const limits = await entitlementsFor(db, orgId);
  const limit = limits[kind];
  if (limit === undefined) return null; // unlimited — the default, and most deployments

  const usage = await usageFor(db, orgId);
  const used = usage[kind];
  return { kind, limit, used, adding, allowed: used + adding <= limit };
}

export class LimitExceededError extends TRPCError {
  constructor(check: LimitCheck) {
    const { key, label, unit } = LIMIT_KINDS.find(l => l.key === check.kind)!;
    super({
      code: "FORBIDDEN",
      message:
        `${label} limit reached: ${check.used} of ${check.limit} ${unit}, and this would ` +
        `add ${check.adding}. Ask your administrator to raise the ${key} limit for this ` +
        `workspace.`,
    });
  }
}

/** Refuse when over, say the numbers, and do nothing at all when no limit is set. */
export async function assertWithinLimit(
  db: any,
  orgId: number,
  kind: LimitKind,
  adding = 1
): Promise<void> {
  const check = await checkLimit(db, orgId, kind, adding);
  if (check && !check.allowed) throw new LimitExceededError(check);
}

/**
 * Record consumption that leaves no other trace.
 *
 * Never throws. A metering failure must not fail the thing being metered — losing a row
 * from an invoice is a smaller problem than an AI feature that breaks because a write to
 * a usage table timed out.
 */
export async function recordUsage(
  db: any,
  orgId: number,
  kind: string,
  detail?: string,
  quantity = 1
): Promise<void> {
  try {
    if (!db) return;
    await db.insert(usageEvents).values({ orgId, kind, quantity, detail: detail?.slice(0, 255) });
  } catch {
    /* see above */
  }
}
