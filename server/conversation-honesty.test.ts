import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * conversationWithMemory returned { answer, insights } with no `available` flag, so
 * when no model was reachable `answer` was LLM_UNAVAILABLE_NOTE with nothing to tell a
 * caller apart from a real reply. Both chat surfaces that call this (GlobalAIChat.tsx —
 * the single instance shared across nearly every page — and AIAssistant.tsx) set the
 * assistant's chat bubble straight from `result.answer`, so the outage note rendered as
 * if the assistant had genuinely replied, in the same bubble style as a real answer.
 */

const DB = path.join(process.cwd(), "demo-db.test-conversation.json");
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

describe("conversationWithMemory — model-availability honesty", () => {
  it("reports available:false and does not present the outage note as a reply", async () => {
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: actual.LLM_UNAVAILABLE_NOTE } }],
        }),
      };
    });

    const { conversationWithMemory } = await import("./aiContext");
    const result = await conversationWithMemory({ query: "What's our pipeline looking like?" });

    expect(result.available).toBe(false);
    expect(result.answer).toContain("AI generation is unavailable");
  });

  it("reports available:true with the real answer when the model responds", async () => {
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: "You have 12 open opportunities worth $1.2M." } }],
        }),
      };
    });

    const { conversationWithMemory } = await import("./aiContext");
    const result = await conversationWithMemory({ query: "What's our pipeline looking like?" });

    expect(result.available).toBe(true);
    expect(result.answer).toBe("You have 12 open opportunities worth $1.2M.");
  });
});
