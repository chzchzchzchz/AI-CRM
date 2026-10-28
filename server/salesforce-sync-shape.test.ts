import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * The check that catches a Salesforce sync failing while reporting success.
 *
 * `testConnection` runs `SELECT COUNT() FROM Account`. It proves the credentials work and
 * that Accounts exist, and says nothing about the fields. If an org renames a field,
 * hides one behind field-level security, or the API version drops it, the query still
 * succeeds, `transformAccount` reads `undefined` for each missing field, and the sync
 * reports "312 accounts synced" having written 312 rows with a name and nothing else.
 *
 * That is a sync failure rendered as a success message. It is also the single most likely
 * way this integration breaks against a real org, and no mocked-transport test catches it
 * because a mock returns whatever we believed the shape to be. `verifySyncShape` fetches
 * one real record with the sync's own SOQL and runs it through the sync's own transform.
 *
 * These tests stub the query and assert what the check DOES with each response.
 */

const ACCOUNT = {
  Id: "0011x00000abcdeAAA",
  Name: "Vertex Cloud Systems",
  Website: "https://vertexcloud.example",
  Industry: "Technology",
  NumberOfEmployees: 2400,
  BillingCity: "Austin",
  BillingState: "TX",
  BillingCountry: "USA",
  Description: "A synthetic account",
  Type: "Customer",
  Phone: "+1-555-0100",
  OwnerId: "0051x000000abcAAA",
};

/**
 * `query` is module-internal, so the seam is the fetch it ultimately makes: return the
 * OAuth token response, then a SOQL response body. Stubbing at the network edge also
 * means the SOQL string and the transform under test are the real ones.
 */
function stubSoql(records: any[]) {
  globalThis.fetch = vi.fn().mockImplementation(async (url: any) => {
    const u = String(url);
    if (u.includes("/services/oauth2/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "tok", instance_url: "https://example.my.salesforce.com" }),
        text: async () => "",
      } as any;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ totalSize: records.length, done: true, records }),
      text: async () => "",
    } as any;
  }) as any;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("verifySyncShape", () => {
  it("passes when a real record survives the transform", async () => {
    process.env.SALESFORCE_CLIENT_ID = "id";
    process.env.SALESFORCE_CLIENT_SECRET = "secret";
    process.env.SALESFORCE_USERNAME = "u@example.com";
    process.env.SALESFORCE_PASSWORD = "pw";
    stubSoql([ACCOUNT]);

    const { verifySyncShape } = await import("./salesforce");
    const r = await verifySyncShape();

    expect(r.ok).toBe(true);
    expect(r.detail).toContain("Vertex Cloud Systems");
    // Naming how much survived is what makes a partial failure visible: 2/7 is a
    // working connection and a mostly-empty sync, and "ok" alone would hide that.
    expect(r.detail).toMatch(/\d\/\d optional fields/);
  });

  it("FAILS when every optional field comes back empty", async () => {
    // The exact signature of field-level security hiding the field list from the
    // integration user, or an API version that dropped it. The query succeeds, the
    // count is right, and the sync writes a table of names with nothing attached.
    stubSoql([{ Id: ACCOUNT.Id, Name: ACCOUNT.Name }]);

    const { verifySyncShape } = await import("./salesforce");
    const r = await verifySyncShape();

    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/every optional field empty/i);
    expect(r.detail).toMatch(/field-level security|API version/i);
  });

  it("FAILS when the identity fields do not survive the transform", async () => {
    // Id or Name missing means the field mapping itself is wrong — every row the sync
    // writes would be unidentifiable, and the upsert would insert duplicates forever.
    stubSoql([{ Website: "https://vertexcloud.example", Industry: "Technology" }]);

    const { verifySyncShape } = await import("./salesforce");
    const r = await verifySyncShape();

    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/field mapping is wrong/i);
  });

  it("treats an empty org as fine, not as broken", async () => {
    // An org with no accounts is a legitimate state. Reporting it as a failure would
    // train people to ignore this output, which is how a real failure gets missed.
    stubSoql([]);

    const { verifySyncShape } = await import("./salesforce");
    const r = await verifySyncShape();

    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/no accounts/i);
  });

  it("reports an error rather than throwing into the harness", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("INVALID_SESSION_ID")) as any;

    const { verifySyncShape } = await import("./salesforce");
    const r = await verifySyncShape();

    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/INVALID_SESSION_ID/);
  });
});
