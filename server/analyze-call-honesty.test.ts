import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * analyzeGongCall's unavailable path returned { summary: LLM_UNAVAILABLE_NOTE,
 * keyTopics: [], ... } with nothing marking the object itself as a failure. Calls.tsx
 * renders the whole response with JSON.stringify under an "Analysis" heading — the
 * apology text was buried inside the summary field, next to several genuinely-empty
 * arrays, and read as "not much happened on this call" rather than "the analysis
 * didn't run."
 */

afterEach(() => {
  vi.doUnmock("./_core/llm");
  vi.resetModules();
});

const callData = {
  id: 1,
  title: "Apex Labs — Technical Review",
  sentiment: "neutral",
  keyTopics: ["budget", "expansion"],
  actionItems: ["Provide ROI model"],
};

describe("analyzeGongCall — model-availability honesty", () => {
  it("marks the result unavailable rather than a clean-but-empty analysis", async () => {
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { content: actual.LLM_UNAVAILABLE_NOTE } }],
        }),
      };
    });

    const { analyzeGongCall } = await import("./ai");
    const result: any = await analyzeGongCall(callData);

    expect(result.available).toBe(false);
    expect(result.summary).toContain("AI generation is unavailable");
  });

  it("marks a real analysis as available", async () => {
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: "Discussed budget and expansion plans.",
                keyTopics: ["budget", "expansion"],
                objections: [],
                nextSteps: ["Provide ROI model"],
                sentiment: "neutral",
                buyingSignals: [],
                competitorsMentioned: [],
                actionItems: ["Provide ROI model"],
              }),
            },
          }],
        }),
      };
    });

    const { analyzeGongCall } = await import("./ai");
    const result: any = await analyzeGongCall(callData);

    expect(result.available).toBe(true);
    expect(result.summary).toBe("Discussed budget and expansion plans.");
  });
});
