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
 *
 * sendVerificationCode and resendVerificationCode had the identical bug and were never
 * fixed alongside it: both called sendVerificationEmail(...).catch(() => false) and threw
 * the result away, always answering `{ success: true }`. A real deployment with no
 * SENDGRID_API_KEY (or a dead one) told every new signup "We sent a 6-digit code to
 * you@company.com" — SignUp.tsx has no branch for a failed send, only a thrown error,
 * which this path never produces — and the account sat on the verify screen forever with
 * a code that was never mailed and a resend button that reported the same false success.
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

describe("emailVerification.sendVerificationCode", () => {
  it("reports emailSent:false when no mailer is configured", async () => {
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const db: any = await getDb();
    await db.delete(users);
    await db.insert(users).values({
      id: 802, openId: "u802", email: "newsignup@example.com", name: "New Signup",
      role: "user", isApproved: false, loginMethod: "email",
    });

    const { emailVerificationRouter } = await import("./email-verification-router");
    const caller = emailVerificationRouter.createCaller(anyCtx());
    const result: any = await caller.sendVerificationCode({ userId: 802, email: "newsignup@example.com" });

    // Demo mode still hands back the code so the flow is completable with no mailer —
    // but it must not claim the email itself went anywhere.
    expect(result.emailSent).toBe(false);
    expect(result.code).toBeTruthy();
  });
});

describe("emailVerification.resendVerificationCode", () => {
  it("reports emailSent:false when no mailer is configured", async () => {
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const db: any = await getDb();
    await db.delete(users);
    await db.insert(users).values({
      id: 803, openId: "u803", email: "resend@example.com", name: "Resend Case",
      role: "user", isApproved: false, loginMethod: "email",
    });

    const { emailVerificationRouter } = await import("./email-verification-router");
    const caller = emailVerificationRouter.createCaller(anyCtx());
    const result: any = await caller.resendVerificationCode({ userId: 803, email: "resend@example.com" });

    expect(result.emailSent).toBe(false);
    expect(result.code).toBeTruthy();
  });
});
