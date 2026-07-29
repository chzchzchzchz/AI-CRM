import { describe, it, expect } from "vitest";
import { isLlmUnavailable, LLM_UNAVAILABLE_NOTE } from "./_core/llm";

/**
 * When no model can be reached, invokeLLM returns a readable note instead of
 * throwing — which is right, and was also invisible to every caller. They took
 * `choices[0].message.content` and passed it on, so Content Studio showed a
 * "Content generated" toast, titled the panel "Generated Blog Post", filled it with
 * the apology, and wrote it to the content library as a real asset.
 *
 * This predicate is what lets a caller tell the difference. If it ever returns
 * false for a genuine degradation, that whole failure comes back.
 */
describe("isLlmUnavailable", () => {
  it("recognises the note it ships with", () => {
    expect(isLlmUnavailable(LLM_UNAVAILABLE_NOTE)).toBe(true);
  });

  it("recognises the note when a caller has wrapped it", () => {
    expect(isLlmUnavailable(`Here you go:\n\n${LLM_UNAVAILABLE_NOTE}`)).toBe(true);
  });

  it("recognises the JSON form used for structured output", () => {
    expect(isLlmUnavailable(JSON.stringify({ available: false, note: LLM_UNAVAILABLE_NOTE }))).toBe(true);
  });

  it("does not fire on real model output", () => {
    expect(isLlmUnavailable("Subject: Following up on your HIPAA audit\n\nHi David,")).toBe(false);
    expect(isLlmUnavailable("# Blog post outline\n\n1. Hook\n2. The problem")).toBe(false);
  });

  it("does not fire on prose that merely mentions AI or Ollama", () => {
    // A battle card about a competitor's local-model story is not a degradation.
    expect(isLlmUnavailable("Their pitch leans on Ollama for on-prem inference.")).toBe(false);
    expect(isLlmUnavailable("The account said their AI budget is unavailable this quarter.")).toBe(false);
  });

  it("does not fire on structured output that happens to have an available field", () => {
    expect(isLlmUnavailable(JSON.stringify({ available: true, note: "all good" }))).toBe(false);
    expect(isLlmUnavailable(JSON.stringify({ available: false }))).toBe(false); // no note
  });

  it("handles non-strings without throwing", () => {
    expect(isLlmUnavailable(null)).toBe(false);
    expect(isLlmUnavailable(undefined)).toBe(false);
    expect(isLlmUnavailable(42)).toBe(false);
    expect(isLlmUnavailable({ available: false, note: "x" })).toBe(false);
  });
});
