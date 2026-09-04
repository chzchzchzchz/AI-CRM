import { describe, expect, it, vi } from "vitest";
import { mockAuthContext } from "./test-utils";

/**
 * Bulk insights generation runs one LLM call per hot-lead account and used to have two
 * honesty gaps, both found by exercising this against the live demo dataset:
 *
 *  - when the model was unreachable, the "unavailable" note was cached as the account's
 *    insight and reported as `success: true` — a green checkmark in the UI for an account
 *    that got nothing;
 *  - a reasoning-style free-tier model (observed live via OpenRouter's rotation) wrapped
 *    the requested markdown in its own scratchpad (`<COGNITION_START>...<FINAL_RESPONSE>`)
 *    and invented a calendar date nowhere in the input, despite being told the exact
 *    structure to use.
 *
 * These tests stub `getDb`/`getContactsByAccountId`/`getGongCallsByAccountId`/`updateAccount`
 * directly rather than relying on the DEMO_MODE JSON store: that store's MockDrizzle query
 * builder (server/db.ts, not owned by this feature) treats `gte()` as an equality filter, so
 * "intent score 70+" only ever matches accounts scored exactly 70 in demo mode — a separate,
 * pre-existing bug outside this router's control. Stubbing the data layer isolates the
 * behavior this router is actually responsible for.
 */
const fakeAccount = { id: 1, name: "Acme Corp", domain: "acme.com", intentScore: 92 };

function mockDbChain(rows: any[]) {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
  };
  return chain;
}

describe("bulkInsights.generateForTopLeads", () => {
  it("reports failure (not success) for an account when no model is reachable", async () => {
    vi.resetModules();
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        getDb: vi.fn().mockResolvedValue(mockDbChain([fakeAccount])),
        getContactsByAccountId: vi.fn().mockResolvedValue([]),
        getGongCallsByAccountId: vi.fn().mockResolvedValue([]),
        updateAccount: vi.fn().mockResolvedValue(undefined),
      };
    });
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { role: "assistant", content: "" } }] }),
        llmText: () => ({ content: actual.LLM_UNAVAILABLE_NOTE, available: false }),
      };
    });

    const { bulkInsightsRouter } = await import("./bulk-insights-router");
    const caller = bulkInsightsRouter.createCaller(mockAuthContext);

    const result = await caller.generateForTopLeads({ limit: 5 });

    expect(result.total).toBe(1);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toMatch(/unavailable|no API key/i);
    expect((result.results[0] as any).insights).toBeUndefined();

    vi.doUnmock("./db");
    vi.doUnmock("./_core/llm");
  });

  it("strips a reasoning-model's scratchpad wrapper before caching the insight", async () => {
    vi.resetModules();
    let cachedInsight = "";
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        getDb: vi.fn().mockResolvedValue(mockDbChain([fakeAccount])),
        getContactsByAccountId: vi.fn().mockResolvedValue([]),
        getGongCallsByAccountId: vi.fn().mockResolvedValue([]),
        updateAccount: vi.fn().mockImplementation(async (_orgId: number, _id: number, patch: any) => {
          cachedInsight = patch.aiInsightsCache;
        }),
      };
    });
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      const wrapped = [
        "```xml",
        "<COGNITION_START>",
        "<DECONSTRUCTION>Some internal planning the rep should never see.</DECONSTRUCTION>",
        "<FINAL_RESPONSE>",
        "## Executive Summary",
        "Real content starts here.",
        "```",
      ].join("\n");
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { role: "assistant", content: wrapped } }] }),
        llmText: () => ({ content: wrapped, available: true }),
      };
    });

    const { bulkInsightsRouter } = await import("./bulk-insights-router");
    const caller = bulkInsightsRouter.createCaller(mockAuthContext);

    const result = await caller.generateForTopLeads({ limit: 1 });

    expect(result.processed).toBe(1);
    expect(result.results[0].success).toBe(true);
    expect((result.results[0] as any).insights).toMatch(/^## Executive Summary/);
    expect((result.results[0] as any).insights).not.toContain("COGNITION_START");
    expect((result.results[0] as any).insights).not.toContain("Some internal planning");
    expect(cachedInsight).toMatch(/^## Executive Summary/);

    vi.doUnmock("./db");
    vi.doUnmock("./_core/llm");
  });
});
