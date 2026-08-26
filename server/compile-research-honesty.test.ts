import { describe, expect, it, vi } from "vitest";
import { mockAuthContext } from "./test-utils";

/**
 * compileResearch computed `available` from the LLM response, then discarded it: the
 * returned shape was `{ insights: available ? insights : LLM_UNAVAILABLE_NOTE, ... }`
 * with no `available` field at all. AccountResearch.tsx renders `insights` straight
 * through SafeStreamdown with no other check — the outage note read as real "Outside
 * view" research, formatted identically to a genuine answer.
 *
 * Worse than the same bug elsewhere in this session: this result was cached into
 * account.aiResearchCache for 24 hours (see the `cacheValid` read path above this
 * mutation), so one transient outage poisoned every viewer's "Outside view" panel for
 * the rest of the day, with no live retry until the cache aged out or someone knew to
 * force-refresh. Same reasoning as bulk-insights-router.ts's identical fix: a failed
 * generation must not be cached as if it were a real answer.
 */

const fakeAccount = {
  id: 1,
  name: "Acme Corp",
  domain: "acme.com",
  industry: "SaaS",
  triggerEvents: null,
  rawData: null,
  aiResearchCache: null,
  aiCacheUpdatedAt: null,
};

describe("ai.compileResearch", () => {
  it("does not cache the outage note as research when no model is reachable", async () => {
    vi.resetModules();
    let cachedResearch: unknown = "not written";
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        getAccountById: vi.fn().mockResolvedValue(fakeAccount),
        updateAccount: vi.fn().mockImplementation(async (_id: number, patch: any) => {
          if ("aiResearchCache" in patch) cachedResearch = patch.aiResearchCache;
        }),
      };
    });
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: actual.LLM_UNAVAILABLE_NOTE } }],
        }),
      };
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(mockAuthContext);
    const result = await caller.ai.compileResearch({ accountId: 1 });

    expect(result.available).toBe(false);
    expect(result.insights).toMatch(/unavailable/i);
    // The whole point: nothing gets written to the 24h cache on a failed generation.
    expect(cachedResearch).toBe("not written");

    vi.doUnmock("./db");
    vi.doUnmock("./_core/llm");
  });

  it("caches real research and reports available:true when the model responds", async () => {
    vi.resetModules();
    let cachedResearch: any = null;
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        getAccountById: vi.fn().mockResolvedValue(fakeAccount),
        updateAccount: vi.fn().mockImplementation(async (_id: number, patch: any) => {
          if ("aiResearchCache" in patch) cachedResearch = JSON.parse(patch.aiResearchCache);
        }),
      };
    });
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: "Acme Corp raised a $40M Series B in Q2." } }],
        }),
      };
    });

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(mockAuthContext);
    const result = await caller.ai.compileResearch({ accountId: 1 });

    expect(result.available).toBe(true);
    expect(result.insights).toBe("Acme Corp raised a $40M Series B in Q2.");
    expect(cachedResearch).not.toBeNull();
    expect(cachedResearch.available).toBe(true);
    expect(cachedResearch.insights).toBe("Acme Corp raised a $40M Series B in Q2.");

    vi.doUnmock("./db");
    vi.doUnmock("./_core/llm");
  });
});
