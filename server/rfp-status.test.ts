import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { effectiveRfpStatus } from "./rfp-scraper";
import type { RFP } from "../drizzle/schema";

/**
 * `status` is written once at ingest and never revisited as the deadline passes.
 * Confirmed live: 18 of 25 seeded RFPs carried status "open" with a
 * responseDeadline months in the past — including one with an awardAmount already
 * populated, still showing a green "Open" badge and counted in the stats tile.
 */
describe("effectiveRfpStatus", () => {
  it("reports closed for an open RFP whose deadline has passed", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 100).toISOString();
    const result = effectiveRfpStatus({ status: "open", responseDeadline: past as any } as RFP);
    expect(result).toBe("closed");
  });

  it("still reports open for a deadline in the future", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const result = effectiveRfpStatus({ status: "open", responseDeadline: future as any } as RFP);
    expect(result).toBe("open");
  });

  it("leaves a closed or awarded RFP's status alone regardless of deadline", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(effectiveRfpStatus({ status: "closed", responseDeadline: past as any } as RFP)).toBe("closed");
    expect(effectiveRfpStatus({ status: "awarded", responseDeadline: past as any } as RFP)).toBe("awarded");
  });

  it("leaves status alone when there is no deadline to check", () => {
    expect(effectiveRfpStatus({ status: "open", responseDeadline: null } as RFP)).toBe("open");
  });
});

describe("rfps.list / rfps.stats agree on effective status", () => {
  const DB = path.join(process.cwd(), "demo-db.test-rfp-status.json");
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

  it("excludes a stale-deadline RFP from both the open list and the open count", async () => {
    const { getDb } = await import("./db");
    const { rfps } = await import("../drizzle/schema");
    const db: any = await getDb();
    await db.delete(rfps);

    const past = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    await db.insert(rfps).values({ id: 1, title: "Stale", status: "open", responseDeadline: past });
    await db.insert(rfps).values({ id: 2, title: "Live", status: "open", responseDeadline: future });

    const { rfpRouter } = await import("./rfp-scraper");
    const { mockAuthContext } = await import("./test-utils");
    const caller = rfpRouter.createCaller(mockAuthContext);

    const openList = await caller.list({ status: "open" });
    expect(openList.map((r: any) => r.id)).toEqual([2]);

    const stats = await caller.stats();
    expect(stats.open).toBe(1);
    expect(stats.closed).toBe(1);
  });
});
