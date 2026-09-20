import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "test-user", email: "test@example.com", name: "Test User",
      loginMethod: "manus", role: "user",
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    } as NonNullable<TrpcContext["user"]>,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("integration endpoints", () => {
  beforeAll(() => { process.env.DEMO_MODE = "true"; });

  it("intentScores.create then list returns the score", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.intentScores.create({ accountId: 1, score: 77, category: "Security", keywords: ["Zero Trust"], source: "6sense" });
    expect(res.success).toBe(true);
    const list = await caller.intentScores.list({ accountId: 1 });
    expect(Array.isArray(list)).toBe(true);
    expect(list.some((s: any) => s.score === 77 && s.source === "6sense")).toBe(true);
  });

  it("calls.create inserts a call", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.calls.create({ title: "Discovery Call - Test", accountId: 1, sentiment: "Positive", keyTopics: ["budget"] });
    expect(res.success).toBe(true);
  });

  it("rfps.create inserts an RFP", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.rfps.create({ title: "Cybersecurity Services Contract", agency: "DoD", status: "open" });
    expect(res.success).toBe(true);
  });

  it("zapier.webhook accepts an event in demo mode", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.zapier.webhook({ event: "account.enriched", data: { accountId: 1 } });
    expect(res.received).toBe(true);
    expect(res.event).toBe("account.enriched");
  });

  it("zapier.webhook does not report storing an event it drops", async () => {
    // Nothing reads these events — no store, no queue, no handler. `{ received: true }`
    // on its own was the problem: Zapier shows any 2xx as a successful run, so someone
    // wiring a Zap to POST enrichment here — which INTEGRATIONS.md told them to do —
    // would watch it go green on every call, forever, while nothing appeared in the app.
    const caller = appRouter.createCaller(createAuthContext());
    const res: any = await caller.zapier.webhook({
      event: "account.enriched",
      data: { domain: "acme.com", employees: 1200 },
    });
    expect(res.stored).toBe(false);
    expect(res.note).toMatch(/nothing consumes these events/i);
  });

  it("clayPull.triggerEnrichment reports not-configured without CLAY_WEBHOOK_URL", async () => {
    delete process.env.CLAY_WEBHOOK_URL;
    const caller = appRouter.createCaller(createAuthContext());
    const res = await caller.clayPull.triggerEnrichment({ domain: "acme.com" });
    expect(res.success).toBe(false);
  });
});
