import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext } from "./test-utils";

/**
 * The home page and Intent Signals both show an "unworked 6QA" count. They disagreed by
 * a factor of eleven — 69 against 6 — one click apart in the nav, because each counted
 * "worked" its own way. They now share one definition (./six-qa); this pins the two
 * routers to the same answer over the same data, end to end through the real store.
 */

const DB = path.join(process.cwd(), "demo-db.test-six-qa-agreement.json");
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

async function seed() {
  const { getDb } = await import("./db");
  const { accounts, opportunities, contacts, calls, intentScores } = await import("../drizzle/schema");
  const db: any = await getDb();
  for (const t of [accounts, opportunities, contacts, calls, intentScores]) await db.delete(t);

  await db.insert(accounts).values([
    { id: 1, name: "Contact Only", intentScore: 90 }, // qualified; a contact on file, nothing else
    { id: 2, name: "Open Deal", intentScore: 85 },    // qualified; an open opportunity
    { id: 3, name: "Lost Deal", intentScore: 80 },    // qualified; only a lost opportunity
    { id: 4, name: "Called Once", intentScore: 75 },  // qualified; a call, no opportunity
    { id: 5, name: "Cold", intentScore: 30 },         // not a 6QA at all
  ]);
  await db.insert(contacts).values({ accountId: 1, name: "Pat Imported" });
  await db.insert(opportunities).values([
    { accountId: 2, name: "Open Deal — Rollout", status: "Open", amount: "10000" },
    { accountId: 3, name: "Lost Deal — Pilot", status: "Lost", amount: "5000" },
  ]);
  await db.insert(calls).values({ accountId: 4, callDate: new Date("2026-07-01T12:00:00Z") });
}

describe("unworked 6QAs are counted the same way everywhere", () => {
  it("home and Intent Signals report the same number", async () => {
    await seed();
    const { priorityActionsRouter } = await import("./priority-actions-router");
    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");

    const home = await priorityActionsRouter.createCaller(mockAuthContext as any).getRepStats({});
    const intent = await sixsenseAnalyticsRouter.createCaller(mockAuthContext as any).getSummary();

    expect(intent.sixQA.unworked).toBe(home.sixQAGap);
  });

  it("a contact record on file is not work", async () => {
    // The one that made Intent Signals read 99 worked of 105: the seed imports contacts
    // for nearly every account, and any contact at all counted.
    await seed();
    const { sixsenseAnalyticsRouter } = await import("./sixsense-analytics");
    const { sixQA } = await sixsenseAnalyticsRouter.createCaller(mockAuthContext as any).getSummary();

    expect(sixQA.total).toBe(4);
    // Unworked: "Contact Only" and "Called Once". Worked: the two with an opportunity,
    // including the lost one — a deal that was lost was still worked.
    expect(sixQA.unworked).toBe(2);
    expect(sixQA.worked).toBe(2);
  });

  it("the ids behind the home tile are the accounts it counted", async () => {
    // /accounts?filter=unworked filters to exactly these, so the list matches the tile.
    await seed();
    const { priorityActionsRouter } = await import("./priority-actions-router");
    const home = await priorityActionsRouter.createCaller(mockAuthContext as any).getRepStats({});

    expect(home.unworkedAccountIds.sort()).toEqual([1, 4]);
    expect(home.unworkedAccountIds).toHaveLength(home.sixQAGap);
  });
});
