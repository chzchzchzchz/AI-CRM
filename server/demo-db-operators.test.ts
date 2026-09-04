import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { and, eq, gt, gte, lt, lte, ne, isNull, isNotNull, inArray } from "drizzle-orm";

/**
 * Range comparisons in the demo store.
 *
 * The MockDrizzle query builder read the operand out of a condition and threw the
 * OPERATOR away, pushing a plain `{ field, value }` that the filter step applies as
 * equality. Every range comparison in the app therefore became `==` in demo mode —
 * which is how essentially everyone runs this app.
 *
 * Measured against the shipped dataset before the fix:
 *
 *   gte(intentScore, 70)  returned    5  accounts, of an actual  105
 *   lt(intentScore, 40)   returned    6  accounts, of an actual  751
 *
 * The `lt` case is the worse one: the six it returned were the accounts scored exactly
 * 40, which are not in the range that was asked for at all. Hot leads, priority actions
 * and bulk insights all select by score range, so each was operating on a handful of
 * arbitrary accounts — while the home page printed "HOT 105 · Intent 70+", counted in
 * JavaScript over the full list. Two numbers on one screen, both derived from the same
 * data, disagreeing by 20×, and nothing anywhere said so.
 *
 * A comment in server/bulk-insights-router.test.ts documented this ("treats gte() as an
 * equality filter") and worked around it by stubbing the data layer. Documented and
 * worked around is how a bug survives.
 */

let all: any[] = [];
const countWhere = (f: (a: any) => boolean) => all.filter(f).length;

async function q(condition: any): Promise<number> {
  const db = await getDb();
  const rows = await db.select().from(accounts).where(and(eq(accounts.orgId, 1), condition));
  return rows.length;
}

beforeAll(async () => {
  const db = await getDb();
  all = await db.select().from(accounts).where(eq(accounts.orgId, 1));
  // If the dataset ever loses its spread of scores these tests stop meaning anything,
  // so assert the fixture is actually capable of distinguishing == from >=.
  expect(all.length).toBeGreaterThan(100);
  expect(countWhere(a => (a.intentScore ?? 0) >= 70)).toBeGreaterThan(
    countWhere(a => a.intentScore === 70) + 10
  );
});

describe("demo store — comparison operators", () => {
  it("gte matches the whole range, not just the boundary", async () => {
    expect(await q(gte(accounts.intentScore, 70))).toBe(countWhere(a => (a.intentScore ?? 0) >= 70));
  });

  it("gt excludes the boundary", async () => {
    expect(await q(gt(accounts.intentScore, 70))).toBe(countWhere(a => (a.intentScore ?? 0) > 70));
  });

  it("lt matches below the boundary, not the boundary itself", async () => {
    // The original returned the rows equal to the operand — rows outside the range asked
    // for. Wrong in a direction no amount of squinting at the number would reveal.
    expect(await q(lt(accounts.intentScore, 40))).toBe(countWhere(a => (a.intentScore ?? 0) < 40));
  });

  it("lte includes the boundary", async () => {
    expect(await q(lte(accounts.intentScore, 40))).toBe(countWhere(a => (a.intentScore ?? 0) <= 40));
  });

  it("still gets equality right", async () => {
    expect(await q(eq(accounts.intentScore, 70))).toBe(countWhere(a => a.intentScore === 70));
  });

  it("ne excludes only the matching value", async () => {
    expect(await q(ne(accounts.intentScore, 70))).toBe(countWhere(a => String(a.intentScore) !== "70"));
  });

  it("keeps the operators it already had", async () => {
    // gte/lt were added by widening the branch that handled equality. These pin that the
    // other operators still route where they did.
    const ids = all.slice(0, 3).map(a => a.id);
    expect(await q(inArray(accounts.id, ids))).toBe(3);
    expect(await q(isNotNull(accounts.name))).toBe(countWhere(a => a.name !== null && a.name !== undefined));
    expect(await q(isNull(accounts.sixsenseId))).toBe(
      countWhere(a => a.sixsenseId === null || a.sixsenseId === undefined)
    );
  });

  it("a null field satisfies no ordering comparison, as in SQL", async () => {
    // An account with no intent score is not "intent 70+", and must not be swept in by a
    // NaN comparison landing wherever it lands. Both directions, because a NaN bug is
    // just as likely to include everything as to exclude everything.
    const noScore = countWhere(a => a.intentScore === null || a.intentScore === undefined);
    const above = await q(gte(accounts.intentScore, 0));
    const below = await q(lt(accounts.intentScore, 0));
    expect(above + below).toBe(all.length - noScore);
  });
});
