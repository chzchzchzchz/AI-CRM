import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * verifyEmail's attempt counter is a read-modify-write with no compare-and-swap: read
 * `attempts`, check it against the cap, and on a wrong guess write back `attempts + 1`.
 * Fired sequentially that's fine, but N concurrent guesses can all read the SAME starting
 * value and each write back `that value + 1` — the cap is meant to stop a brute-force
 * attempt at a six-digit code (1,000,000 possibilities), and firing guesses in parallel
 * instead of one at a time is exactly how an attacker would try to get more than 3 real
 * guesses in before it engages. withUserLock (see server/twofa.ts, the same fix already
 * applied to the 2FA backup-code race) closes it by queuing every verification attempt
 * for a user behind the one before it.
 */

const DB = path.join(process.cwd(), "demo-db.test-email-verify-race.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

const anyCtx = () => ({ req: {} as any, res: {} as any, user: null });

async function seed() {
  const { getDb } = await import("./db");
  const { users, emailVerificationCodes } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(users);
  await db.delete(emailVerificationCodes);
  await db.insert(users).values({
    id: 901, openId: "u901", email: "racer@example.com", name: "Racer",
    role: "user", isApproved: false, loginMethod: "email",
  });
  await db.insert(emailVerificationCodes).values({
    userId: 901, email: "racer@example.com", code: "482913",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), attempts: 0, verified: false,
  });
}

describe("emailVerification.verifyEmail concurrent guesses", () => {
  it("still caps at 3 attempts when 3 wrong guesses arrive at once", async () => {
    await seed();
    const { emailVerificationRouter } = await import("./email-verification-router");

    // Three concurrent wrong guesses. Sequentially these would drive attempts to 3 and
    // the cap would engage; the question is whether firing them at once still does.
    const results = await Promise.allSettled([
      emailVerificationRouter.createCaller(anyCtx()).verifyEmail({ userId: 901, code: "000001" }),
      emailVerificationRouter.createCaller(anyCtx()).verifyEmail({ userId: 901, code: "000002" }),
      emailVerificationRouter.createCaller(anyCtx()).verifyEmail({ userId: 901, code: "000003" }),
    ]);
    expect(results.every((r) => r.status === "rejected")).toBe(true);

    // A 4th attempt, this time with the CORRECT code. If the three concurrent guesses
    // above only actually counted as one (the lost-update race), attempts would still
    // read 1 here and this would succeed — the cap would have protected nothing.
    const caller = emailVerificationRouter.createCaller(anyCtx());
    await expect(
      caller.verifyEmail({ userId: 901, code: "482913" })
    ).rejects.toThrow(/too many attempts/i);
  });

  it("accepts the correct code on the first attempt with no contention", async () => {
    await seed();
    const { emailVerificationRouter } = await import("./email-verification-router");
    const caller = emailVerificationRouter.createCaller(anyCtx());
    const result: any = await caller.verifyEmail({ userId: 901, code: "482913" });
    expect(result.success).toBe(true);
  });
});
