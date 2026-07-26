import { describe, it, expect } from "vitest";
import { renderContext, withFacts, GROUNDING_RULE } from "./ai-context-block";

describe("renderContext", () => {
  it("labels keys in readable form", () => {
    const out = renderContext({ accountName: "Vertex", intentScore: 92 });
    expect(out).toContain("### Account Name");
    expect(out).toContain("### Intent Score");
  });

  it("marks empty values as explicitly unknown rather than dropping them", () => {
    // A dropped field looks like it was never asked for; a stated gap is a fact
    // the model can report honestly.
    const out = renderContext({ phone: null, email: "", notes: undefined, name: "Vertex" });
    expect(out).toContain("(not available)");
    expect(out).toContain("Vertex");
  });

  it("renders scalar arrays inline", () => {
    const out = renderContext({ techStack: ["Okta", "Snowflake", "Segment"] });
    expect(out).toContain("Okta, Snowflake, Segment");
  });

  it("renders arrays of objects as numbered entries", () => {
    const out = renderContext({
      contacts: [
        { name: "Nina Khan", title: "CRO" },
        { name: "Carlos Park", title: "Head of Sales Enablement" },
      ],
    });
    expect(out).toContain("[1]");
    expect(out).toContain("[2]");
    expect(out).toContain("Nina Khan");
    expect(out).toContain("Carlos Park");
  });

  it("renders nested objects without losing their labels", () => {
    const out = renderContext({ intent: { score: 92, trend: "rising", buyingStage: "Decision" } });
    expect(out).toContain("Score: 92");
    expect(out).toContain("Trend: rising");
    expect(out).toContain("Buying Stage: Decision");
  });

  it("is deterministic for the same input", () => {
    const input = { a: 1, b: { c: "x", d: [1, 2] } };
    expect(renderContext(input)).toBe(renderContext(input));
  });

  it("returns empty string when there is nothing to say", () => {
    expect(renderContext({})).toBe("");
  });

  it("does not throw on null nested inside an object", () => {
    expect(() => renderContext({ account: { name: "X", parent: null } })).not.toThrow();
  });
});

describe("withFacts", () => {
  it("returns the task untouched when there are no facts", () => {
    expect(withFacts("Do the thing")).toBe("Do the thing");
    expect(withFacts("Do the thing", {})).toBe("Do the thing");
  });

  it("attaches the grounding rule and a FACTS block when facts exist", () => {
    const out = withFacts("Write an email", { accountName: "Vertex" });
    expect(out).toContain(GROUNDING_RULE);
    expect(out).toContain("## FACTS");
    expect(out).toContain("Write an email");
    expect(out).toContain("Vertex");
  });

  it("puts the grounding rule before the task, so the constraint is read first", () => {
    const out = withFacts("Write an email", { accountName: "Vertex" });
    expect(out.indexOf(GROUNDING_RULE)).toBeLessThan(out.indexOf("Write an email"));
  });

  it("states the boundary the validator later enforces", () => {
    // generateAccountBrief strips unverifiable claims after the fact; the prompt
    // should ask for the same discipline up front.
    expect(GROUNDING_RULE).toMatch(/only what appears in FACTS/i);
    expect(GROUNDING_RULE).toMatch(/not available/i);
  });
});
