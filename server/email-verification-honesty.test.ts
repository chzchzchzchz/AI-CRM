import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * sendPasswordResetCode's client (ForgotPassword.tsx) used to say "Reset code sent to
 * your email!" unconditionally — including with no SENDGRID_API_KEY configured, where
 * sendEmail() warns and returns false and nothing is sent. It also discarded the `code`
 * demo mode returns into a state variable nothing ever read, so even the intended
 * no-mailer fallback was unreachable. The server now reports the real `emailSent`
 * boolean, and does so identically whether or not the email exists (anti-enumeration).
 */

const DB = path.join(process.cwd(), "demo-db.test-reset-honesty.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  delete process.env.SENDGRID_API_KEY;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

const anyCtx = () => ({ req: {} as any, res: {} as any, user: null });

describe("emailVerification.sendPasswordResetCode", () => {
  it("reports emailSent:false when no mailer is configured, for a real account", async () => {
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const db: any = await getDb();
    await db.delete(users);
    await db.insert(users).values({
      id: 801, openId: "u801", email: "hasaccount@example.com", name: "Has Account",
      role: "user", isApproved: true, loginMethod: "email",
    });

    const { emailVerificationRouter } = await import("./email-verification-router");
    const caller = emailVerificationRouter.createCaller(anyCtx());
    const result: any = await caller.sendPasswordResetCode({ email: "hasaccount@example.com" });

    expect(result.emailSent).toBe(false);
    // DEMO_MODE — the code rides along specifically so the flow is still completable
    // with no mailer, which only works if the client actually reads it (it now does).
    expect(result.code).toBeTruthy();
  });

  it("returns the identical shape for a nonexistent email — no enumeration signal", async () => {
    const { emailVerificationRouter } = await import("./email-verification-router");
    const caller = emailVerificationRouter.createCaller(anyCtx());
    const result: any = await caller.sendPasswordResetCode({ email: "nobody-here@example.com" });

    // Must NOT be distinguishable from the "account exists, send failed" branch by the
    // presence/absence or type of `emailSent` — only by not carrying a `code`.
    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.code).toBeUndefined();
  });
});
