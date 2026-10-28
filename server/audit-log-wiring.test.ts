import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * server/_core/audit.ts's logUserSignup/logUserLogin/etc. write to the persisted,
 * queryable auditLogs table — but nothing in the real app ever called any of them.
 * logSecurityEvent (server/_core/security.ts), which IS called throughout the auth
 * flows, only writes to console — ephemeral, gone on restart, not queryable, no admin
 * UI reads it either way. Found via a file-by-file audit; only a test exercised the
 * audit.ts functions, in isolation, giving false confidence that "audit logging
 * works" while it was fully disconnected from every real request path. Wired into
 * auth.signUp, auth.login (both paths), auth.logout, admin.approveAccessRequest,
 * admin.denyAccessRequest, twoFA.enable, twoFA.disable, emailVerification.verifyEmail,
 * and emailVerification.resetPassword.
 */

const DB = path.join(process.cwd(), "demo-db.test-audit-wiring.json");
const ORIGINAL = { ...process.env };

const reqCtx = () => ({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }) as any;

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

async function auditRows() {
  const { getDb } = await import("./db");
  const { auditLogs } = await import("../drizzle/schema");
  const db: any = await getDb();
  return db.select().from(auditLogs);
}

describe("audit logging is actually wired into real request paths", () => {
  it("signUp persists a USER_SIGNUP row", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({ user: null, req: reqCtx(), res: {} as any });

    await caller.auth.signUp({
      email: "new-rep@example.com",
      password: "Correct-Horse-Battery-9",
      name: "New Rep",
    });

    const rows = await auditRows();
    const signup = rows.find((r: any) => r.eventType === "USER_SIGNUP");
    expect(signup).toBeTruthy();
    expect(signup.description).toMatch(/new-rep@example\.com/);
  });

  it("login persists a USER_LOGIN row", async () => {
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const bcrypt = (await import("bcryptjs")).default;
    const db: any = await getDb();
    await db.insert(users).values({
      id: 501, openId: "u501", email: "logmein@example.com", name: "Log Me In",
      passwordHash: await bcrypt.hash("Correct-Horse-Battery-9", 10),
      loginMethod: "email", isApproved: true, role: "user",
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: null, req: reqCtx(),
      res: { clearCookie() {}, cookie() {} } as any,
    });

    await caller.auth.login({ email: "logmein@example.com", password: "Correct-Horse-Battery-9" });

    const rows = await auditRows();
    const login = rows.find((r: any) => r.eventType === "USER_LOGIN");
    expect(login).toBeTruthy();
    expect(login.userId).toBe(501);
  });

  it("logout persists a USER_LOGOUT row for a signed-in caller", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller({
      user: { id: 502, email: "outbound@example.com", role: "user" } as any,
      req: reqCtx(),
      res: { clearCookie() {} } as any,
    });

    await caller.auth.logout();

    const rows = await auditRows();
    expect(rows.find((r: any) => r.eventType === "USER_LOGOUT" && r.userId === 502)).toBeTruthy();
  });
});
