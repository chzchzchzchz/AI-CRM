import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isSixsenseConfigured,
  lookupByDomain,
  lookupByIP,
  enrichAccountDetailed,
  toAccount,
  getCompanyByDomain,
} from "./sixsense";

/**
 * Contract tests for the 6sense client.
 *
 * The defect these exist for: every failure returned null, and null is also what
 * 6sense legitimately says when it doesn't know a company. A revoked key, an unset
 * key, a 500 and a genuine miss were one indistinguishable answer — so a broken
 * integration looked exactly like a quiet book of business.
 *
 * What was here before was a single test that called the real 6sense API and, with no
 * key configured, returned early having asserted nothing. It passed on every CI run
 * this repo has ever had, and it is why a survey of connector coverage reported
 * 6sense as tested. A test that cannot fail is not coverage, it is a claim of it.
 *
 * The live check now lives in scripts/connector-smoke.mjs, which runs whenever a key
 * is present and says UNVERIFIED, out loud, when one is not.
 */

const ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function reply(body: unknown, status = 200, statusText = "OK") {
  return { ok: status >= 200 && status < 300, status, statusText, json: async () => body };
}

const MATCH = {
  company_match: "Match",
  company: {
    companyId: "6s-4192",
    name: "Brightwave Health",
    domain: "brightwave.com",
    industry: "Healthcare",
    employee_range: "1,001-5,000",
    employee_count: 2400,
    revenue_range: "$500M-$1B",
    annual_revenue: 720_000_000,
    country: "United States",
    state: "Massachusetts",
    city: "Boston",
    region: "Northeast",
  },
  buying_stage: "Decision",
  profile_fit: "Strong",
  intent_score: 87,
  segments: ["Healthcare ICP", "Identity"],
};

beforeEach(() => {
  delete process.env.SIXSENSE_API_KEY;
  delete process.env.SIXSENSE_API_URL;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL };
});

describe("configuration", () => {
  it("reads the key at call time, not at module load", async () => {
    // The key used to be captured in a module-level const. Anything importing this
    // before dotenv ran held `undefined` for the life of the process.
    expect(isSixsenseConfigured()).toBe(false);
    process.env.SIXSENSE_API_KEY = "set-after-import";
    expect(isSixsenseConfigured()).toBe(true);

    fetchMock.mockResolvedValue(reply(MATCH));
    expect((await lookupByDomain("brightwave.com")).ok).toBe(true);
  });

  it("says it is unconfigured rather than reporting no match", async () => {
    const res = await lookupByDomain("brightwave.com");
    expect(res).toMatchObject({ ok: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("distinguishing failures", () => {
  beforeEach(() => {
    process.env.SIXSENSE_API_KEY = "token";
  });

  it("reports a rejected key as rejected, not as an empty result", async () => {
    // This is the defect. A 401 returning null meant a revoked key was reported to
    // the rep as "6sense has nothing on this account", indefinitely.
    fetchMock.mockResolvedValue(reply({}, 401, "Unauthorized"));
    const res = await lookupByDomain("brightwave.com");
    expect(res).toMatchObject({ ok: false, reason: "rejected" });
    expect((res as any).message).toMatch(/SIXSENSE_API_KEY/);
  });

  it("treats 403 the same way", async () => {
    fetchMock.mockResolvedValue(reply({}, 403, "Forbidden"));
    expect(await lookupByDomain("x.com")).toMatchObject({ ok: false, reason: "rejected" });
  });

  it("reports a genuine miss as no_match", async () => {
    fetchMock.mockResolvedValue(reply({}, 404, "Not Found"));
    expect(await lookupByDomain("nobody.example")).toMatchObject({ ok: false, reason: "no_match" });
  });

  it("treats a 200 with no company block as a miss too", async () => {
    fetchMock.mockResolvedValue(reply({ company_match: "No Match" }));
    expect(await lookupByDomain("nobody.example")).toMatchObject({ ok: false, reason: "no_match" });
  });

  it("reports a server error as an error", async () => {
    fetchMock.mockResolvedValue(reply({}, 503, "Service Unavailable"));
    const res = await lookupByDomain("x.com");
    expect(res).toMatchObject({ ok: false, reason: "error" });
    expect((res as any).message).toMatch(/503/);
  });

  it("reports a network failure as an error, without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));
    const res = await lookupByDomain("x.com");
    expect(res).toMatchObject({ ok: false, reason: "error" });
    expect((res as any).message).toMatch(/ETIMEDOUT/);
  });

  it("rejects an empty argument before spending a request", async () => {
    expect(await lookupByDomain("")).toMatchObject({ ok: false, reason: "error" });
    expect(await lookupByIP("")).toMatchObject({ ok: false, reason: "error" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the request", () => {
  beforeEach(() => {
    process.env.SIXSENSE_API_KEY = "token-abc";
  });

  it("sends 6sense's Token scheme, not Bearer", async () => {
    fetchMock.mockResolvedValue(reply(MATCH));
    await lookupByDomain("brightwave.com");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Token token-abc");
  });

  it("queries domain and ip on the right parameter", async () => {
    fetchMock.mockResolvedValue(reply(MATCH));
    await lookupByDomain("brightwave.com");
    expect(String(fetchMock.mock.calls[0][0])).toContain("domain=brightwave.com");

    await lookupByIP("203.0.113.9");
    expect(String(fetchMock.mock.calls[1][0])).toContain("ip=203.0.113.9");
  });

  it("url-encodes the value", async () => {
    fetchMock.mockResolvedValue(reply(MATCH));
    await lookupByDomain("a b&c.com");
    expect(String(fetchMock.mock.calls[0][0])).toContain("domain=a%20b%26c.com");
  });

  it("honours SIXSENSE_API_URL so a full request can run against a stand-in", async () => {
    process.env.SIXSENSE_API_URL = "http://localhost:4600/v3/company/details";
    fetchMock.mockResolvedValue(reply(MATCH));
    await lookupByDomain("brightwave.com");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^http:\/\/localhost:4600\//);
  });
});

describe("mapping", () => {
  it("flattens 6sense's nested shape onto the fields this app stores", () => {
    const a = toAccount(MATCH as any);
    expect(a).toMatchObject({
      companyName: "Brightwave Health",
      domain: "brightwave.com",
      industry: "Healthcare",
      employeeCount: 2400,
      annualRevenue: 720_000_000,
      city: "Boston",
      intentScore: 87,
      buyingStage: "Decision",
      profileFit: "Strong",
      sixsenseId: "6s-4192",
      companyMatch: "Match",
    });
    expect(a.segments).toEqual(["Healthcare ICP", "Identity"]);
  });

  it("defaults segments to an array so callers can map over it", () => {
    expect(toAccount({ company_match: "Match", company: { name: "X" } }).segments).toEqual([]);
  });

  it("does not invent values for fields 6sense omitted", () => {
    const a = toAccount({ company_match: "Match", company: { name: "X" } });
    // A zero intent score would read as "we checked, and they're cold".
    expect(a.intentScore).toBeUndefined();
    expect(a.employeeCount).toBeUndefined();
  });
});

describe("enrichAccountDetailed", () => {
  beforeEach(() => {
    process.env.SIXSENSE_API_KEY = "token";
  });

  it("returns the mapped account on a match", async () => {
    fetchMock.mockResolvedValue(reply(MATCH));
    const res = await enrichAccountDetailed("brightwave.com");
    expect(res.ok).toBe(true);
    expect((res as any).account.companyName).toBe("Brightwave Health");
  });

  it("keeps the reason, so the UI can say which thing went wrong", async () => {
    fetchMock.mockResolvedValue(reply({}, 401, "Unauthorized"));
    expect(await enrichAccountDetailed("brightwave.com")).toMatchObject({
      ok: false,
      reason: "rejected",
    });
  });
});

describe("back-compatible shims", () => {
  beforeEach(() => {
    process.env.SIXSENSE_API_KEY = "token";
  });

  it("still return null, but log anything that is not an ordinary miss", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockResolvedValue(reply({}, 404, "Not Found"));
    expect(await getCompanyByDomain("nobody.example")).toBeNull();
    expect(err).not.toHaveBeenCalled(); // a miss is not an error

    fetchMock.mockResolvedValue(reply({}, 401, "Unauthorized"));
    expect(await getCompanyByDomain("brightwave.com")).toBeNull();
    expect(err).toHaveBeenCalledWith(expect.stringMatching(/rejected the API key/));

    err.mockRestore();
  });
});
