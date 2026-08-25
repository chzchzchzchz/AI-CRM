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
            orderBy: () => Promise.reject(new Error("connection reset")),
          }),
        }),
      }),
    }));

    const { detectIntentSpikes } = await import("./spikes");
    await expect(detectIntentSpikes()).rejects.toThrow(/connection reset/);
  });

  it("still returns [] when the database genuinely has no rows (not an error)", async () => {
    vi.doMock("../db", () => ({
      getDb: async () => ({
        // intentScores is queried with .orderBy(); accounts is awaited straight off
        // .from() with no further chaining — `await []` resolves to `[]` either way,
        // so returning a plain array here satisfies both call shapes.
        select: () => ({ from: () => Object.assign([], { orderBy: () => [] }) }),
      }),
    }));

    const { detectIntentSpikes } = await import("./spikes");
    await expect(detectIntentSpikes()).resolves.toEqual([]);
  });

  it("returns [] when there is genuinely no database configured (not an error either)", async () => {
    vi.doMock("../db", () => ({ getDb: async () => null }));

    const { detectIntentSpikes } = await import("./spikes");
    await expect(detectIntentSpikes()).resolves.toEqual([]);
  });
});
