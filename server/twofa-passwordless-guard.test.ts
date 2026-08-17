import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * disable() and regenerateBackupCodes() both confirm the request against the account's
 * password via bcrypt.compare — correct, since a signed-in session alone shouldn't be
 * enough to remove a second factor from an unlocked laptop. But bcrypt.compare(anything,
 * "" ) never returns true, so a passwordless account (the demo login, or an OAuth user
 * with no password set) that enrolled in 2FA had no way to ever disable it again.
 * Confirmed live: disable("anything") against a passwordHash-null user returned
 * "Invalid password" for every input, including the empty string.
 *
 * enable() now refuses enrolment up front for an account with no passwordHash, so this
 * self-lockout can't be created in the first place.
 */

const DB = path.join(process.cwd(), "demo-db.test-twofa-guard.json");
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

async function seedUser(passwordHash: string | null) {
  const { getDb } = await import("./db");
  const { users } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(users);
  await db.insert(users).values({
    id: 501,
    openId: "test-2fa-guard",
    email: "twofa-guard@example.com",
    name: "Test",
    passwordHash,
    loginMethod: passwordHash ? "email" : "demo",
    isApproved: true,
    role: "user",
  });
  return { id: 501, email: "twofa-guard@example.com", role: "user" as const };
}

describe("twoFA.enable — passwordless accounts", () => {
  it("refuses enrolment for a user with no passwordHash, before checking the code", async () => {
    const user = await seedUser(null);
    const { twoFARouter } = await import("./twofa-router");
    const caller = twoFARouter.createCaller({ user, req: {} as any, res: {} as any });

    // The guard must fire before TOTP verification runs, so a garbage secret/code here
    // still proves the guard — if it didn't, this would fail on "code didn't match"
    // instead of the passwordless message.
    await expect(
      caller.enable({ secret: "AAAAAAAAAAAAAAAA", verificationCode: "000000" })
    ).rejects.toThrow(/set a password first/i);
  });

  it("still validates the TOTP code normally for a user who has a password", async () => {
    const user = await seedUser("$2a$10$abcdefghijklmnopqrstuv");
    const { twoFARouter } = await import("./twofa-router");
    const caller = twoFARouter.createCaller({ user, req: {} as any, res: {} as any });

    // A password-holding account should reach the real TOTP check and fail THERE, not
    // on the passwordless guard — proves the guard doesn't over-fire on accounts that
    // are fine to enroll.
    await expect(
      caller.enable({ secret: "AAAAAAAAAAAAAAAA", verificationCode: "000000" })
    ).rejects.toThrow(/code didn't match/i);
  });
});
