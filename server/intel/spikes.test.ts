import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * detectIntentSpikes caught a genuine query failure into the same [] as "checked, no
 * spikes right now" — "no database configured" is already handled separately (a
 * legitimate, distinct []), so this catch only ever fired on a real error. One caller
 * (aiContext.ts's chat-context builder) turned an empty array directly into the literal
 * claim "No recent intent spikes detected", fed straight to the model as fact. A DB
 * hiccup during a rep's chat question would have the assistant confidently tell them
 * nothing is happening, when the truth is nobody checked.
 */

afterEach(() => {
  vi.doUnmock("../db");
  vi.resetModules();
});

describe("detectIntentSpikes", () => {
  it("propagates a genuine query failure instead of reporting a quiet week", async () => {
    vi.doMock("../db", () => ({
      getDb: async () => ({
        select: () => ({
          from: () => ({
            // Both reads are org-scoped now, so `.where()` sits between `.from()` and
            // `.orderBy()`; the accounts read ends at `.where()` and is awaited there.
            //
            // One shared rejection rather than two. Promise.all settles on the first, and
            // a second, independently-created rejected promise would be left unconsumed —
            // an unhandled rejection warning from the test's own scaffolding, which is
            // exactly the kind of noise that gets a real one ignored later.
            where: () => {
              const failure = Promise.reject(new Error("connection reset"));
              failure.catch(() => {});
              return Object.assign(
                { then: (...args: any[]) => (failure as any).then(...args) },
                { orderBy: () => failure }
              );
            },
          }),
        }),
      }),
    }));

    const { detectIntentSpikes } = await import("./spikes");
    await expect(detectIntentSpikes({ orgId: 1 })).rejects.toThrow(/connection reset/);
  });

  it("still returns [] when the database genuinely has no rows (not an error)", async () => {
    vi.doMock("../db", () => ({
      getDb: async () => ({
        // Both reads go .from().where(); the intent one then chains .orderBy(). An array
        // with an orderBy property satisfies both — `await []` resolves to `[]`.
        select: () => ({
          from: () => ({ where: () => Object.assign([], { orderBy: () => [] }) }),
        }),
      }),
    }));

    const { detectIntentSpikes } = await import("./spikes");
    await expect(detectIntentSpikes({ orgId: 1 })).resolves.toEqual([]);
  });

  it("returns [] when there is genuinely no database configured (not an error either)", async () => {
    vi.doMock("../db", () => ({ getDb: async () => null }));

    const { detectIntentSpikes } = await import("./spikes");
    await expect(detectIntentSpikes({ orgId: 1 })).resolves.toEqual([]);
  });
});
