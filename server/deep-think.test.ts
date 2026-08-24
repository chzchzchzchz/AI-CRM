import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * deepThink's DeepThinkResult had no `available` field at all. When no model was
 * reachable, it returned `{ answer: LLM_UNAVAILABLE_NOTE, ... }` — an ordinary,
 * successful-looking string. Both of this app's chat surfaces read it the same way:
 * `response.answer || fallback` — a non-empty degradation note is truthy, so it passed
 * straight through and rendered in the chat as if a model had actually answered.
 * ContextualAI.tsx is used from Accounts/Contacts/Home/Calls/Insights/account and
 * contact detail pages; SupportBot.tsx is the dashboard's help widget. Both are wired
 * through deepThinkSales/deepThinkHelp, which both delegate to this same function.
 */

const DB = path.join(process.cwd(), "demo-db.test-deep-think.json");
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.doUnmock("./_core/llm");
  vi.resetModules();
});

describe("deepThink — model-availability honesty", () => {
  it("reports available:false when the synthesis layer is unreachable", async () => {
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        // Layer 1 (reasoning) succeeds; layer 2 (synthesis) is the one that's down —
        // exercises the exact call site the bug was in.
        invokeLLM: vi.fn()
          .mockResolvedValueOnce({ choices: [{ message: { content: "some reasoning" } }] })
          .mockResolvedValueOnce({ choices: [{ message: { content: actual.LLM_UNAVAILABLE_NOTE } }] }),
      };
    });

    const { deepThink } = await import("./deep-think");
    const result = await deepThink({ query: "What accounts need attention?", skipCache: true });

    expect(result.available).toBe(false);
    expect(result.answer).toContain("AI generation is unavailable");
  });

  it("reports available:true with the real synthesized answer when the model responds", async () => {
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn()
          .mockResolvedValueOnce({ choices: [{ message: { content: "reasoning about the accounts" } }] })
          .mockResolvedValueOnce({ choices: [{ message: { content: "Acme Corp has the highest intent score this week." } }] }),
      };
    });

    const { deepThink } = await import("./deep-think");
    const result = await deepThink({ query: "What accounts need attention?", skipCache: true });

    expect(result.available).toBe(true);
    expect(result.answer).toBe("Acme Corp has the highest intent score this week.");
  });
});
