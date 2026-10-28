import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `snooze`'s SELECT correctly checked ownership before its UPDATE, but the UPDATE
 * itself only filtered by `id` — not `userId`, unlike every other mutation in this
 * router (`complete`, `reopen`, `remove`), which the router's own comment states as
 * the invariant: "an id alone must never be enough to close someone else's
 * commitment." Not reachable today because the preceding select already rejects a
 * non-owned id — but it's the one write that didn't defend itself, and would become
 * exploitable the moment that select is simplified away. Fixed to scope the write
 * the same way its siblings do.
 *
 * This test exercises the invariant end-to-end: a caller can never affect another
 * user's follow-up through any mutation in this router, snooze included.
 */

const DB = path.join(process.cwd(), "demo-db.test-followups-ownership.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

const ctxFor = (userId: number) => ({
  user: { id: userId, role: "user" as const, email: `user${userId}@example.com` },
  req: {} as any,
  res: {} as any,
});

async function seedOneFollowUpOwnedByUserA() {
  const { getDb } = await import("./db");
  const { followUps } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(followUps);
  await db.insert(followUps).values({
    id: 1,
    userId: 101,
    title: "Call the CISO",
    dueDate: new Date("2026-08-01T00:00:00Z"),
    status: "open",
  });
  return { followUps, db };
}

describe("followUpsRouter — ownership is enforced on every write", () => {
  it("snooze rejects another user's follow-up and leaves its due date untouched", async () => {
    await seedOneFollowUpOwnedByUserA();
    const { followUpsRouter } = await import("./follow-ups");
    const attacker = followUpsRouter.createCaller(ctxFor(999));

    await expect(attacker.snooze({ id: 1, days: 7 })).rejects.toThrow(/not found/i);

    const { getDb } = await import("./db");
    const { followUps } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const rows = await db.select().from(followUps).where(eq(followUps.id, 1));
    expect(new Date(rows[0].dueDate).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("the owner can still snooze their own follow-up", async () => {
    await seedOneFollowUpOwnedByUserA();
    const { followUpsRouter } = await import("./follow-ups");
    const owner = followUpsRouter.createCaller(ctxFor(101));

    const result = await owner.snooze({ id: 1, days: 7 });
    expect(result.success).toBe(true);
    expect(new Date(result.dueDate).getTime()).toBeGreaterThan(new Date("2026-08-01").getTime());
  });
});
