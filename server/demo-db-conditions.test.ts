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

  it("gt/lt/gte/lte are evaluated as comparisons, not silently as equality", async () => {
    // parseCondition extracted {field, value} from ANY simple binary condition with
    // one column and one scalar param — eq, gt, lt, gte, and lte all produce exactly
    // that shape, and only the operator TEXT between them (" = ", " > ", " < ", " >=
    // ", " <= ") distinguishes them. That text was discarded, so execute() always
    // compared with plain string equality regardless of which one was actually
    // written. Confirmed live: server/db-dust.ts's gt(expiresAt, now) cache-validity
    // check could never match a row its own write path had just inserted, and
    // clearExpiredDustCache's lt(expiresAt, now) never matched an expired row either.
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const { gt, lt, gte, lte } = await import("drizzle-orm");
    const db: any = await getDb();
    await db.delete(accounts);
    await db.insert(accounts).values({ id: 9301, name: "Cold", intentScore: 20 });
    await db.insert(accounts).values({ id: 9302, name: "Warm", intentScore: 70 });
    await db.insert(accounts).values({ id: 9303, name: "Hot", intentScore: 95 });

    const gtRows = await db.select().from(accounts).where(gt(accounts.intentScore, 70));
    expect(gtRows.map((r: any) => r.id).sort()).toEqual([9303]);

    const ltRows = await db.select().from(accounts).where(lt(accounts.intentScore, 70));
    expect(ltRows.map((r: any) => r.id).sort()).toEqual([9301]);

    const gteRows = await db.select().from(accounts).where(gte(accounts.intentScore, 70));
    expect(gteRows.map((r: any) => r.id).sort()).toEqual([9302, 9303]);

    const lteRows = await db.select().from(accounts).where(lte(accounts.intentScore, 70));
    expect(lteRows.map((r: any) => r.id).sort()).toEqual([9301, 9302]);
  });

  it("gt/lt on a date column compares timestamps, not lexical strings pretending to be numbers", async () => {
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const { gt } = await import("drizzle-orm");
    const db: any = await getDb();
    await db.delete(accounts);
    const now = new Date();
    await db.insert(accounts).values({
      id: 9401, name: "Recently synced",
      lastSixsenseSync: new Date(now.getTime() + 60_000).toISOString(),
    });
    await db.insert(accounts).values({
      id: 9402, name: "Long ago",
      lastSixsenseSync: new Date(now.getTime() - 60_000).toISOString(),
    });

    const rows = await db.select().from(accounts).where(gt(accounts.lastSixsenseSync, now));
    expect(rows.map((r: any) => r.id)).toEqual([9401]);
  });

  it("update()/delete() honor gt/lt/gte/lte too, not just select()", async () => {
    // select's filter loop and update/delete's each duplicated their own inline
    // matching logic; update/delete's version didn't handle gt/lt (or even is_null/
    // in) at all. Now all three share one matchesFilter function.
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const { lt } = await import("drizzle-orm");
    const db: any = await getDb();
    await db.delete(accounts);
    await db.insert(accounts).values({ id: 9501, name: "Cold", intentScore: 10 });
    await db.insert(accounts).values({ id: 9502, name: "Hot", intentScore: 90 });

    await db.delete(accounts).where(lt(accounts.intentScore, 50));

    const remaining = await db.select().from(accounts);
    expect(remaining.map((r: any) => r.id)).toEqual([9502]);
  });

  it("orderBy(desc(...)) / orderBy(asc(...)) actually sort — they previously sorted nothing", async () => {
    // desc(col)/asc(col) wrap the column instead of exposing .name/.fieldName
    // directly, so orderExpr.name and orderExpr.fieldName were both undefined for
    // EVERY orderBy(desc(...))/orderBy(asc(...)) call in the app against the
    // demo-mode store — orderByField silently stayed '', which the sort step
    // treats as falsy and skips. Rows came back in raw insertion order regardless
    // of what was actually requested, on all 18 call sites across the app that use
    // this pattern (accounts, contacts, calls, briefs, and more).
    const { getDb } = await import("./db");
    const { accounts } = await import("../drizzle/schema");
    const { desc, asc } = await import("drizzle-orm");
    const db: any = await getDb();
    await db.delete(accounts);
    await db.insert(accounts).values({ id: 9601, name: "B", intentScore: 50 });
    await db.insert(accounts).values({ id: 9602, name: "A", intentScore: 90 });
    await db.insert(accounts).values({ id: 9603, name: "C", intentScore: 10 });

    const descRows = await db.select().from(accounts).orderBy(desc(accounts.intentScore));
    expect(descRows.map((r: any) => r.id)).toEqual([9602, 9601, 9603]);

    const ascRows = await db.select().from(accounts).orderBy(asc(accounts.intentScore));
    expect(ascRows.map((r: any) => r.id)).toEqual([9603, 9601, 9602]);
  });

  it("a WHERE clause against dustCache maps its SQL column name back to the JS key", async () => {
    // dustCache is the one table in the schema whose SQL column names don't match
    // their JS property names (query_hash vs queryHash, account_id vs accountId,
    // expires_at vs expiresAt) — every other table's SQL name happens to equal its
    // JS key, which is what hid this: parseCondition used column.name (the SQL
    // name) directly as the field to filter on, but insert() stores rows keyed by
    // the JS property. Every WHERE clause against this table silently filtered on
    // a key that was never in the stored row, so it could never match anything —
    // not just for gt/lt, for eq too.
    const { getDb } = await import("./db");
    const { dustCache } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    await db.delete(dustCache);
    await db.insert(dustCache).values({
      queryHash: "abc123", query: "q", result: "r",
      accountId: 7, contactId: null, expiresAt: new Date(Date.now() + 3600_000),
    });

    const rows = await db.select().from(dustCache).where(eq(dustCache.accountId, 7));
    expect(rows.length).toBe(1);
    expect(rows[0].result).toBe("r");
  });
});
