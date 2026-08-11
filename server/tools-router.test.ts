import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthContext } from "./test-utils";

// Mock the database so saveTranscriptReport / getSavedTranscriptReports paths
// (not under test here) don't need a real connection.
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

describe("tools.analyzeTranscript", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws a clear error instead of returning a mismatched shape to the client", async () => {
    // Regression test: observed live against the free-tier OpenRouter fallback model,
    // which does not reliably honor response_format.json_schema. It returned a
    // "prospectInsights"-wrapped object instead of the flat { aboutProspect, topRisks,
    // ... } shape declared in the schema. Before the fix, that JSON was trusted as-is
    // and handed to the client, which crashed with "Cannot read properties of
    // undefined (reading 'jobTitle')" because result.aboutProspect was undefined.
    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              role: "assistant",
              content: JSON.stringify({
                prospectInsights: {
                  prospect: "Priya Deshmukh - Zorblatt Industries",
                  useCase: "Logistics platform",
                },
                linkedAccount: null,
              }),
            },
          }],
        }),
      };
    });

    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);

    await expect(
      caller.analyzeTranscript({
        transcript: "A".repeat(150), // satisfies the 100-char minimum
      })
    ).rejects.toThrow(/unexpected format/i);

    vi.doUnmock("./_core/llm");
  });

  it("returns the analysis as-is when the model honors the schema", async () => {
    const wellFormed = {
      aboutProspect: {
        jobTitle: "VP of Platform Engineering",
        industry: "Logistics",
        companyName: "Zorblatt Industries",
        aiToolsUsed: { enterprise: ["Zendesk AI"], other: ["Cursor"] },
        aiUsageContext: "Support and engineering teams use AI tooling daily.",
      },
      topRisks: ["Shadow IT: unapproved AI browser extensions"],
      topChallenges: ["GDPR exposure from EU freight data"],
      currentSecurityStack: { toolsUsed: ["Okta", "Crowdstrike"], toolsConsidered: ["Netskope"] },
      budgetTimelinePriority: "$80k allocated for Q1, top-3 CISO initiative.",
      urgencyDrivers: "Hard freeze starting in November.",
      feedbackPoints: ["Liked the automatic redaction feature."],
      betaInterest: { interestLevel: "High", apprehensions: "Deployment time before freeze", interestQuote: "Yes, let's do it." },
      topQuotes: ["Yes, let's do it. Send the contract to legal@zorblatt.com."],
      additionalInsights: [],
      nextSteps: ["Send pilot contract for 20 seats"],
    };

    vi.doMock("./_core/llm", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./_core/llm")>();
      return {
        ...actual,
        invokeLLM: vi.fn().mockResolvedValue({
          choices: [{ message: { role: "assistant", content: JSON.stringify(wellFormed) } }],
        }),
      };
    });

    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);

    const result = await caller.analyzeTranscript({ transcript: "B".repeat(150) });

    expect(result.aboutProspect.companyName).toBe("Zorblatt Industries");
    expect(result.topRisks).toEqual(wellFormed.topRisks);
    expect(result.linkedAccount).toBeNull();

    vi.doUnmock("./_core/llm");
  });

  it("rejects transcripts over the 40,000 character limit", async () => {
    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);

    await expect(
      caller.analyzeTranscript({ transcript: "A".repeat(40_001) })
    ).rejects.toThrow();
  });
});
