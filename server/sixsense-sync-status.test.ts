import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext } from "./test-utils";

/**
 * `sixsense.getSyncStatus` reported `{ total: 1, synced: 1, unsynced: 0 }` regardless of
 * how many accounts existed or how many had actually synced — the Admin and 6sense Sync
 * pages read that as "100% synced" even with zero accounts ever touched and no API key
 * configured. Two independent bugs, both exercised here end to end through the real
 * router and the real demo-mode data store (not a mocked db layer), because the bug was
 * in how they interact:
 *
 *  1. `{ count: accounts.id }` is a plain column reference, not a SQL count aggregate,
 *     but the demo-mode shim's aggregate detection matched on the literal key name
 *     "count" — so the whole result collapsed into a single-row `[{ count: N }]` array
 *     and `.length` on it was always 1.
 *  2. `eq(col, col)` (a self-compare, meant to ask "has a value") isn't evaluable by the
 *     shim and used to default to a filter that matched nothing.
 */

const DB = path.join(process.cwd(), "demo-db.test-sixsense-sync.json");
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

describe("sixsense.getSyncStatus", () => {
  it("reports the real total and a real zero when nothing has synced", async () => {
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const db: any = await getDb();
    // A fresh DEMO_DB_PATH seeds from demo-db.seed.json on first read (1,000 real
    // accounts) — clear it so the counts below are exactly what this test inserts.
    await db.delete(accounts);
    for (let i = 0; i < 7; i++) {
      await db.insert(accounts).values({ id: 9300 + i, name: `Account ${i}` });
    }

    const { sixsenseRouter } = await import("./sixsense-router");
    const caller = sixsenseRouter.createCaller(mockAuthContext);
    const status = await caller.getSyncStatus();

    expect(status.total).toBe(7);
    expect(status.synced).toBe(0);
    expect(status.unsynced).toBe(7);
  });

  it("counts synced accounts by whether they actually have a sync timestamp", async () => {
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const db: any = await getDb();
    await db.delete(accounts);
    await db.insert(accounts).values({ id: 9401, name: "Synced A", lastSixsenseSync: new Date().toISOString() });
    await db.insert(accounts).values({ id: 9402, name: "Synced B", lastSixsenseSync: new Date().toISOString() });
    await db.insert(accounts).values({ id: 9403, name: "Never synced" });

    const { sixsenseRouter } = await import("./sixsense-router");
    const caller = sixsenseRouter.createCaller(mockAuthContext);
    const status = await caller.getSyncStatus();

    expect(status.total).toBe(3);
    expect(status.synced).toBe(2);
    expect(status.unsynced).toBe(1);
  });
});
