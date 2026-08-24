import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext, mockUser } from "./test-utils";

/**
 * getSavedTranscriptReports capped at 100 rows and returned a bare array.
 * TranscriptAnalyzer.tsx and AITools.tsx both showed that array's length as the total
 * ("Saved Reports (N)") — a user with more than 100 saved reports over time would see a
 * count that reads as their real total but silently excludes the older ones. Same
 * silent-truncation shape already fixed for Salesforce's contact/account sync
 * (server/salesforce.ts's queryAll, which follows nextRecordsUrl instead of trusting a
 * single capped batch).
 */

const DB = path.join(process.cwd(), "demo-db.test-saved-reports.json");
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

async function seedReports(count: number) {
  const { getDb } = await import("./db");
  const { transcriptReports } = await import("../drizzle/schema");
  const db: any = await getDb();
  for (let i = 0; i < count; i++) {
    await db.insert(transcriptReports).values({
      userId: mockUser.id,
      name: `Report ${i}`,
      transcript: "…",
      analysis: {},
      shareId: `share-${i}`,
      // Spread creation times so ORDER BY createdAt DESC has something to actually order.
      createdAt: new Date(Date.now() - i * 1000),
    });
  }
}

describe("tools.getSavedTranscriptReports — truncation honesty", () => {
  it("reports hasMore:true and caps at 100 when there are more than 100 reports", async () => {
    await seedReports(105);

    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);
    const result = await caller.getSavedTranscriptReports();

    expect(result.reports).toHaveLength(100);
    expect(result.hasMore).toBe(true);
  });

  it("reports hasMore:false when every report fits under the cap", async () => {
    await seedReports(3);

    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);
    const result = await caller.getSavedTranscriptReports();

    expect(result.reports).toHaveLength(3);
    expect(result.hasMore).toBe(false);
  });
});
