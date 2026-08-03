import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAccessToken,
  resetSalesforceToken,
  query,
  queryAll,
  fetchAccounts,
  fetchContacts,
  testConnection,
  transformAccount,
  transformContact,
} from "./salesforce";

/**
 * Contract tests for the Salesforce client.
 *
 * The defect these were written for: `SalesforceQueryResponse` has declared
 * `nextRecordsUrl` and `done` since the file was written, and nothing read either.
 * Salesforce returns at most 2,000 records per batch whatever the SOQL LIMIT says,
 * so `fetchContacts` — `LIMIT 5000 ORDER BY Name` — returned the first 2,000 and
 * stopped. An org with 5,000 contacts synced A through roughly J and reported
 * success.
 *
 * A truncation that is sorted is the worst kind: it doesn't look like missing data,
 * it looks like a smaller company.
 */

const ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function reply(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const TOKEN = {
  access_token: "tok-1",
  instance_url: "https://acme.my.salesforce.com",
  id: "x",
  token_type: "Bearer",
  issued_at: "0",
  signature: "s",
};

/** A query batch. Omit `next` for the final one. */
const batch = (records: any[], next?: string) => ({
  totalSize: records.length,
  done: !next,
  records,
  ...(next ? { nextRecordsUrl: next } : {}),
});

beforeEach(() => {
  process.env.SALESFORCE_CLIENT_ID = "cid";
  process.env.SALESFORCE_CLIENT_SECRET = "secret";
  process.env.SALESFORCE_INSTANCE_URL = "https://login.salesforce.com";
  resetSalesforceToken();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL };
});

describe("authentication", () => {
  it("picks up a key set after import, and refuses to run without one", async () => {
    // The credentials used to be module-level consts copied out of ENV, which is
    // itself frozen at its own import. Anything loading this before dotenv ran held
    // "" forever and reported "not configured" against an .env that had the key.
    delete process.env.SALESFORCE_CLIENT_ID;
    delete process.env.SALESFORCE_CLIENT_SECRET;
    await expect(getAccessToken()).rejects.toThrow(/not configured/i);

    process.env.SALESFORCE_CLIENT_ID = "late-cid";
    process.env.SALESFORCE_CLIENT_SECRET = "late-secret";
    fetchMock.mockResolvedValue(reply(TOKEN));
    await expect(getAccessToken()).resolves.toMatchObject({ token: "tok-1" });
  });

  it("uses the client-credentials grant and caches the token", async () => {
    fetchMock.mockResolvedValue(reply(TOKEN));

    const a = await getAccessToken();
    const b = await getAccessToken();

    expect(a.token).toBe("tok-1");
    expect(b.token).toBe("tok-1");
    // Cached: one round trip, not two.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/services/oauth2/token");
    expect(init.body).toContain("grant_type=client_credentials");
    expect(init.body).toContain("client_id=cid");
  });

  it("surfaces an OAuth rejection instead of continuing with no token", async () => {
    fetchMock.mockResolvedValue(reply({ error: "invalid_client" }, 400));
    await expect(getAccessToken()).rejects.toThrow(/OAuth failed: 400/);
  });

  it("re-authenticates once when a cached token is rejected mid-hour", async () => {
    // The cache holds a token for an hour. Salesforce can invalidate one sooner, and
    // without this every query failed for the rest of that hour with no retry.
    fetchMock
      .mockResolvedValueOnce(reply(TOKEN))                       // initial auth
      .mockResolvedValueOnce(reply({ message: "expired" }, 401)) // query rejected
      .mockResolvedValueOnce(reply({ ...TOKEN, access_token: "tok-2" })) // re-auth
      .mockResolvedValueOnce(reply(batch([{ Id: "1" }])));       // query retried

    const res = await query<any>("SELECT Id FROM Account");
    expect(res.records).toHaveLength(1);

    const lastQuery = fetchMock.mock.calls[3];
    expect(lastQuery[1].headers.Authorization).toBe("Bearer tok-2");
  });

  it("does not retry forever when the credentials are simply wrong", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(TOKEN))
      .mockResolvedValueOnce(reply({ message: "bad" }, 401))
      .mockResolvedValueOnce(reply(TOKEN))
      .mockResolvedValueOnce(reply({ message: "bad" }, 401));

    await expect(query<any>("SELECT Id FROM Account")).rejects.toThrow(/query failed: 401/);
    expect(fetchMock).toHaveBeenCalledTimes(4); // one retry, not a loop
  });
});

describe("paging", () => {
  beforeEach(() => {
    fetchMock.mockResolvedValueOnce(reply(TOKEN));
  });

  it("follows nextRecordsUrl to the end", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(batch([{ Id: "1" }, { Id: "2" }], "/services/data/v59.0/query/01g-2")))
      .mockResolvedValueOnce(reply(batch([{ Id: "3" }], "/services/data/v59.0/query/01g-3")))
      .mockResolvedValueOnce(reply(batch([{ Id: "4" }])));

    const rows = await queryAll<any>("SELECT Id FROM Account");
    expect(rows.map((r) => r.Id)).toEqual(["1", "2", "3", "4"]);
  });

  it("stops after one batch when Salesforce says it is done", async () => {
    fetchMock.mockResolvedValueOnce(reply(batch([{ Id: "1" }])));
    const rows = await queryAll<any>("SELECT Id FROM Account");
    expect(rows).toHaveLength(1);
    // token + one query, no speculative second page
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws rather than returning a partial set when a later batch fails", async () => {
    // Returning the first 2,000 of 5,000 as a success is the whole defect.
    fetchMock
      .mockResolvedValueOnce(reply(batch([{ Id: "1" }], "/next")))
      .mockResolvedValueOnce(reply({ message: "REQUEST_LIMIT_EXCEEDED" }, 403));

    await expect(queryAll<any>("SELECT Id FROM Account")).rejects.toThrow(/paging failed after 1 records/);
  });

  it("refuses to silently keep a prefix when there are more batches than allowed", async () => {
    fetchMock.mockResolvedValue(reply(batch([{ Id: "x" }], "/next")));
    await expect(queryAll<any>("SELECT Id FROM Account", 3)).rejects.toThrow(/more than 3 batches/);
  });
});

describe("fetching", () => {
  it("pulls every account across batches, not just the first", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(TOKEN))
      .mockResolvedValueOnce(reply(batch([{ Id: "a", Name: "Acme" }], "/next")))
      .mockResolvedValueOnce(reply(batch([{ Id: "b", Name: "Zenith" }])));

    const accounts = await fetchAccounts();
    expect(accounts.map((a) => a.Name)).toEqual(["Acme", "Zenith"]);
  });

  it("pulls every contact across batches", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(TOKEN))
      .mockResolvedValueOnce(reply(batch([{ Id: "1", Name: "Ann" }], "/next")))
      .mockResolvedValueOnce(reply(batch([{ Id: "2", Name: "Zoe" }])));

    const contacts = await fetchContacts();
    expect(contacts.map((c) => c.Name)).toEqual(["Ann", "Zoe"]);
  });

  it("no longer sends a LIMIT that Salesforce would ignore anyway", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(TOKEN))
      .mockResolvedValueOnce(reply(batch([])));

    await fetchContacts();
    const soql = decodeURIComponent(String(fetchMock.mock.calls[1][0]));
    // LIMIT 5000 read as a deliberate ceiling. It was not — Salesforce caps at 2,000.
    expect(soql).not.toMatch(/LIMIT/i);
  });
});

describe("testConnection", () => {
  it("reports the org's real totals", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(TOKEN))
      .mockResolvedValueOnce(reply({ totalSize: 4211, done: true, records: [] }))
      .mockResolvedValueOnce(reply({ totalSize: 18402, done: true, records: [] }));

    const res = await testConnection();
    expect(res).toMatchObject({ success: true, connected: true, accountCount: 4211, contactCount: 18402 });
  });

  it("reports a failure as a failure, with the reason", async () => {
    fetchMock.mockResolvedValue(reply({ error: "invalid_client" }, 400));
    const res = await testConnection();
    expect(res.success).toBe(false);
    expect(res.connected).toBe(false);
    expect(res.error).toMatch(/OAuth failed/);
  });
});

describe("transforms", () => {
  it("extracts a domain from whatever shape the Website field is in", () => {
    expect(transformAccount({ Id: "1", Name: "A", Website: "https://www.acme.com/x" }).domain).toBe("acme.com");
    expect(transformAccount({ Id: "1", Name: "A", Website: "acme.com" }).domain).toBe("acme.com");
    expect(transformAccount({ Id: "1", Name: "A" }).domain).toBeNull();
  });

  it("maps US states to regions and everything else to International", () => {
    expect(transformAccount({ Id: "1", Name: "A", BillingState: "CA" }).region).toBe("West");
    expect(transformAccount({ Id: "1", Name: "A", BillingState: "TX" }).region).toBe("Central");
    expect(transformAccount({ Id: "1", Name: "A", BillingState: "NY" }).region).toBe("East");
    expect(transformAccount({ Id: "1", Name: "A", BillingCountry: "Germany" }).region).toBe("International");
  });

  it("keeps a missing employee count missing rather than calling it zero", () => {
    // A zero would read as "we checked, and they have no staff".
    expect(transformAccount({ Id: "1", Name: "A" }).employeeCount).toBeNull();
  });

  it("maps a contact onto the fields this app stores", () => {
    const c = transformContact({
      Id: "003x",
      Name: "Dana Whitfield",
      FirstName: "Dana",
      LastName: "Whitfield",
      Email: "dana@acme.com",
      Title: "VP Security",
      Account: { Name: "Acme" },
    });
    expect(c).toMatchObject({ name: "Dana Whitfield", email: "dana@acme.com", title: "VP Security" });
  });
});
