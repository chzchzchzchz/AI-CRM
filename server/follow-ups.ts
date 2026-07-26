import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { followUps, type FollowUp } from "../drizzle/schema";
import { getDb, getAccountById } from "./db";

/**
 * FOLLOW-UPS — the rep's own commitments.
 *
 * Every other signal in this product is inbound: intent moves, a call lands, a score
 * changes. This is the only place the rep's intent is recorded — "call the CISO at
 * Marvel in six months" — and it is what turns the daily view from a news feed into a
 * to-do list.
 *
 * `list` returns the account and contact details inline rather than ids. That is
 * deliberate: the whole point is to act on a follow-up without leaving the page it
 * appeared on, and a popup that has to go and fetch a contact before it can show a
 * phone number is a navigation with extra steps.
 */

/** Everything the in-place action panel needs, resolved server-side. */
export type FollowUpView = {
  id: number;
  title: string;
  notes: string | null;
  dueDate: string;
  status: string;
  /** Whole days until due; negative means overdue. */
  daysUntilDue: number;
  overdue: boolean;
  account: { id: number; name: string; domain: string | null; industry: string | null } | null;
  contact: {
    id: number;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
  } | null;
};

export function startOfToday(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Whole days from today to `due`. Both ends are floored to local midnight so "due today"
 * is 0 whatever the hour, and so an item created at 23:00 for "tomorrow" isn't already
 * overdue an hour later. Rounded, not floored, so a DST shift can't turn a whole day
 * into 0.96 of one.
 */
export function daysUntil(due: Date, now: Date = new Date()): number {
  const d = new Date(due);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - startOfToday(now).getTime()) / 86_400_000);
}

/** Snooze lands N days from today, never from the original date — see `snooze` below. */
export function snoozeTarget(days: number, now: Date = new Date()): Date {
  const base = startOfToday(now);
  base.setDate(base.getDate() + days);
  return base;
}

async function loadContact(db: any, contactId: number | null) {
  if (!contactId) return null;
  try {
    const { contacts } = await import("../drizzle/schema");
    const rows = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
    const c = rows?.[0];
    if (!c) return null;
    return {
      id: c.id,
      name: c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unknown",
      title: c.title ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      linkedinUrl: c.linkedinUrl ?? null,
    };
  } catch (error) {
    console.error(`[followUps] could not load contact ${contactId}:`, error);
    return null;
  }
}

async function toView(db: any, row: FollowUp): Promise<FollowUpView> {
  const account = row.accountId ? await getAccountById(row.accountId).catch(() => null) : null;
  const contact = await loadContact(db, row.contactId);
  const due = new Date(row.dueDate);
  const days = daysUntil(due);

  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? null,
    dueDate: due.toISOString(),
    status: row.status,
    daysUntilDue: days,
    overdue: row.status === "open" && days < 0,
    account: account
      ? {
          id: (account as any).id,
          name: (account as any).name,
          domain: (account as any).domain ?? null,
          industry: (account as any).industry ?? null,
        }
      : null,
    contact,
  };
}

export const followUpsRouter = router({
  /**
   * `due` is the daily working set: anything open and dated today or earlier.
   * `upcoming` is everything still ahead, so the rep can see what is coming without it
   * competing with today's work.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          window: z.enum(["due", "upcoming", "all", "done"]).default("due"),
          limit: z.number().min(1).max(200).default(50),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const window = input?.window ?? "due";
      const limit = input?.limit ?? 50;

      const db = await getDb();
      if (!db) return { items: [], dueCount: 0, overdueCount: 0, upcomingCount: 0 };

      const rows: FollowUp[] = await db
        .select()
        .from(followUps)
        .where(eq(followUps.userId, ctx.user.id));

      const open = rows.filter((r) => r.status === "open");
      const dueRows = open.filter((r) => daysUntil(new Date(r.dueDate)) <= 0);
      const upcomingRows = open.filter((r) => daysUntil(new Date(r.dueDate)) > 0);

      const picked =
        window === "due"
          ? dueRows
          : window === "upcoming"
            ? upcomingRows
            : window === "done"
              ? rows.filter((r) => r.status === "done")
              : rows;

      // Oldest due first: the thing you have been putting off longest is the thing to
      // do first, not the thing that happens to have been created most recently.
      const sorted = [...picked].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );

      const items = await Promise.all(sorted.slice(0, limit).map((r) => toView(db, r)));

      return {
        items,
        dueCount: dueRows.length,
        overdueCount: dueRows.filter((r) => daysUntil(new Date(r.dueDate)) < 0).length,
        upcomingCount: upcomingRows.length,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        // Date-only from the UI ("2026-12-01"); stored at local midnight.
        dueDate: z.string(),
        notes: z.string().max(4000).optional(),
        accountId: z.number().optional(),
        contactId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const due = new Date(input.dueDate);
      if (Number.isNaN(due.getTime())) throw new Error("Invalid due date");

      const result = await db.insert(followUps).values({
        userId: ctx.user.id,
        title: input.title.trim(),
        notes: input.notes?.trim() || null,
        dueDate: due,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        status: "open",
      });

      return { id: Number(result?.[0]?.insertId ?? 0), success: true };
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Scoped to the caller: an id alone must never be enough to close someone
      // else's commitment.
      await db
        .update(followUps)
        .set({ status: "done", completedAt: new Date() })
        .where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id)));
      return { success: true };
    }),

  reopen: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(followUps)
        .set({ status: "open", completedAt: null })
        .where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id)));
      return { success: true };
    }),

  /** Push the due date out. Snoozing moves the date rather than adding a third status,
   *  so "what is due" stays a single comparison. */
  snooze: protectedProcedure
    .input(z.object({ id: z.number(), days: z.number().min(1).max(365) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const rows: FollowUp[] = await db
        .select()
        .from(followUps)
        .where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id)))
        .limit(1);
      if (!rows[0]) throw new Error("Follow-up not found");

      // Snooze from today, not from the original date. Snoozing an item that is three
      // weeks overdue by "7 days" should give a week, not a date still in the past.
      const next = snoozeTarget(input.days);

      await db.update(followUps).set({ dueDate: next }).where(eq(followUps.id, input.id));
      return { success: true, dueDate: next.toISOString() };
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(followUps)
        .where(and(eq(followUps.id, input.id), eq(followUps.userId, ctx.user.id)));
      return { success: true };
    }),
});
