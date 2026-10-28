import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeLLM = vi.fn();

vi.mock("./_core/llm", () => ({
  invokeLLM: (...a: unknown[]) => invokeLLM(...a),
  llmText: (r: any) => {
    const content = r?.choices?.[0]?.message?.content ?? "";
    return { content, available: content.length > 0 && !content.includes("UNAVAILABLE_SENTINEL") };
  },
  LLM_UNAVAILABLE_NOTE: "No model configured.",
}));

vi.mock("./db", () => ({
  getDb: async () => null, // skip caching entirely for these tests
}));

vi.mock("./config", () => ({
  getCompanyContext: () => "Acme Inc.",
  getCompanyConfig: () => ({ reps: [], supportContact: "support@acme.test" }),
}));

const reply = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  invokeLLM.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

describe("deepThink", () => {
  it("skips layer 2 and returns the degradation note as-is when layer 1 is unavailable", async () => {
    // Layer 1 fails to reach a model — this is the ONLY invokeLLM call that should
    // happen. If layer 2 also fires, it will receive the degradation note as a
    // "REASONING LOG FROM BACKEND" and rewrite it into something that reads like real
    // advice, which is exactly the fabrication this test guards against.
    invokeLLM.mockResolvedValueOnce(reply("UNAVAILABLE_SENTINEL: no model reachable."));

    const { deepThink } = await import("./deep-think");
    const result = await deepThink({ query: "What should I focus on this week?", skipCache: true });

    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe("UNAVAILABLE_SENTINEL: no model reachable.");
    expect(result.reasoning).toBeUndefined();
    expect(result.available).toBe(false);
  });

  it("runs both layers and returns the synthesized answer when the model is available", async () => {
    invokeLLM
      .mockResolvedValueOnce(reply("<reasoning>step one, step two</reasoning>"))
      .mockResolvedValueOnce(reply("Here's a polished answer."));

    const { deepThink } = await import("./deep-think");
    const result = await deepThink({ query: "What should I focus on this week?", skipCache: true });

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(result.answer).toBe("Here's a polished answer.");
    expect(result.available).toBe(true);
  });

  it("reports available:false when the synthesis layer is unreachable", async () => {
    // Layer 1 (reasoning) succeeds; layer 2 (synthesis) is the one that's down —
    // exercises the exact call site the bug was in.
    invokeLLM
      .mockResolvedValueOnce(reply("<reasoning>some reasoning</reasoning>"))
      .mockResolvedValueOnce(reply("UNAVAILABLE_SENTINEL: AI generation is unavailable."));

    const { deepThink } = await import("./deep-think");
    const result = await deepThink({ query: "What accounts need attention?", skipCache: true });

    expect(result.available).toBe(false);
    expect(result.answer).toBe("No model configured.");
  });

  it("reports available:true with the real synthesized answer when the model responds", async () => {
    invokeLLM
      .mockResolvedValueOnce(reply("reasoning about the accounts"))
      .mockResolvedValueOnce(reply("Acme Corp has the highest intent score this week."));

    const { deepThink } = await import("./deep-think");
    const result = await deepThink({ query: "What accounts need attention?", skipCache: true });

    expect(result.available).toBe(true);
    expect(result.answer).toBe("Acme Corp has the highest intent score this week.");
  });
});
