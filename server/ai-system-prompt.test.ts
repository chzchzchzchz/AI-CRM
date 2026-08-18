import { describe, it, expect } from "vitest";
import { asRevenueArchitect, STANDARDIZED_OUTPUT_STRUCTURE } from "./ai-system-prompt";

/**
 * asRevenueArchitect() used to append STANDARDIZED_OUTPUT_STRUCTURE (EXECUTIVE
 * SUMMARY / STAKEHOLDERS TABLE / TALKING POINTS / NEXT ACTIONS / RISKS & OBJECTIONS)
 * to every prompt built with it, regardless of what the task actually asked for.
 * Three of its four real callers ask for something else entirely — an outreach
 * email, arbitrary content-studio copy, webinar promo copy — and telling a model
 * "write a LinkedIn message" immediately followed by "your response MUST include
 * these sections: EXECUTIVE SUMMARY, STAKEHOLDERS TABLE..." is a self-contradictory
 * prompt, not a neutral one.
 *
 * Confirmed live: generateContent(contentType: "email") returned an account-brief-
 * shaped response instead of an email, and generateContent(contentType:
 * "call_script") returned a hallucinated fake "SECURITY-BLOCKED-RESPONSE /
 * DENY-ACCESS-SELF" refusal as successful content. Both reproduced myself against
 * the running server; both stopped reproducing after this fix.
 */
describe("asRevenueArchitect", () => {
  it("does not include the account-brief structure by default", () => {
    const prompt = asRevenueArchitect("Write a personalized outreach email.");
    expect(prompt).not.toContain("EXECUTIVE SUMMARY");
    expect(prompt).not.toContain("STAKEHOLDERS TABLE");
    expect(prompt).not.toContain(STANDARDIZED_OUTPUT_STRUCTURE);
  });

  it("still includes the task and the injection guard", () => {
    const prompt = asRevenueArchitect("Write a LinkedIn connection request.");
    expect(prompt).toContain("Write a LinkedIn connection request.");
    expect(prompt).toContain("TRUST BOUNDARY");
  });

  it("can still opt into the structure for a genuine account-brief task", () => {
    const prompt = asRevenueArchitect(
      "Analyze this target account and provide tactical sales intelligence.",
      undefined,
      { includeStandardStructure: true }
    );
    expect(prompt).toContain("EXECUTIVE SUMMARY");
    expect(prompt).toContain("STAKEHOLDERS TABLE");
  });
});
