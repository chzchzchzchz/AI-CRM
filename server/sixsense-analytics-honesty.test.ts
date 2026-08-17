import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext } from "./test-utils";

/**
 * server/sixsense-analytics.ts computes several dashboard tiles from real account/intent
 * data. Three of its computations were confirmed wrong live and are reproduced here
 * against the real demo-mode data store, end to end through the actual router:
 *
 *  - getKeywords reported a keyword's "category" as whichever row happened to be seen
 *    first, rather than the category most of its rows actually carried.
 *  - getKeywords never exposed which accounts a keyword's rows actually referenced —
 *    the client's drill-down had nothing real to filter by and fell back to a
 *    category+intent-score heuristic that ignored the clicked keyword entirely.
 *  - get6QAPerformance's "new6QAs" subtracted two unrelated measures (a live snapshot
 *    total vs. a historical trend point), producing a number with no coherent meaning.
 */

const DB = path.join(process.cwd(), "demo-db.test-sixsense-honesty.json");
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

async function freshDb() {
  const { getDb } = await import("./db");
  const { accounts, intentScores, opportunities, contacts, calls } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(accounts);
  await db.delete(intentScores);
  await db.delete(opportunities);
  await db.delete(contacts);
  await db.delete(calls);
  return { db, accounts, intentScores, opportunities, contacts, calls };
}

describe("getKeywords", () => {
  it("reports the plurality category, not whichever row arrived first", async () => {
    const { db, accounts, intentScores } = await freshDb();
    await db.insert(accounts).values({ id: 1, name: "Acme", intentScore: 50 });

    // "CRM migration" — one row under a rare category first, then five under the real
    // plurality. A "first row wins" implementation reports "Retail Tech"; the correct
    // answer, and what a person reading the data would say, is "Pricing".
    await db.insert(intentScores).values({ accountId: 1, score: 10, category: "Retail Tech", keywords: "CRM migration" });
    for (let i = 0; i < 5; i++) {
      await db.insert(intentScores).values({ accountId: 1, score: 20 + i, category: "Pricing", keywords: "CRM migration" });
    }

    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");
    const caller = sixsenseAnalyticsRouter.createCaller(mockAuthContext);
    const result = await caller.getKeywords({ limit: 50 });

    const kw = result.keywords.find((k: any) => k.keyword === "CRM migration");
    expect(kw?.category).toBe("Pricing");
  });

  it("returns the real account ids a keyword's rows reference, distinct per keyword", async () => {
    const { db, accounts, intentScores } = await freshDb();
    await db.insert(accounts).values({ id: 1, name: "Acme", intentScore: 50 });
    await db.insert(accounts).values({ id: 2, name: "Globex", intentScore: 60 });

    await db.insert(intentScores).values({ accountId: 1, score: 90, category: "Security", keywords: "new VP sales hire" });
    await db.insert(intentScores).values({ accountId: 2, score: 40, category: "Security", keywords: "SSO rollout" });

    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");
    const caller = sixsenseAnalyticsRouter.createCaller(mockAuthContext);
    const result = await caller.getKeywords({ limit: 50 });

    const kwA = result.keywords.find((k: any) => k.keyword === "new VP sales hire");
    const kwB = result.keywords.find((k: any) => k.keyword === "SSO rollout");
    expect(kwA?.accountIds).toEqual([1]);
    expect(kwB?.accountIds).toEqual([2]);
    // The bug this guards against: two keywords in the same category rendering the
    // identical account list regardless of which was actually clicked.
    expect(kwA?.accountIds).not.toEqual(kwB?.accountIds);
  });
});

describe("get6QAPerformance new6QAs", () => {
  it("compares the trend series to itself, and can be negative", async () => {
    const { db, accounts, intentScores } = await freshDb();
    // Two accounts qualified (>=70) yesterday; only one qualifies today — a real decline.
    await db.insert(accounts).values({ id: 1, name: "A", intentScore: 75 });
    await db.insert(accounts).values({ id: 2, name: "B", intentScore: 20 });

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString();
    await db.insert(intentScores).values({ accountId: 1, score: 80, category: "Product", createdAt: yesterday });
    await db.insert(intentScores).values({ accountId: 2, score: 75, category: "Product", createdAt: yesterday });
    await db.insert(intentScores).values({ accountId: 1, score: 75, category: "Product", createdAt: today });

    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");
    const caller = sixsenseAnalyticsRouter.createCaller(mockAuthContext);
    const result = await caller.get6QAPerformance();

    // Trend day 1: 2 accounts had a >=70 reading. Trend day 2: 1 account did.
    // The honest delta is -1, not a figure blended from an unrelated live snapshot.
    expect(result.latest.new6QAs).toBe(-1);
  });

  it("returns null (not the raw total) when there is only one trend point", async () => {
    const { db, accounts, intentScores } = await freshDb();
    await db.insert(accounts).values({ id: 1, name: "A", intentScore: 75 });
    await db.insert(intentScores).values({ accountId: 1, score: 80, category: "Product" });

    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");
    const caller = sixsenseAnalyticsRouter.createCaller(mockAuthContext);
    const result = await caller.get6QAPerformance();

    expect(result.latest.new6QAs).toBeNull();
  });
});

describe("getEngagement bucket semantics", () => {
  it("the Intent bucket is accounts with a score but no engagement — distinct from No Engagement", async () => {
    const { db, accounts } = await freshDb();
    // Intent, unengaged: score >= 40, no contacts/calls/opps.
    await db.insert(accounts).values({ id: 1, name: "Warm no-touch", intentScore: 55 });
    // No engagement: score < 40, no contacts/calls/opps — a genuinely different population.
    await db.insert(accounts).values({ id: 2, name: "Cold untouched", intentScore: 5 });

    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");
    const caller = sixsenseAnalyticsRouter.createCaller(mockAuthContext);
    const result = await caller.getEngagement();

    const byState = Object.fromEntries(result.metrics.map((m: any) => [m.state, m.accounts]));
    expect(byState["Intent"]).toBe(1);
    expect(byState["No Engagement"]).toBe(1);
  });
});
