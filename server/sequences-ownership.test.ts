import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * `save`'s UPDATE branch checked ownership in a preceding SELECT but the UPDATE
 * itself only filtered by `id` — the same gap fixed in follow-ups.ts's `snooze`.
 * Not reachable today (the select already rejects a non-owned id), but the write
 * didn't defend itself the way delete() on the same router already does.
 */

const DB = path.join(process.cwd(), "demo-db.test-sequences-ownership.json");
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

async function seedOneSequenceOwnedByUserA() {
  const { getDb } = await import("./db");
  const { emailSequences } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(emailSequences);
  await db.insert(emailSequences).values({
    id: 1, createdBy: 101, name: "Original name",
    description: null, steps: "[]",
  });
  return { emailSequences, db };
}

describe("sequencesRouter — ownership is enforced on every write", () => {
  it("save rejects another user's sequence and leaves its name untouched", async () => {
    await seedOneSequenceOwnedByUserA();
    const { sequencesRouter } = await import("./sequences");
    const attacker = sequencesRouter.createCaller(ctxFor(999));

    await expect(
      attacker.save({ id: 1, name: "attacker-controlled name", steps: [] })
    ).rejects.toThrow(/not found/i);

    const { getDb } = await import("./db");
    const { emailSequences } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const [row] = await db.select().from(emailSequences).where(eq(emailSequences.id, 1));
    expect(row.name).toBe("Original name");
  });

  it("the owner can still save their own sequence", async () => {
    await seedOneSequenceOwnedByUserA();
    const { sequencesRouter } = await import("./sequences");
    const owner = sequencesRouter.createCaller(ctxFor(101));

    await owner.save({ id: 1, name: "Updated by owner", steps: [] });

    const { getDb } = await import("./db");
    const { emailSequences } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const [row] = await db.select().from(emailSequences).where(eq(emailSequences.id, 1));
    expect(row.name).toBe("Updated by owner");
  });
});
