import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { and, or, not, like, eq, gt, gte, lt, lte, ne, isNull, isNotNull, inArray, desc, asc } from "drizzle-orm";

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

  it("or widens the match instead of narrowing it to nothing", async () => {
    // Every sub-condition was pushed onto one flat AND list regardless of the joining
    // word, so `or(a, b)` became `a AND b`. For two different values of the same column
    // that is unsatisfiable: a query written to widen a search returned zero rows.
    const [a, b] = all;
    expect(await q(or(eq(accounts.id, a.id), eq(accounts.id, b.id)))).toBe(2);
  });

  it("or composes with range comparisons", async () => {
    // The branches of an OR are their own AND-lists, so an operator inside one has to
    // survive the nesting — not silently collapse back to equality.
    expect(await q(or(gte(accounts.intentScore, 90), lt(accounts.intentScore, 5)))).toBe(
      countWhere(a => (a.intentScore ?? 0) >= 90 || (a.intentScore ?? 0) < 5)
    );
  });

  it("not excludes, rather than returning exactly what it was told to exclude", async () => {
    // `not(x)` was parsed as plain `x` — the most confidently wrong answer available,
    // since the result looks like a perfectly ordinary row set.
    const [a] = all;
    expect(await q(not(eq(accounts.id, a.id)))).toBe(all.length - 1);
  });

  it("like does substring matching and does not throw", async () => {
    // Two bugs in one call. The pattern arrives as a bare string, and the parser did
    // `'value' in chunk` on it — "Cannot use 'in' operator to search for 'value' in
    // %Acme%" — so every like() query in demo mode was a 500, not a wrong answer. Once
    // that was guarded, the pattern was applied as an equality filter, matching only a
    // row whose name is literally "%Acme%".
    const [a] = all;
    const word = String(a.name || "").split(" ")[0];
    expect(word.length).toBeGreaterThan(2);
    expect(await q(like(accounts.name, `%${word}%`))).toBe(
      countWhere(x => String(x.name || "").toLowerCase().includes(word.toLowerCase()))
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

describe("demo store — ordering", () => {
  const rows = (o: any[], n = 5) =>
    getDb().then(db =>
      db.select().from(accounts).where(eq(accounts.orgId, 1)).orderBy(...o).limit(n)
    );

  it("sorts descending, rather than not sorting at all", async () => {
    // orderBy read `expr.name`, which a bare column has and `desc(col)` does not —
    // drizzle wraps it in an SQL object whose chunks are [column, " desc"]. So the field
    // stayed empty and NO sorting happened: asc and desc returned byte-identical results
    // in insertion order. With `.limit(n)` that turns "top n accounts by intent score"
    // into "the first n accounts in the file", presented as the top n. Measured on this
    // dataset before the fix: 92, 100, 95, 84, 90.
    const got = (await rows([desc(accounts.intentScore)])).map((a: any) => a.intentScore);
    const want = [...all].sort((a, b) => (b.intentScore ?? -1) - (a.intentScore ?? -1))
      .slice(0, 5).map(a => a.intentScore);
    expect(got).toEqual(want);
  });

  it("sorts ascending, and differently from descending", async () => {
    const up = (await rows([asc(accounts.intentScore)])).map((a: any) => a.intentScore);
    const down = (await rows([desc(accounts.intentScore)])).map((a: any) => a.intentScore);
    expect(up[0]).toBeLessThan(down[0]);
  });

  it("honours a second sort term", async () => {
    // `.orderBy(a, b)` is one call with two arguments and the second was dropped, so a
    // tie-break never applied and equal-scoring rows came back in arbitrary order.
    const got = await rows([desc(accounts.intentScore), asc(accounts.name)], 4);
    const scores = got.map((a: any) => a.intentScore);
    const names = got.map((a: any) => a.name);
    expect(scores.every((s: number) => s === scores[0])).toBe(true);
    expect(names).toEqual([...names].sort((x, y) => String(x).localeCompare(String(y))));
  });

  it("still sorts by a bare column", async () => {
    const names = (await rows([accounts.name], 3)).map((a: any) => a.name);
    expect(names).toEqual([...names].sort((x, y) => String(x).localeCompare(String(y))));
  });

  it("sorts nulls last, not first", async () => {
    // `null < 5` is true in JavaScript, because null coerces to 0. Without an explicit
    // null rule an account with no intent score leads a descending "top accounts" list.
    const top = await rows([desc(accounts.intentScore)], 10);
    expect(top.every((a: any) => a.intentScore !== null && a.intentScore !== undefined)).toBe(true);
  });
});
