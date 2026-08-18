import { describe, it, expect } from "vitest";
import { sanitizeCallAnalysis } from "./ai";

/**
 * analyzeGongCall's prompt explicitly instructs the model to reuse the call
 * metadata's own topics/action items and leave objections/buyingSignals/
 * competitorsMentioned empty unless evidenced — but nothing checked that it
 * actually did. Confirmed live against call 13 (real metadata:
 * keyTopics ["budget","expansion"], no competitor or buying-signal data): the
 * model returned keyTopics padded with "AI-powered insights" and "operational
 * improvement" (neither in the metadata) plus a buyingSignal
 * ("Technology stack shifts") absent entirely. sanitizeCallAnalysis drops any
 * array entry that doesn't share real text with the call's own metadata.
 */
const callData = {
  title: "Apex Labs — Technical Review",
  sentiment: "neutral",
  keyTopics: ["budget", "expansion"],
  actionItems: ["Provide ROI model", "Follow up with champion"],
};

describe("sanitizeCallAnalysis", () => {
  it("drops the exact fabricated additions observed live, keeps the real ones", () => {
    const modelOutput = {
      summary: "Discussed budget and expansion plans.",
      keyTopics: ["budget", "expansion", "AI-powered insights", "operational improvement"],
      objections: [],
      nextSteps: ["Follow up with champion"],
      sentiment: "neutral",
      buyingSignals: ["Technology stack shifts"],
      competitorsMentioned: [],
      actionItems: ["Provide ROI model", "Follow up with champion"],
    };

    const cleaned = sanitizeCallAnalysis(modelOutput, callData);

    expect(cleaned.keyTopics).toEqual(["budget", "expansion"]);
    expect(cleaned.buyingSignals).toEqual([]);
    expect(cleaned.actionItems).toEqual(["Provide ROI model", "Follow up with champion"]);
    expect(cleaned.nextSteps).toEqual(["Follow up with champion"]);
  });

  it("drops an invented competitor with no basis in the metadata", () => {
    const modelOutput = {
      summary: "x", keyTopics: [], objections: [], nextSteps: [], sentiment: "neutral",
      buyingSignals: [], competitorsMentioned: ["Salesforce", "HubSpot"], actionItems: [],
    };
    const cleaned = sanitizeCallAnalysis(modelOutput, callData);
    expect(cleaned.competitorsMentioned).toEqual([]);
  });

  it("keeps a competitor genuinely named in the metadata", () => {
    const withCompetitor = { ...callData, keyTopics: [...callData.keyTopics, "Salesforce migration"] };
    const modelOutput = {
      summary: "x", keyTopics: [], objections: [], nextSteps: [], sentiment: "neutral",
      buyingSignals: [], competitorsMentioned: ["Salesforce"], actionItems: [],
    };
    const cleaned = sanitizeCallAnalysis(modelOutput, withCompetitor);
    expect(cleaned.competitorsMentioned).toEqual(["Salesforce"]);
  });

  it("leaves summary and sentiment untouched", () => {
    const modelOutput = {
      summary: "A neutral discovery call.", keyTopics: [], objections: [], nextSteps: [],
      sentiment: "positive", buyingSignals: [], competitorsMentioned: [], actionItems: [],
    };
    const cleaned = sanitizeCallAnalysis(modelOutput, callData);
    expect(cleaned.summary).toBe("A neutral discovery call.");
    expect(cleaned.sentiment).toBe("positive");
  });
});
