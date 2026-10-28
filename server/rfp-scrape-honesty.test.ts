import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * scrapeAllRFPs caught each per-keyword SAM.gov search failure individually and just
 * logged it — an expired or rejected API key fails every keyword identically (the same
 * 401/403 on each request), so the mutation returned `success: true, total: 0, inserted:
 * 0, message: "Scraped 0 opportunities, inserted 0 new RFPs"`. That message is
 * indistinguishable from a genuinely quiet week for the configured keywords. RFPs.tsx
 * shows it as a plain success toast either way.
 */

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

beforeEach(() => {
  process.env.SAM_GOV_API_KEY = "test-key";
  // A short, explicit list decouples this test from the production default (currently 6
  // keywords) and keeps it fast: scrapeAllRFPs waits 1s between successful searches for
  // SAM.gov rate limiting, so fewer keywords means less real wall-clock time per test.
  process.env.RFP_KEYWORDS = "alpha,beta";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
  vi.resetModules();
});

describe("rfps.scrape — credential-failure honesty", () => {
  it("reports failure, not a clean 0-result run, when every keyword search is rejected", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    }) as any;

    const { rfpRouter } = await import("./rfp-scraper");
    const { mockAuthContext } = await import("./test-utils");
    const caller = rfpRouter.createCaller(mockAuthContext);

    const result: any = await caller.scrape({});

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/every configured keyword/i);
    // Never silently reached storeRFPs / claimed a scrape happened.
    expect(result.total).toBeUndefined();
    expect(result.message).toBeUndefined();
  });

  it("still reports success, with the failure count visible, when only some keywords fail", async () => {
    let call = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      call++;
      // First call fails, the rest return a real (empty) result set.
      if (call === 1) {
        return { ok: false, status: 500, statusText: "Internal Server Error" };
      }
      return { ok: true, json: async () => ({ opportunitiesData: [] }) };
    }) as any;

    const { rfpRouter } = await import("./rfp-scraper");
    const { mockAuthContext } = await import("./test-utils");
    const caller = rfpRouter.createCaller(mockAuthContext);

    const result: any = await caller.scrape({});

    expect(result.success).toBe(true);
    expect(result.failedKeywordCount).toBe(1);
    expect(result.message).toMatch(/1\/2 keyword searches failed/);
  }, 10000);
});
