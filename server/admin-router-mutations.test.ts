import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Four admin mutations ran a bare UPDATE/DELETE with no check on how many rows it
 * actually touched, so approving, denying, or re-roling a user id that doesn't exist —
 * and denying an access request that doesn't exist — all returned {success:true}.
 * Confirmed live against ids 999999999 and -1. affectedRows() (server/admin-router.ts)
 * now normalizes the real driver's tuple result and the demo shim's plain-object result
 * to the same check.
 *
 * Also covers: a denial reason typed into the dialog and submitted now actually
 * persists (it previously validated, submitted, and was silently discarded — there was
 * no column for it), and approveAccessRequest's temp password now has somewhere to go.
 */

const DB = path.join(process.cwd(), "demo-db.test-admin-mutations.json");
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

const adminCtx = () => ({
  user: { id: 1, role: "admin" as const, email: "admin@example.com" },
  req: {} as any,
  res: {} as any,
});

async function freshDbWithOneUser() {
  const { getDb } = await import("./db");
  const { users, accessRequests } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(users);
  await db.delete(accessRequests);
  await db.insert(users).values({
    id: 601, openId: "u601", email: "real@example.com", name: "Real User",
    role: "user", isApproved: false, loginMethod: "email",
  });
  await db.insert(accessRequests).values({
    id: 701, email: "applicant@example.com", name: "Applicant", status: "pending",
  });
  return { users, accessRequests, db };
}

describe("admin mutations reject a nonexistent id", () => {
  it("approveUser throws instead of reporting success", async () => {
    await freshDbWithOneUser();
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());
    await expect(caller.approveUser({ userId: 999999999 })).rejects.toThrow(/not found/i);
  });

  it("denyUser throws instead of reporting success", async () => {
    await freshDbWithOneUser();
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());
    await expect(caller.denyUser({ userId: -1 })).rejects.toThrow(/not found/i);
  });

  it("updateUserRole throws instead of reporting success", async () => {
    await freshDbWithOneUser();
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());
    await expect(caller.updateUserRole({ userId: 999999999, role: "admin" })).rejects.toThrow(/not found/i);
  });

  it("denyAccessRequest throws instead of reporting success", async () => {
    await freshDbWithOneUser();
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());
    await expect(caller.denyAccessRequest({ requestId: 999999999 })).rejects.toThrow(/not found/i);
  });

  it("still succeeds for a real id", async () => {
    await freshDbWithOneUser();
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());
    const result = await caller.approveUser({ userId: 601 });
    expect(result.success).toBe(true);
  });
});

describe("denyAccessRequest persists the reason", () => {
  it("stores the reason the admin typed instead of discarding it", async () => {
    const { accessRequests } = await freshDbWithOneUser();
    const { getDb } = await import("./db");
    const { eq } = await import("drizzle-orm");
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());

    await caller.denyAccessRequest({ requestId: 701, reason: "Not a company email" });

    const db: any = await getDb();
    const [row] = await db.select().from(accessRequests).where(eq(accessRequests.id, 701)).limit(1);
    expect(row.denialReason).toBe("Not a company email");
    expect(row.status).toBe("denied");
  });
});

describe("approveAccessRequest — credential delivery", () => {
  it("reports emailSent so the client knows whether the password reached anyone", async () => {
    await freshDbWithOneUser();
    const { adminRouter } = await import("./admin-router");
    const caller = adminRouter.createCaller(adminCtx());

    const result = await caller.approveAccessRequest({ requestId: 701 });
    // No SENDGRID_API_KEY in the test env, so sendEmail() returns false — emailSent
    // must reflect that rather than being silently absent (the old response shape).
    expect(result.emailSent).toBe(false);
    expect(result.tempPassword).toBeTruthy();
    expect(result.email).toBe("applicant@example.com");
  });
});
