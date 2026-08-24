import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * This file used to be five tests that asserted against hand-built literals —
 * `expect(mockUserData.isApproved).toBe(false)` where `mockUserData` was a plain object
 * the test itself defined with `isApproved: false` two lines above. Nothing here ever
 * imported routers.ts, called signUp or login, or touched a database. Every test passed
 * on every run regardless of what the real admin-approval code did, including the one
 * case that actually matters: whether `auth.login` truly refuses an unapproved account.
 * It had never been checked against the real procedure. These tests now call the real
 * signUp / login / verifyEmail procedures through appRouter against an isolated demo DB,
 * the same way auth-email-normalization.test.ts does.
 */

const DB = path.join(process.cwd(), "demo-db.test-approval-flow.json");
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

const fakeCtx = () => {
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const ctx = {
    req: { headers: {}, ip: "127.0.0.1", socket: { remoteAddress: "127.0.0.1" } },
    res: { cookie, clearCookie },
    user: null,
  } as any;
  return { ctx, cookie };
};

describe("Admin Approval Flow", () => {
  describe("User Registration", () => {
    it("creates new users with isApproved = false", async () => {
      const { appRouter } = await import("./routers");
      const { getDb } = await import("./db");
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const { ctx } = fakeCtx();
      const caller = appRouter.createCaller(ctx);
      await caller.auth.signUp({ email: "newbie@example.com", password: "GoodPass123!", name: "New Bie" });

      const db: any = await getDb();
      const [stored] = await db.select().from(users).where(eq(users.email, "newbie@example.com")).limit(1);
      expect(stored).toBeDefined();
      expect(stored.isApproved).toBe(false);
    });
  });

  describe("Login Blocking", () => {
    it("blocks unapproved users from logging in, and issues no session cookie", async () => {
      const { appRouter } = await import("./routers");

      const { ctx: signUpCtx } = fakeCtx();
      await appRouter.createCaller(signUpCtx).auth.signUp({
        email: "waiting@example.com",
        password: "GoodPass123!",
        name: "Waiting Room",
      });

      const { ctx: loginCtx, cookie } = fakeCtx();
      await expect(
        appRouter.createCaller(loginCtx).auth.login({ email: "waiting@example.com", password: "GoodPass123!" })
      ).rejects.toThrow(/pending approval/i);
      // The check that matters isn't just the thrown error — it's that no path to a
      // session was reached. A future refactor could throw AFTER minting a cookie and
      // this rejection would still pass.
      expect(cookie).not.toHaveBeenCalled();
    });

    it("allows approved users to log in", async () => {
      const { appRouter } = await import("./routers");
      const { getDb } = await import("./db");
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const { ctx: signUpCtx } = fakeCtx();
      await appRouter.createCaller(signUpCtx).auth.signUp({
        email: "approved@example.com",
        password: "GoodPass123!",
        name: "Approved Already",
      });

      const db: any = await getDb();
      await db.update(users).set({ isApproved: true }).where(eq(users.email, "approved@example.com"));

      const { ctx: loginCtx, cookie } = fakeCtx();
      const result: any = await appRouter
        .createCaller(loginCtx)
        .auth.login({ email: "approved@example.com", password: "GoodPass123!" });

      expect(result.success).toBe(true);
      expect(cookie).toHaveBeenCalledTimes(1);
    });
  });

  describe("Email Verification", () => {
    it("does NOT auto-approve users after email verification", async () => {
      const { appRouter } = await import("./routers");
      const { getDb } = await import("./db");
      const { users } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");

      const { ctx } = fakeCtx();
      const caller = appRouter.createCaller(ctx);
      const signUp = await caller.auth.signUp({
        email: "verifier@example.com",
        password: "GoodPass123!",
        name: "Verifier",
      });

      // Demo mode hands the code back directly instead of mailing it.
      const sent: any = await caller.emailVerification.sendVerificationCode({
        userId: signUp.userId,
        email: "verifier@example.com",
      });
      expect(sent.code).toBeTruthy();

      const verified: any = await caller.emailVerification.verifyEmail({
        userId: signUp.userId,
        code: sent.code,
      });
      expect(verified.success).toBe(true);
      expect(verified.message).toContain("pending admin approval");

      const db: any = await getDb();
      const [stored] = await db.select().from(users).where(eq(users.email, "verifier@example.com")).limit(1);
      expect(stored.isApproved).toBe(false);

      // And login still refuses the now-verified-but-not-approved account.
      const { ctx: loginCtx } = fakeCtx();
      await expect(
        appRouter.createCaller(loginCtx).auth.login({ email: "verifier@example.com", password: "GoodPass123!" })
      ).rejects.toThrow(/pending approval/i);
    });
  });
});
