import { describe, it, expect, vi } from "vitest";
import { mockAuthContext } from "./test-utils";

/**
 * bulkUpsertAccountsFromSalesforce/bulkUpsertContactsFromSalesforce (server/db.ts) catch
 * each row's upsert individually so one bad record doesn't abort the whole sync — and
 * track exactly how many failed in `result.errors`. That count went nowhere: the
 * router's `message` (all three procedures below) never mentioned it, and
 * SalesforceSync.tsx displays that message verbatim with no separate check. A sync
 * where 5 of 50 accounts failed to upsert read as "Synced 45 new accounts, updated 0
 * existing accounts" — indistinguishable from a completely clean run. `fullSync` was
 * worse: its own message was the unconditional literal "Full sync completed
 * successfully", never reading either side's error count at all.
 */

function mockRow(overrides: Record<string, unknown> = {}) {
  return { Id: "1", Name: "Acme", ...overrides };
}

describe("salesforce.syncAccounts — partial-failure honesty", () => {
  it("mentions the error count in the message when some accounts fail to upsert", async () => {
    vi.resetModules();
    vi.doMock("./salesforce", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./salesforce")>();
      return {
        ...actual,
        fetchAccounts: vi.fn().mockResolvedValue([mockRow()]),
      };
    });
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        bulkUpsertAccountsFromSalesforce: vi.fn().mockResolvedValue({ inserted: 45, updated: 0, errors: 5 }),
      };
    });

    const { salesforceRouter } = await import("./routers/salesforce");
    const caller = salesforceRouter.createCaller(mockAuthContext);
    const result: any = await caller.syncAccounts();

    expect(result.success).toBe(true);
    expect(result.errors).toBe(5);
    expect(result.message).toMatch(/5 failed/i);

    vi.doUnmock("./salesforce");
    vi.doUnmock("./db");
  });

  it("says nothing about failures when there were none", async () => {
    vi.resetModules();
    vi.doMock("./salesforce", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./salesforce")>();
      return { ...actual, fetchAccounts: vi.fn().mockResolvedValue([mockRow()]) };
    });
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        bulkUpsertAccountsFromSalesforce: vi.fn().mockResolvedValue({ inserted: 1, updated: 0, errors: 0 }),
      };
    });

    const { salesforceRouter } = await import("./routers/salesforce");
    const caller = salesforceRouter.createCaller(mockAuthContext);
    const result: any = await caller.syncAccounts();

    expect(result.message).not.toMatch(/fail/i);

    vi.doUnmock("./salesforce");
    vi.doUnmock("./db");
  });
});

describe("salesforce.fullSync — partial-failure honesty", () => {
  it("does not claim 'completed successfully' when accounts or contacts failed to upsert", async () => {
    vi.resetModules();
    vi.doMock("./salesforce", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./salesforce")>();
      return {
        ...actual,
        fetchAccounts: vi.fn().mockResolvedValue([mockRow()]),
        fetchContacts: vi.fn().mockResolvedValue([mockRow({ Email: "a@acme.com" })]),
      };
    });
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        bulkUpsertAccountsFromSalesforce: vi.fn().mockResolvedValue({ inserted: 8, updated: 2, errors: 3 }),
        bulkUpsertContactsFromSalesforce: vi.fn().mockResolvedValue({ inserted: 0, updated: 0, linked: 0, errors: 0 }),
      };
    });

    const { salesforceRouter } = await import("./routers/salesforce");
    const caller = salesforceRouter.createCaller(mockAuthContext);
    const result: any = await caller.fullSync();

    expect(result.message).not.toBe("Full sync completed successfully");
    expect(result.message).toMatch(/3 error/i);

    vi.doUnmock("./salesforce");
    vi.doUnmock("./db");
  });

  it("reports a genuinely clean run as completed successfully", async () => {
    vi.resetModules();
    vi.doMock("./salesforce", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./salesforce")>();
      return {
        ...actual,
        fetchAccounts: vi.fn().mockResolvedValue([mockRow()]),
        fetchContacts: vi.fn().mockResolvedValue([mockRow({ Email: "a@acme.com" })]),
      };
    });
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return {
        ...actual,
        bulkUpsertAccountsFromSalesforce: vi.fn().mockResolvedValue({ inserted: 1, updated: 0, errors: 0 }),
        bulkUpsertContactsFromSalesforce: vi.fn().mockResolvedValue({ inserted: 1, updated: 0, linked: 1, errors: 0 }),
      };
    });

    const { salesforceRouter } = await import("./routers/salesforce");
    const caller = salesforceRouter.createCaller(mockAuthContext);
    const result: any = await caller.fullSync();

    expect(result.message).toBe("Full sync completed successfully");

    vi.doUnmock("./salesforce");
    vi.doUnmock("./db");
  });
});
