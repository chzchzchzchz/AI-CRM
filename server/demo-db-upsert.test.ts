import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A sparse upsert must not erase the row it lands on.
 *
 * The demo database is a JSON shim. Its insert path fills every column the caller
 * omitted with `null` before writing — correct for a genuinely new row, catastrophic
 * for an existing one, because on a duplicate it spread that padded record over the
 * match. And `onDuplicateKeyUpdate` discarded its update set entirely and returned
 * `this`, so there was nothing to correct it with.
 *
 * The upsert that runs on every authenticated request passes only
 * `{ openId, lastSignedIn }`. So the first request after signing in erased the seeded
 * demo user's email, password hash, role and approval. The credentials printed in the
 * README then failed, and the app went on looking fine because DEMO_MODE quietly
 * substitutes a fallback user for anyone it cannot authenticate.
 *
 * Sign in, look at the dashboard, sign out, try to sign back in — locked out of the
 * demo, on a clean clone, with nothing in the logs but "Invalid email or password".
 */

const DB = path.join(process.cwd(), "demo-db.test-upsert.json");
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

describe("demo database upsert", () => {
  it("keeps the fields a sparse upsert did not mention", async () => {
    const db = await import("./db");

    await db.upsertUser({
      openId: "demo-user-id",
      email: "demo@ai-crm.com",
      name: "Demo Admin",
      role: "admin",
    } as any);

    // Exactly what authenticateRequest does on every request with a valid session.
    await db.upsertUser({ openId: "demo-user-id", lastSignedIn: new Date() } as any);

    const user = await db.getUserByOpenId("demo-user-id");
    expect(user).toBeTruthy();
    // Each of these was null after the second call.
    expect(user!.email).toBe("demo@ai-crm.com");
    expect(user!.name).toBe("Demo Admin");
    expect(user!.role).toBe("admin");
  });

  it("still applies the fields it was given", async () => {
    const db = await import("./db");
    await db.upsertUser({ openId: "u1", email: "old@example.com", name: "Old" } as any);
    await db.upsertUser({ openId: "u1", email: "new@example.com" } as any);

    const user = await db.getUserByOpenId("u1");
    expect(user!.email).toBe("new@example.com"); // updated
    expect(user!.name).toBe("Old");              // untouched
  });

  it("does not renumber the row", async () => {
    // Other tables reference users by id; a merge that reassigned it would orphan them.
    const db = await import("./db");
    await db.upsertUser({ openId: "u2", email: "a@b.com" } as any);
    const before = await db.getUserByOpenId("u2");

    await db.upsertUser({ openId: "u2", lastSignedIn: new Date() } as any);
    const after = await db.getUserByOpenId("u2");

    expect(after!.id).toBe(before!.id);
  });

  it("creates the row when it is genuinely new", async () => {
    const db = await import("./db");
    await db.upsertUser({ openId: "brand-new", email: "n@e.com", name: "New" } as any);

    const user = await db.getUserByOpenId("brand-new");
    expect(user?.email).toBe("n@e.com");
  });
});
