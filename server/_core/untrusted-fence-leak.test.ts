import { describe, it, expect } from "vitest";
import { stripLeakedFence, stripLeakedFenceDeep } from "./untrusted";

/**
 * wrapUntrusted()'s fence marker is internal structure, not content — but with
 * nothing real to reference for a missing field, a model can echo it back as a
 * stand-in value. Confirmed live: asked to write webinar promo copy from generic
 * material naming no company, a model wrote "[untrusted-data:7f3c]'s security
 * posture" (and five more variants of the same) directly into generated copy that
 * would have gone straight to a rep as real marketing content.
 */
describe("stripLeakedFence", () => {
  it("replaces the exact leaked pattern observed live", () => {
    const leaked = "As a key decision-maker in [untrusted-data:7f3c]'s IT/security strategy";
    const cleaned = stripLeakedFence(leaked);
    expect(cleaned).not.toContain("untrusted-data:7f3c");
    expect(cleaned).toContain("[Company Name]'s IT/security strategy");
  });

  it("catches the raw guillemet form too, not just the bracket paraphrase", () => {
    const leaked = "Contact «untrusted-data:7f3c» about the deal.";
    expect(stripLeakedFence(leaked)).not.toContain("untrusted-data:7f3c");
  });

  it("leaves ordinary text with no leak completely unchanged", () => {
    const clean = "Acme Corp's security posture improved 40% after adoption.";
    expect(stripLeakedFence(clean)).toBe(clean);
  });
});

describe("stripLeakedFenceDeep", () => {
  it("cleans every string leaf in a nested generation response", () => {
    const leaked = {
      landingPage: { headline: "Secure [untrusted-data:7f3c]'s Future", bullets: ["Case study: [untrusted-data:7f3c] cut costs 30%"] },
      emailSequence: { invite: { subject: "Hi", body: "Dear [untrusted-data:7f3c] team" } },
    };
    const cleaned = stripLeakedFenceDeep(leaked);
    expect(JSON.stringify(cleaned)).not.toContain("untrusted-data:7f3c");
    expect(cleaned.landingPage.headline).toBe("Secure [Company Name]'s Future");
    expect(cleaned.emailSequence.invite.body).toBe("Dear [Company Name] team");
  });
});
