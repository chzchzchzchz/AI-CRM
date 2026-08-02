import { describe, expect, it, beforeEach, vi } from "vitest";
// @ts-ignore - speakeasy ships no type definitions
import speakeasy from "speakeasy";
import bcrypt from "bcryptjs";
import { COOKIE_NAME } from "../shared/const";
import {
  generateBackupCodes,
  hashBackupCodes,
  __resetChallenges,
} from "./twofa";

/**
 * The login gate itself.
 *
 * `twoFactorEnabled` existed in the schema for a long time, was written by a settings
 * page, and was read by nothing. A user could turn 2FA on, be told it was on, and still
 * be signed in by password alone — the feature was a checkbox.
 *
 * These tests are about one question: does a correct password, on its own, get you a
 * session? For a 2FA account it must not.
 */

const sp = speakeasy as any;
const totp = (opts: any) => sp.totp(opts);

const SECRET = sp.generateSecret({ length: 32 }).base32;
const PASSWORD = "CorrectHorse1!";
let PASSWORD_HASH = "";
let BACKUP_CODES: string[] = [];
let BACKUP_HASHES = "";

/** One in-memory user row, reset between tests. */
let userRow: any;

/** Every db.update(...).set(x) is recorded so we can assert on what was persisted. */
const updates: any[] = [];

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (userRow ? [userRow] : []) }),
      }),
    }),
    update: () => ({
      set: (values: any) => {
        updates.push(values);
        Object.assign(userRow, values);
        return { where: async () => undefined };
      },
    }),
    insert: () => ({ values: async () => undefined }),
  }),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { createSessionToken: async () => "a-session-token" },
}));

const { appRouter } = await import("./routers");

function ctx() {
  const cookies: { name: string; value: string }[] = [];
  return {
    cookies,
    ctx: {
      user: null,
      req: { protocol: "https", headers: {}, ip: "10.0.0.1", socket: { remoteAddress: "10.0.0.1" } },
      res: { cookie: (name: string, value: string) => cookies.push({ name, value }) },
    } as any,
  };
}

beforeEach(async () => {
  __resetChallenges();
  updates.length = 0;
  if (!PASSWORD_HASH) {
    PASSWORD_HASH = await bcrypt.hash(PASSWORD, 10);
    BACKUP_CODES = generateBackupCodes();
    BACKUP_HASHES = await hashBackupCodes(BACKUP_CODES);
  }
  userRow = {
    id: 99,
    openId: "user-99",
    email: "rep@example.com",
    name: "Rep",
    role: "user",
    passwordHash: PASSWORD_HASH,
    isApproved: true,
    twoFactorEnabled: true,
    twoFactorSecret: SECRET,
    twoFactorBackupCodes: BACKUP_HASHES,
  };
});

describe("login with 2FA enabled", () => {
  it("does NOT issue a session for a correct password alone", async () => {
    const { ctx: c, cookies } = ctx();
    const res: any = await appRouter.createCaller(c).auth.login({
      email: "rep@example.com",
      password: PASSWORD,
    });

    expect(res.twoFactorRequired).toBe(true);
    expect(res.success).toBe(false);
    expect(typeof res.challengeId).toBe("string");
    // The actual regression this guards: a session cookie here means the second
    // factor was decorative.
    expect(cookies.find((k) => k.name === COOKIE_NAME)).toBeUndefined();
  });

  it("issues a session once a valid TOTP code is presented", async () => {
    const caller = appRouter.createCaller(ctx().ctx);
    const start: any = await caller.auth.login({ email: "rep@example.com", password: PASSWORD });

    const { ctx: c2, cookies } = ctx();
    const done: any = await appRouter.createCaller(c2).auth.loginVerify({
      challengeId: start.challengeId,
      code: totp({ secret: SECRET, encoding: "base32" }),
    });

    expect(done.success).toBe(true);
    expect(cookies.find((k) => k.name === COOKIE_NAME)?.value).toBe("a-session-token");
  });

  it("rejects a wrong code and issues nothing", async () => {
    const caller = appRouter.createCaller(ctx().ctx);
    const start: any = await caller.auth.login({ email: "rep@example.com", password: PASSWORD });

    const { ctx: c2, cookies } = ctx();
    await expect(
      appRouter.createCaller(c2).auth.loginVerify({ challengeId: start.challengeId, code: "000000" })
    ).rejects.toThrow(/not valid/i);
    expect(cookies).toHaveLength(0);
  });

  it("refuses a challenge id that was never issued", async () => {
    const { ctx: c } = ctx();
    await expect(
      appRouter.createCaller(c).auth.loginVerify({
        challengeId: "not-a-real-challenge-id-000",
        code: totp({ secret: SECRET, encoding: "base32" }),
      })
    ).rejects.toThrow(/expired/i);
  });

  it("stops accepting guesses after five wrong codes", async () => {
    const caller = appRouter.createCaller(ctx().ctx);
    const start: any = await caller.auth.login({ email: "rep@example.com", password: PASSWORD });
    const c2 = appRouter.createCaller(ctx().ctx);

    for (let i = 0; i < 5; i++) {
      await expect(
        c2.auth.loginVerify({ challengeId: start.challengeId, code: "000000" })
      ).rejects.toThrow();
    }
    // Six digits with unlimited attempts is not a second factor.
    await expect(
      c2.auth.loginVerify({
        challengeId: start.challengeId,
        code: totp({ secret: SECRET, encoding: "base32" }),
      })
    ).rejects.toThrow(/too many|expired/i);
  });

  it("accepts a recovery code, and spends it", async () => {
    const caller = appRouter.createCaller(ctx().ctx);
    const start: any = await caller.auth.login({ email: "rep@example.com", password: PASSWORD });

    const { ctx: c2, cookies } = ctx();
    const done: any = await appRouter.createCaller(c2).auth.loginVerify({
      challengeId: start.challengeId,
      code: BACKUP_CODES[0],
      isBackupCode: true,
    });

    expect(done.success).toBe(true);
    expect(cookies.find((k) => k.name === COOKIE_NAME)).toBeDefined();
    // It must be written back before the session is handed out, or it is reusable.
    const wrote = updates.find((u) => "twoFactorBackupCodes" in u);
    expect(wrote).toBeDefined();
    expect(JSON.parse(wrote.twoFactorBackupCodes)).toHaveLength(BACKUP_CODES.length - 1);
  });

  it("will not accept the same recovery code twice", async () => {
    const first: any = await appRouter
      .createCaller(ctx().ctx)
      .auth.login({ email: "rep@example.com", password: PASSWORD });
    await appRouter.createCaller(ctx().ctx).auth.loginVerify({
      challengeId: first.challengeId,
      code: BACKUP_CODES[1],
      isBackupCode: true,
    });

    const second: any = await appRouter
      .createCaller(ctx().ctx)
      .auth.login({ email: "rep@example.com", password: PASSWORD });
    await expect(
      appRouter.createCaller(ctx().ctx).auth.loginVerify({
        challengeId: second.challengeId,
        code: BACKUP_CODES[1],
        isBackupCode: true,
      })
    ).rejects.toThrow(/not valid/i);
  });

  it("still rejects a wrong password before any of this", async () => {
    const { ctx: c, cookies } = ctx();
    await expect(
      appRouter.createCaller(c).auth.login({ email: "rep@example.com", password: "wrong-password" })
    ).rejects.toThrow(/invalid email or password/i);
    expect(cookies).toHaveLength(0);
  });
});

describe("login without 2FA", () => {
  beforeEach(() => {
    userRow.twoFactorEnabled = false;
    userRow.twoFactorSecret = null;
  });

  it("signs in on the password alone, as before", async () => {
    const { ctx: c, cookies } = ctx();
    const res: any = await appRouter
      .createCaller(c)
      .auth.login({ email: "rep@example.com", password: PASSWORD });

    expect(res.success).toBe(true);
    expect(res.twoFactorRequired).toBe(false);
    expect(cookies.find((k) => k.name === COOKIE_NAME)).toBeDefined();
  });
});
