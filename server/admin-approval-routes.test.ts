import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import type { Server } from "node:http";

/**
 * The one-click approve/deny email links used to mutate on GET — email security
 * gateways (Microsoft Safe Links, Proofpoint, Mimecast, and similar) routinely
 * prefetch every link in an inbound email to scan it, which fires that GET before a
 * human ever opens the message. That prefetch WAS the approval: a real access
 * decision made by a scanner, not the admin. GET now only renders a confirmation
 * page; the actual mutation happens on the POST triggered by an explicit click.
 */

const DB = path.join(process.cwd(), "demo-db.test-admin-approval-routes.json");
const ORIGINAL = { ...process.env };
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  const { registerAdminApprovalRoutes } = await import("./admin-approval-api");
  const app = express();
  app.use(express.urlencoded({ extended: true }));
  registerAdminApprovalRoutes(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  // No vi.resetModules() here: registerAdminApprovalRoutes (beforeAll) closes over
  // admin-approval-api's in-memory approvalTokens Map. Resetting modules per-test
  // would make generateApprovalToken write into a fresh, disconnected module
  // instance the already-registered routes never see.
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

async function seedPendingUser() {
  const { getDb } = await import("./db");
  const { users } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(users);
  await db.insert(users).values({
    id: 801, openId: "u801", email: "pending@example.com", name: "Pending Rep",
    loginMethod: "email", isApproved: false, role: "user",
  });
  return { users, db };
}

describe("admin approve/deny one-click links", () => {
  it("GET on an approve link shows a confirmation page and does NOT approve the user", async () => {
    const { users, db } = await seedPendingUser();
    const { generateApprovalToken } = await import("./admin-approval-api");
    const token = generateApprovalToken(801, "approve");

    const res = await fetch(`${baseUrl}/api/admin/approve/${token}`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toMatch(/Yes, approve/i);
    expect(html).toContain(`action="/api/admin/approve/${token}"`);

    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(users).where(eq(users.id, 801));
    expect(row.isApproved).toBe(false);
  });

  it("POST on the confirm page's form actually approves the user", async () => {
    const { users, db } = await seedPendingUser();
    const { generateApprovalToken } = await import("./admin-approval-api");
    const token = generateApprovalToken(801, "approve");

    const res = await fetch(`${baseUrl}/api/admin/approve/${token}`, { method: "POST" });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toMatch(/User Approved/i);

    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(users).where(eq(users.id, 801));
    expect(row.isApproved).toBe(true);
  });

  it("GET on a deny link shows a confirmation page and does NOT delete the user", async () => {
    const { users, db } = await seedPendingUser();
    const { generateApprovalToken } = await import("./admin-approval-api");
    const token = generateApprovalToken(801, "deny");

    const res = await fetch(`${baseUrl}/api/admin/deny/${token}`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toMatch(/Yes, deny/i);

    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(users).where(eq(users.id, 801));
    expect(rows.length).toBe(1);
  });

  it("POST on the deny confirm page actually removes the user", async () => {
    const { users, db } = await seedPendingUser();
    const { generateApprovalToken } = await import("./admin-approval-api");
    const token = generateApprovalToken(801, "deny");

    const res = await fetch(`${baseUrl}/api/admin/deny/${token}`, { method: "POST" });
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toMatch(/User Denied/i);

    const { eq } = await import("drizzle-orm");
    const rows = await db.select().from(users).where(eq(users.id, 801));
    expect(rows.length).toBe(0);
  });

  it("a token cannot be reused after the confirming POST", async () => {
    const { users } = await seedPendingUser();
    const { generateApprovalToken } = await import("./admin-approval-api");
    const token = generateApprovalToken(801, "approve");

    await fetch(`${baseUrl}/api/admin/approve/${token}`, { method: "POST" });
    const second = await fetch(`${baseUrl}/api/admin/approve/${token}`, { method: "POST" });
    const html = await second.text();

    expect(html).toMatch(/Already Approved|Invalid or Expired/i);
  });
});
