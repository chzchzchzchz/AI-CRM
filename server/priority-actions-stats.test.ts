import { describe, it, expect, vi } from "vitest";

/**
 * getRepStats computes a "6QA opportunity gap" — hot accounts (intent >= 70) with no
 * opportunity yet — by diffing all accounts against every opportunity's accountId. It
 * fetched opportunities via `getAllOpportunities().catch(() => [])`, so a genuine query
 * failure (not "no opportunities exist", but the fetch itself throwing) was silently
 * treated as "there are zero opportunities anywhere" — which inflates sixQAGap to the
 * maximum possible value (every hot account) instead of surfacing the failure. A rep
 * reading that number during an outage would see a manufactured coverage crisis with no
 * indication anything had gone wrong. getAllAccounts, fetched two lines above with no
 * such catch, already fails loudly the correct way — the opportunities fetch is now
 * consistent with it.
 */

vi.mock("./db", () => ({
  getAllAccounts: vi.fn(),
  getAllOpportunities: vi.fn(),
}));

const anyCtx = (overrides: Partial<{ email: string }> = {}) => ({
  user: { id: 1, email: overrides.email ?? "rep@example.com", role: "user" },
}) as any;

describe("priorityActions.getRepStats", () => {
  it("propagates a genuine opportunities-fetch failure instead of reporting a manufactured gap", async () => {
    const { getAllAccounts, getAllOpportunities } = await import("./db");
    (getAllAccounts as any).mockResolvedValue([
      { id: 1, intentScore: 90, region: "East", employeeCount: 500 },
      { id: 2, intentScore: 85, region: "East", employeeCount: 500 },
    ]);
    (getAllOpportunities as any).mockRejectedValue(new Error("connection reset"));

    const { priorityActionsRouter } = await import("./priority-actions-router");
    const caller = priorityActionsRouter.createCaller(anyCtx());

    await expect(caller.getRepStats({})).rejects.toThrow();
  });

  it("still reports the real gap when the fetch succeeds", async () => {
    const { getAllAccounts, getAllOpportunities } = await import("./db");
    (getAllAccounts as any).mockResolvedValue([
      { id: 1, intentScore: 90, region: "East", employeeCount: 500 }, // hot, has opp
      { id: 2, intentScore: 85, region: "East", employeeCount: 500 }, // hot, no opp
      { id: 3, intentScore: 10, region: "East", employeeCount: 500 }, // cold, no opp
    ]);
    (getAllOpportunities as any).mockResolvedValue([{ id: 501, accountId: 1 }]);

    const { priorityActionsRouter } = await import("./priority-actions-router");
    const caller = priorityActionsRouter.createCaller(anyCtx());

    const result = await caller.getRepStats({});
    expect(result.sixQAGap).toBe(1);
    expect(result.hotLeads).toBe(2);
  });
});
