import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ai.search (intelligentSearch/runSearch in server/ai.ts) had three confirmed
 * live defects:
 *
 *  1. The response's `filters`/`explanation` were the model's own unverified
 *     claims about what it did, spread into the response untouched — even when
 *     they described constraints runSearch never actually enforced. Confirmed
 *     live: an empty query's explanation named an industry allowlist and a
 *     >1000-employee floor while the actual results included a 31-employee
 *     Professional Services account.
 *  2. A query with no recognized structure (gibberish, emoji, SQL-shaped text)
 *     fell through to "everyone, ranked by intent score" and was reported as a
 *     confident "N matches found" for a query that matched nothing.
 *  3. A plural title query ("find CISOs", "find CTOs") — including one of the
 *     app's own six suggested example queries — routed to account (company)
 *     search instead of contact (person) search, because titleKeywords'
 *     substring match ("ciso" inside "cisos") was computed but never consulted
 *     by the account-vs-contact routing decision.
 */

const DB = path.join(process.cwd(), "demo-db.test-ai-search.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
  // These tests exercise runSearch's deterministic filter/routing logic, which
  // behaves identically whether the model answers or not — so no test here should
  // depend on a real network round-trip. Left unmocked, intelligentSearch's real
  // invokeLLM tries the actual configured OpenRouter key and then, now that this
  // session started a real local Ollama fallback, a genuine CPU inference — both
  // real network/compute time a unit test has no business waiting on. Default to
  // a fast, deterministic "no model" response; the one test that needs specific
  // model output overrides this with its own vi.doMock before its own dynamic import.
  vi.doMock("./_core/llm", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./_core/llm")>();
    return {
      ...actual,
      invokeLLM: vi.fn().mockResolvedValue({ choices: [{ message: { content: actual.LLM_UNAVAILABLE_NOTE } }] }),
      llmText: () => ({ content: actual.LLM_UNAVAILABLE_NOTE, available: false }),
    };
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

async function seed() {
  const { getDb } = await import("./db");
  const { accounts, contacts } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(accounts);
  await db.delete(contacts);
  await db.insert(accounts).values({ id: 1, name: "Vertex Cloud Systems", industry: "Cloud Infrastructure", region: "West", employeeCount: 1500, intentScore: 95 });
  await db.insert(accounts).values({ id: 2, name: "Brightpoint", industry: "Professional Services", region: "East", employeeCount: 31, intentScore: 91 });
  await db.insert(contacts).values({ id: 1, accountId: 1, name: "Alice CISO", title: "CISO", email: "alice@vertex.example" });
  await db.insert(contacts).values({ id: 2, accountId: 2, name: "Bob Analyst", title: "Business Analyst", email: "bob@brightpoint.example" });
}

describe("intelligentSearch — no recognized structure returns zero results", () => {
  it("returns 0 results for gibberish, not the whole dataset ranked by intent", async () => {
    await seed();
    const { intelligentSearch } = await import("./ai");
    const result = await intelligentSearch("zzznonexistentqwertycompany999xyz");
    expect(result.resultCount).toBe(0);
    expect(result.results).toEqual([]);
  });

  it("returns 0 results for an empty query", async () => {
    await seed();
    const { intelligentSearch } = await import("./ai");
    const result = await intelligentSearch("");
    expect(result.resultCount).toBe(0);
  });

  it("still returns real matches for a query with actual text overlap", async () => {
    await seed();
    const { intelligentSearch } = await import("./ai");
    const result = await intelligentSearch("Vertex Cloud Systems");
    expect(result.resultCount).toBeGreaterThan(0);
    expect(result.results.some((r: any) => r.name === "Vertex Cloud Systems")).toBe(true);
  });
});

describe("intelligentSearch — contact-intent routing", () => {
  it("routes a plural title query to contact search", async () => {
    await seed();
    const { intelligentSearch } = await import("./ai");
    const result = await intelligentSearch("Find CISOs at companies with 1000+ employees");
    expect(result.resultType).toBe("contact");
    expect(result.results.some((r: any) => r.title === "CISO")).toBe(true);
  });

  it("routes the app's other plural example the same way", async () => {
    await seed();
    const { intelligentSearch } = await import("./ai");
    const result = await intelligentSearch("find CTOs");
    expect(result.resultType).toBe("contact");
  });
});

describe("intelligentSearch — filters reported match what actually ran", () => {
  it("does not relay a model-claimed filter shape runSearch can't parse and never enforces", async () => {
    await seed();
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                intent: "account_search",
                // runSearch reads industry via `firstStr(f.industry, ...)`, which
                // only accepts a scalar string — an array (a completely reasonable
                // shape for "these three industries", and the exact kind of thing
                // an unconstrained `filters: {type:"object"}` schema invites a model
                // to return) is silently ignored, so no industry constraint is ever
                // actually applied. Confirmed live: this is exactly why an
                // industry-allowlist claim in the model's own prose didn't match
                // what the returned results actually satisfied.
                filters: { industry: ["Financial Services", "Healthcare", "Technology"], minEmployees: 1000 },
                sortBy: "relevance",
                explanation: "Filtered to Financial Services/Healthcare/Technology accounts with 1000+ employees.",
              }),
            },
          }],
        }),
        llmText: (r: any) => ({ content: r.choices[0].message.content, available: true }),
      };
    });

    const { intelligentSearch } = await import("./ai");
    const result = await intelligentSearch("show me accounts");

    // The array-shaped industry filter never actually constrained anything — the
    // response must not claim it did. minEmployees (a scalar, via firstNum) DOES
    // get genuinely applied, and should still be reported, proving this isn't
    // just suppressing every filter defensively.
    expect(result.filters.industry).toBeUndefined();
    expect(result.filters.minEmployees).toBe(1000);
    expect(result.explanation).not.toContain("Financial Services");
    // Brightpoint (31 employees) is correctly excluded by the real minEmployees:1000
    // constraint — but for the real reason (too few employees), not a phantom
    // industry restriction the explanation no longer claims.
    expect(result.results.some((r: any) => r.name === "Brightpoint")).toBe(false);
  });
});
