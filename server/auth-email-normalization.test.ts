import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Email addresses are an identity, and this app treated them as a case-sensitive
 * string. Confirmed live: signing up with DEMO@AI-CRM.COM succeeded and created a
 * second account for an address that already had one (demo@ai-crm.com), because the
 * duplicate check compared the raw input. This also meant a user who typed a different
 * case at login than at signup would be told their password was wrong (it wasn't found
 * at all, since the lookup was equally case-sensitive).
 *
 * server/routers.ts now lowercases the email at signup (both for the dup check and for
 * what gets stored) and at every lookup (login, password reset). These tests exercise
 * signUp and login end to end through the real router against an isolated demo DB.
 */

const DB = path.join(process.cwd(), "demo-db.test-email-norm.json");
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

const anyCtx = () => ({ req: { headers: {}, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } }, res: { clearCookie() {}, cookie() {} }, user: null }) as any;

describe("signUp / login email normalization", () => {
  it("rejects a duplicate email that differs only in case", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(anyCtx());

    await caller.auth.signUp({ email: "person@example.com", password: "GoodPass123!", name: "A" });
    await expect(
      caller.auth.signUp({ email: "PERSON@EXAMPLE.COM", password: "GoodPass123!", name: "B" })
    ).rejects.toThrow(/already exists/i);
  });

  it("stores the email lowercased regardless of how it was typed", async () => {
    const { appRouter } = await import("./routers");
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    const caller = appRouter.createCaller(anyCtx());
    await caller.auth.signUp({ email: "Mixed.Case@Example.COM", password: "GoodPass123!", name: "A" });

    const db: any = await getDb();
    const [stored] = await db.select().from(users).where(eq(users.email, "mixed.case@example.com")).limit(1);
    expect(stored).toBeDefined();
    expect(stored.email).toBe("mixed.case@example.com");
  });

  it("logs in successfully with a different case than was used at signup", async () => {
    const { appRouter } = await import("./routers");
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");

    // Approve the account directly (signUp requires admin approval before login works)
    // rather than going through the admin flow — isolates this test to the thing it's
    // actually checking.
    const caller = appRouter.createCaller(anyCtx());
    await caller.auth.signUp({ email: "case.test@example.com", password: "GoodPass123!", name: "A" });

    const db: any = await getDb();
    await db.update(users).set({ isApproved: true }).where(eq(users.email, "case.test@example.com"));

    const result = await caller.auth.login({ email: "CASE.TEST@EXAMPLE.COM", password: "GoodPass123!" });
    expect(result.success).toBe(true);
  });
});
