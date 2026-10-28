import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext } from "./test-utils";

/**
 * A transcript report's shareId is a bearer capability: anyone who has it can read
 * the report via the public getReportByShareId endpoint, no auth required. It was
 * generated with Math.random() — not cryptographically secure, and (per published
 * research on V8's xorshift128+ generator) reconstructible from a handful of
 * observed outputs, which a user who's created a few of their own shared reports
 * would have. Every comparable token in this app (admin-router.ts's temp password,
 * twofa.ts's challenge ids, email-verification-router.ts's codes) already uses
 * crypto.randomBytes; this was the one holdout.
 */

const DB = path.join(process.cwd(), "demo-db.test-share-id.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

describe("saveTranscriptReport — shareId generation", () => {
  it("uses crypto.randomBytes, not Math.random", async () => {
    const mathRandomSpy = vi.spyOn(Math, "random");
    const crypto = await import("crypto");
    const randomBytesSpy = vi.spyOn(crypto.default, "randomBytes");

    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);

    const result = await caller.saveTranscriptReport({
      name: "Test report",
      transcript: "some transcript text",
      analysis: { topRisks: [] },
    });

    expect(randomBytesSpy).toHaveBeenCalled();
    expect(mathRandomSpy).not.toHaveBeenCalled();
    expect(result.shareId).toBeTruthy();
    expect(result.shareId.length).toBeGreaterThanOrEqual(16);

    mathRandomSpy.mockRestore();
    randomBytesSpy.mockRestore();
  });

  it("generates a different shareId on every call", async () => {
    const { toolsRouter } = await import("./tools-router");
    const caller = toolsRouter.createCaller(mockAuthContext);

    const a = await caller.saveTranscriptReport({
      name: "Report A", transcript: "text a", analysis: {},
    });
    const b = await caller.saveTranscriptReport({
      name: "Report B", transcript: "text b", analysis: {},
    });

    expect(a.shareId).not.toBe(b.shareId);
  });
});
