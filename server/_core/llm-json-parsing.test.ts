import { describe, it, expect } from "vitest";
import { parseLlmJson } from "./llm";

/**
 * response_format: json_schema is silently downgraded to json_object for every
 * non-Forge provider (server/_core/llm.ts payloadFor — "smaller models are unreliable
 * with strict json_schema"). json_object mode only guarantees the response CONTAINS
 * valid JSON, not that it IS the response with nothing else. Every one of the nine
 * call sites that JSON.parse a model's answer used to fail outright the moment a
 * model wrapped its JSON in a markdown fence or added a sentence of preamble — both
 * ordinary, common behavior for a free-tier model, not a sign anything was actually
 * wrong with the request. Confirmed live: tools.generateWebinarContent failed with
 * "wasn't valid JSON" against this app's own default fallback chain.
 */
describe("parseLlmJson", () => {
  it("parses bare JSON unchanged — the common case", () => {
    expect(parseLlmJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON wrapped in a ```json fence", () => {
    const wrapped = '```json\n{"landingPage":{"headline":"Hi"}}\n```';
    expect(parseLlmJson(wrapped)).toEqual({ landingPage: { headline: "Hi" } });
  });

  it("extracts JSON wrapped in a bare ``` fence with no language tag", () => {
    const wrapped = '```\n{"a":1}\n```';
    expect(parseLlmJson(wrapped)).toEqual({ a: 1 });
  });

  it("extracts a JSON object preceded and followed by prose", () => {
    const wrapped = 'Here is the analysis:\n\n{"summary":"ok","score":5}\n\nLet me know if you need anything else!';
    expect(parseLlmJson(wrapped)).toEqual({ summary: "ok", score: 5 });
  });

  it("extracts a JSON array the same way", () => {
    const wrapped = 'Sure, here are the rankings:\n[{"id":1},{"id":2}]';
    expect(parseLlmJson(wrapped)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("handles nested braces inside the JSON without truncating", () => {
    const wrapped = 'Result: {"a":{"b":{"c":1}}} done.';
    expect(parseLlmJson(wrapped)).toEqual({ a: { b: { c: 1 } } });
  });

  it("still throws for genuinely non-JSON output, same as a bare JSON.parse would", () => {
    expect(() => parseLlmJson("I cannot help with that request.")).toThrow();
  });

  it("re-throws the same error type callers' existing catch blocks expect", () => {
    let threw: unknown;
    try {
      parseLlmJson("not json at all, no braces");
    } catch (e) {
      threw = e;
    }
    expect(threw).toBeInstanceOf(SyntaxError);
  });
});
