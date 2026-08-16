import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The demo-mode query shim mis-parsed two condition shapes it had never been asked to
 * evaluate correctly, and both fed a real, verified bug:
 *
 * 1. `isNotNull(col)` / `sql\`col IS NOT NULL\`` — no literal value is being compared,
 *    just a column and a text fragment. The shim's fallback for "no value found" was to
 *    push a filter of `{ value: null }`, which reads as "field equals the literal string
 *    'null'" once it hits `String(item[field]) === String(filter.value)`. That is why
 *    `server/db.ts getSyncStatus()`'s `linkedContacts` (a real `sql\`accountId IS NOT
 *    NULL\`` filter) returned 0 against 10,023 linked contacts: it excluded every row
 *    instead of keeping every row with a value.
 *
 * 2. `eq(col, col)` — a column compared to itself (a copy-paste bug in
 *    server/sixsense-router.ts, since fixed to isNotNull there too). The shim grabbed
 *    the first column and defaulted to the same wrong `value: null` filter, so a query
 *    meant to mean "has synced" instead matched every row that had NOT synced.
 *
 * These tests exercise the shim directly, independent of which router happens to call
 * it, so a future condition shape that hits the same fallback is caught here first.
 */

const DB = path.join(process.cwd(), "demo-db.test-conditions.json");
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

describe("demo database WHERE-clause fallbacks", () => {
  it("isNotNull(col) keeps rows with a value and drops rows without one", async () => {
    const { getDb } = await import("./db");
    const { contacts } = await import("../drizzle/schema");
    const { isNotNull, sql } = await import("drizzle-orm");
    const db: any = await getDb();
    // A fresh DEMO_DB_PATH seeds from demo-db.seed.json on first read (10,023 real
    // contacts, almost all linked) — clear it so only the two rows below can match.
    await db.delete(contacts);

    await db.insert(contacts).values({ id: 9001, name: "Linked", accountId: 42 });
    await db.insert(contacts).values({ id: 9002, name: "Unlinked", accountId: null });

    const viaIsNotNull = await db.select().from(contacts).where(isNotNull(contacts.accountId));
    expect(viaIsNotNull.map((c: any) => c.id).sort()).toEqual([9001]);

    // The exact tagged-template form server/db.ts getSyncStatus() uses.
    const viaSqlTemplate = await db.select().from(contacts).where(sql`${contacts.accountId} IS NOT NULL`);
    expect(viaSqlTemplate.map((c: any) => c.id).sort()).toEqual([9001]);
  });

  it("a real SQL count(*) aggregate reflects an isNotNull filter correctly", async () => {
    // This is server/db.ts getSyncStatus()'s linkedContacts computation, reproduced
    // directly. Before the fix this returned 0 regardless of how many rows matched.
    // A fresh DEMO_DB_PATH seeds from demo-db.seed.json on first read (10,023 real
    // contacts), so start from an empty table — a delete() with no where() clears
    // every row in the shim, same as `DELETE FROM contacts` with no WHERE.
    const { getDb } = await import("./db");
    const { contacts } = await import("../drizzle/schema");
    const { sql } = await import("drizzle-orm");
    const db: any = await getDb();
    await db.delete(contacts);

    await db.insert(contacts).values({ id: 9101, name: "A", accountId: 1 });
    await db.insert(contacts).values({ id: 9102, name: "B", accountId: 2 });
    await db.insert(contacts).values({ id: 9103, name: "C", accountId: null });

    const [linked] = await db
      .select({ count: sql<number>`count(*)` })
      .from(contacts)
      .where(sql`${contacts.accountId} IS NOT NULL`);
    expect(linked.count).toBe(2);
  });

  it("eq(col, col) — a self-compare the mock cannot evaluate — excludes no rows rather than all of them", async () => {
    // The failure direction matters here: silently matching every row is a wrong count
    // a person can notice by comparing to the total; silently matching zero rows (the
    // old behavior) looks exactly like "nothing has ever synced" even when everything has.
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();

    await db.insert(accounts).values({ id: 9201, name: "Synced", lastSixsenseSync: new Date().toISOString() });

    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.lastSixsenseSync, accounts.lastSixsenseSync as any));
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});
