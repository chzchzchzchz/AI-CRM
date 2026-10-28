import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * clayImport.importRawData / importAccounts always answered `success: true`, even when
 * every row failed. There is no client UI for either procedure (see inventory.ts: "bulk
 * import — driven by a Clay export or automation") — the realistic caller is an external
 * automation that checks `success` first, the normal fast path. An upstream Clay export
 * renaming or dropping its domain column fails every row identically; the automation
 * saw `success: true, errors: N, total: N` and had no reason to look closer or retry.
 */

const DB = path.join(process.cwd(), "demo-db.test-clay-import.json");
const ORIGINAL_ENV = { ...process.env };

const anyCtx = () => ({ req: {} as any, res: {} as any, user: { id: 1, role: "user" } }) as any;

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

describe("clayImport.importRawData — failure honesty", () => {
  it("reports success:false when every row is missing a domain and nothing imports", async () => {
    const { clayImportRouter } = await import("./clay-import");
    const caller = clayImportRouter.createCaller(anyCtx());

    // No recognizable domain column at all — the exact shape of a renamed/dropped
    // column in an upstream Clay export.
    const result: any = await caller.importRawData({
      rawData: JSON.stringify([{ notes: "hello" }, { notes: "world" }]),
    });

    expect(result.imported).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.errors).toBe(2);
    expect(result.success).toBe(false);
  });

  it("still reports success:true when at least one row lands", async () => {
    const { clayImportRouter } = await import("./clay-import");
    const caller = clayImportRouter.createCaller(anyCtx());

    const result: any = await caller.importRawData({
      rawData: JSON.stringify([{ domain: "acme.com", name: "Acme" }, { notes: "no domain here" }]),
    });

    expect(result.imported).toBe(1);
    expect(result.errors).toBe(1);
    expect(result.success).toBe(true);
  });
});
