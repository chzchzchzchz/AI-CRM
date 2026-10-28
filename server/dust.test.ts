import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Confirmed live via an automated sweep of every procedure in the app: with no
 * DUST_API_KEY set, dust.query threw a raw "Unexpected non-whitespace character
 * after JSON at position 4" SyntaxError instead of an actionable message — the
 * only integration in the app that didn't check its own config before firing.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.DUST_API_KEY;
  delete process.env.DUST_WORKSPACE_ID;
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("queryDust — unconfigured", () => {
  it("rejects with an actionable message instead of a raw parse error", async () => {
    const { queryDust } = await import("./dust");
    await expect(queryDust("test query")).rejects.toThrow(
      /Dust is not configured/i
    );
  });

  it("never reaches fetch when unconfigured", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const { queryDust } = await import("./dust");
    await expect(queryDust("test query")).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
