import { describe, it, expect, vi } from "vitest";

/**
 * Three call sites in the "trust the numbers" layer — crawlSnapshot (server/intel/brain.ts),
 * gatherAccountSignals (server/intel/signals.ts) and loadReal (server/sixsense-analytics.ts)
 * — fetched their underlying data with `.catch(() => [])` on each Promise.all branch. Every
 * one of those db functions already returns [] on its own when there's genuinely no database
 * configured, so the catch only ever fired on a real query failure mid-connection — and
 * turned it into a fully-formed, well-typed all-zero result that every consumer treats as
 * "verified figures." A rep or an AI brief reading "0 hot accounts, 0 opportunities" during
 * an outage would see a confident, wrong answer with no indication anything had broken.
 */

vi.mock("../db", () => ({
  getAllAccounts: vi.fn(),
  getAllPeople: vi.fn(),
  getAllGongCalls: vi.fn(),
  getAllOpportunities: vi.fn(),
  getDb: vi.fn(),
  getAccountById: vi.fn(),
  getContactsByAccountId: vi.fn(),
  getGongCallsByAccountId: vi.fn(),
  getOpportunitiesByAccountId: vi.fn(),
}));

describe("crawlSnapshot", () => {
  it("propagates a genuine fetch failure instead of an all-zero 'verified' snapshot", async () => {
    const db = await import("../db");
    (db.getAllAccounts as any).mockResolvedValue([{ id: 1, intentScore: 90, industry: "SaaS" }]);
    (db.getAllPeople as any).mockResolvedValue([]);
    (db.getAllGongCalls as any).mockResolvedValue([]);
    (db.getAllOpportunities as any).mockRejectedValue(new Error("connection reset"));

    const { crawlSnapshot } = await import("./brain");
    await expect(crawlSnapshot()).rejects.toThrow(/connection reset/);
  });
});

describe("gatherAccountSignals", () => {
  it("propagates a genuine fetch failure instead of reporting zero contacts/calls/opps", async () => {
    const db = await import("../db");
    (db.getAccountById as any).mockResolvedValue({ id: 42, name: "Acme" });
    (db.getContactsByAccountId as any).mockRejectedValue(new Error("query timeout"));
    (db.getGongCallsByAccountId as any).mockResolvedValue([]);
    (db.getOpportunitiesByAccountId as any).mockResolvedValue([]);

    const { gatherAccountSignals } = await import("./signals");
    await expect(gatherAccountSignals(42)).rejects.toThrow(/query timeout/);
  });
});

describe("sixsenseAnalytics loadReal (via getBuyingStages)", () => {
  it("propagates a genuine fetch failure instead of an empty analytics dashboard", async () => {
    const db = await import("../db");
    (db.getDb as any).mockResolvedValue({
      select: () => ({ from: () => Promise.resolve([]) }),
    });
    (db.getAllAccounts as any).mockRejectedValue(new Error("db unreachable"));
    (db.getAllOpportunities as any).mockResolvedValue([]);
    (db.getAllPeople as any).mockResolvedValue([]);
    (db.getAllGongCalls as any).mockResolvedValue([]);

    const { sixsenseAnalyticsRouter } = await import("../sixsense-analytics");
    const caller = sixsenseAnalyticsRouter.createCaller({ user: { id: 1, role: "user" } } as any);
    await expect(caller.getBuyingStages()).rejects.toThrow(/db unreachable/);
  });
});
