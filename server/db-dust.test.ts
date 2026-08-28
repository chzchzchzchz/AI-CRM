import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Two bugs in the Dust cache, found via a file-by-file sweep:
 *
 *  1. getCachedDustResponse filtered on isNull(expiresAt), but cacheDustResponse
 *     always writes a real Date — never null. The read and write paths disagreed
 *     about what "still valid" meant, so a lookup could never match anything the
 *     cache had actually written. Every call was an unconditional cache miss.
 *  2. clearExpiredDustCache deleted rows where expiresAt was GREATER than now —
 *     i.e. the rows that have NOT expired — and left the actually-expired rows in
 *     place. The exact opposite of its own name.
 */

const DB = path.join(process.cwd(), "demo-db.test-db-dust.json");
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

describe("Dust cache", () => {
  it("a value written by cacheDustResponse is actually returned by getCachedDustResponse", async () => {
    const { cacheDustResponse, getCachedDustResponse } = await import("./db-dust");

    await cacheDustResponse("what does Acme do", "Acme does widgets.", 42, undefined, 24);
    const hit = await getCachedDustResponse("what does Acme do", 42, undefined);

    expect(hit).toBe("Acme does widgets.");
  });

  it("does not return an expired entry", async () => {
    const { getDb } = await import("./db");
    const { dustCache } = await import("../drizzle/schema");
    const crypto = await import("crypto");
    const db: any = await getDb();
    await db.insert(dustCache).values({
      queryHash: crypto.createHash("sha256").update("stale query").digest("hex"),
      query: "stale query",
      result: "stale result",
      accountId: null,
      contactId: null,
      expiresAt: new Date(Date.now() - 1000), // already expired
    });

    const { getCachedDustResponse } = await import("./db-dust");
    const hit = await getCachedDustResponse("stale query");

    expect(hit).toBeNull();
  });

  it("clearExpiredDustCache removes expired entries and keeps valid ones", async () => {
    const { getDb } = await import("./db");
    const { dustCache } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const crypto = await import("crypto");
    const db: any = await getDb();

    await db.insert(dustCache).values({
      queryHash: crypto.createHash("sha256").update("expired one").digest("hex"),
      query: "expired one", result: "old",
      accountId: null, contactId: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await db.insert(dustCache).values({
      queryHash: crypto.createHash("sha256").update("still valid").digest("hex"),
      query: "still valid", result: "fresh",
      accountId: null, contactId: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const { clearExpiredDustCache } = await import("./db-dust");
    await clearExpiredDustCache();

    const remaining = await db.select().from(dustCache);
    expect(remaining.some((r: any) => r.query === "still valid")).toBe(true);
    expect(remaining.some((r: any) => r.query === "expired one")).toBe(false);
  });
});
