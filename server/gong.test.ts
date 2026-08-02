import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isGongConfigured,
  gongListCalls,
  gongGetTranscripts,
  gongTestConnection,
} from "./integrations/gong";

/**
 * Contract tests for the Gong client.
 *
 * These do not prove Gong behaves as documented — nothing short of a real tenant can.
 * What they prove is that *we* hold up our end: the right Authorization header for
 * each credential shape, the cursor followed to the end and not past it, the page size
 * kept inside Gong's ceiling, sentences folded into speaker turns, and a 401 reported
 * as a rejected credential rather than an empty account.
 *
 * Every fixture below is Gong's documented v2 response shape. If Gong changes it, the
 * live smoke test (scripts/connector-smoke.mjs, runs whenever a real key is present)
 * is what catches the drift.
 */

const ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

function reply(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  for (const k of ["GONG_ACCESS_KEY", "GONG_ACCESS_KEY_SECRET", "GONG_API_KEY", "GONG_API_URL"]) {
    delete process.env[k];
  }
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL };
});

describe("configuration", () => {
  it("is not configured with no credentials", () => {
    expect(isGongConfigured()).toBe(false);
  });

  it("accepts an access key pair, or a single opaque key", () => {
    process.env.GONG_ACCESS_KEY = "ak";
    process.env.GONG_ACCESS_KEY_SECRET = "sk";
    expect(isGongConfigured()).toBe(true);

    delete process.env.GONG_ACCESS_KEY;
    delete process.env.GONG_ACCESS_KEY_SECRET;
    process.env.GONG_API_KEY = "opaque-key";
    expect(isGongConfigured()).toBe(true);
  });

  it("skips rather than throws when unconfigured, so the app runs without Gong", async () => {
    const res = await gongListCalls({});
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
    expect(res.error).toMatch(/not configured/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("authentication", () => {
  it("sends Basic auth for an access key pair", async () => {
    process.env.GONG_ACCESS_KEY = "my-key";
    process.env.GONG_ACCESS_KEY_SECRET = "my-secret";
    fetchMock.mockResolvedValue(reply({ calls: [] }));

    await gongListCalls({});

    const [, init] = fetchMock.mock.calls[0];
    const expected = `Basic ${Buffer.from("my-key:my-secret").toString("base64")}`;
    expect(init.headers.Authorization).toBe(expected);
  });

  it("sends Bearer auth for a single opaque key", async () => {
    process.env.GONG_API_KEY = "opaque";
    fetchMock.mockResolvedValue(reply({ calls: [] }));

    await gongListCalls({});
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer opaque");
  });

  it("reports a rejected credential rather than an empty result", async () => {
    // The silent failure this whole client is written to avoid: a wrong key that
    // looks exactly like an account with no calls in it.
    process.env.GONG_API_KEY = "revoked";
    fetchMock.mockResolvedValue(reply({ errors: ["Invalid credentials"] }, 401));

    const res = await gongListCalls({});
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
    expect(res.error).toMatch(/rejected the credentials/i);
  });

  it("surfaces a network failure instead of throwing at the caller", async () => {
    process.env.GONG_API_KEY = "k";
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const res = await gongListCalls({});
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ECONNREFUSED/);
  });
});

describe("listing calls", () => {
  beforeEach(() => {
    process.env.GONG_API_KEY = "k";
  });

  it("maps Gong's call record onto the flat shape this app stores", async () => {
    fetchMock.mockResolvedValue(
      reply({
        calls: [
          {
            id: "7782342",
            title: "Discovery — Brightwave Health",
            started: "2026-07-14T15:00:00Z",
            duration: 1834,
            url: "https://app.gong.io/call?id=7782342",
            direction: "Inbound",
            parties: [
              { name: "Dana Whitfield", emailAddress: "dana@brightwave.com", affiliation: "External" },
              { name: "Rep", emailAddress: "rep@us.com", affiliation: "Internal" },
            ],
          },
        ],
      })
    );

    const res = await gongListCalls({});
    expect(res.ok).toBe(true);
    const [c] = res.data!.calls;
    expect(c.id).toBe("7782342");
    expect(c.title).toBe("Discovery — Brightwave Health");
    expect(c.duration).toBe(1834);
    expect(c.participants).toHaveLength(2);
    expect(c.participants![0].emailAddress).toBe("dana@brightwave.com");
  });

  it("keeps the page size inside Gong's ceiling", async () => {
    // Gong 400s on limit > 100 rather than clamping, so asking for 500 loses the call.
    fetchMock.mockResolvedValue(reply({ calls: [] }));
    await gongListCalls({ limit: 500 });
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("limit")).toBe("100");
  });

  it("passes the date window through", async () => {
    fetchMock.mockResolvedValue(reply({ calls: [] }));
    await gongListCalls({ fromDateTime: "2026-07-01T00:00:00Z", toDateTime: "2026-07-31T00:00:00Z" });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("fromDateTime")).toBe("2026-07-01T00:00:00Z");
    expect(url.searchParams.get("toDateTime")).toBe("2026-07-31T00:00:00Z");
  });

  it("follows the cursor to the end", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ calls: [{ id: "1" }], records: { cursor: "page2" } }))
      .mockResolvedValueOnce(reply({ calls: [{ id: "2" }], records: { cursor: "page3" } }))
      .mockResolvedValueOnce(reply({ calls: [{ id: "3" }] }));

    const res = await gongListCalls({});
    expect(res.data!.calls.map((c) => c.id)).toEqual(["1", "2", "3"]);
    expect(res.data!.pages).toBe(3);
    expect(new URL(fetchMock.mock.calls[1][0]).searchParams.get("cursor")).toBe("page2");
  });

  it("stops at maxPages rather than following a cursor forever", async () => {
    // A window that keeps returning a cursor would otherwise spin until Gong
    // rate-limits us, with no output and no error.
    fetchMock.mockResolvedValue(reply({ calls: [{ id: "x" }], records: { cursor: "always" } }));
    const res = await gongListCalls({ maxPages: 3 });
    expect(res.data!.pages).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns an empty list, not an error, for a window with no calls", async () => {
    fetchMock.mockResolvedValue(reply({ calls: [] }));
    const res = await gongListCalls({});
    expect(res.ok).toBe(true);
    expect(res.data!.calls).toEqual([]);
  });

  it("abandons the walk when a later page fails", async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ calls: [{ id: "1" }], records: { cursor: "p2" } }))
      .mockResolvedValueOnce(reply({ errors: ["Rate limit exceeded"] }, 429));

    const res = await gongListCalls({});
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
    // Half a page of calls reported as success would look like the account shrank.
    expect(res.data).toBeUndefined();
  });
});

describe("transcripts", () => {
  beforeEach(() => {
    process.env.GONG_API_KEY = "k";
  });

  it("refuses an empty request rather than fetching every transcript", async () => {
    const res = await gongGetTranscripts([]);
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("folds sentences into speaker turns", async () => {
    fetchMock.mockResolvedValue(
      reply({
        callTranscripts: [
          {
            callId: "7782342",
            transcript: [
              { speakerId: "a", sentences: [{ text: "Thanks for making time." }, { text: "How's the rollout?" }] },
              { speakerId: "b", sentences: [{ text: "Slower than we wanted." }] },
              { speakerId: "b", sentences: [{ text: "The audit set us back." }] },
            ],
          },
        ],
      })
    );

    const res = await gongGetTranscripts(["7782342"]);
    const [t] = res.data!;
    expect(t.callId).toBe("7782342");
    // Two speakers, three segments — consecutive same-speaker segments merge.
    expect(t.turns).toHaveLength(2);
    expect(t.turns[0].text).toBe("Thanks for making time. How's the rollout?");
    expect(t.turns[1].text).toBe("Slower than we wanted. The audit set us back.");
  });

  it("drops empty segments instead of emitting blank turns", async () => {
    fetchMock.mockResolvedValue(
      reply({
        callTranscripts: [
          { callId: "1", transcript: [{ speakerId: "a", sentences: [] }, { speakerId: "a", sentences: [{ text: "Hi" }] }] },
        ],
      })
    );
    const res = await gongGetTranscripts(["1"]);
    expect(res.data![0].turns).toEqual([{ speakerId: "a", text: "Hi" }]);
  });

  it("posts the call ids in Gong's filter shape", async () => {
    fetchMock.mockResolvedValue(reply({ callTranscripts: [] }));
    await gongGetTranscripts(["a", "b"]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ filter: { callIds: ["a", "b"] } });
  });
});

describe("connection test", () => {
  it("spends a real request rather than inspecting the key's shape", async () => {
    process.env.GONG_API_KEY = "k";
    fetchMock.mockResolvedValue(reply({ records: { totalRecords: 41 } }));

    const res = await gongTestConnection();
    expect(res.ok).toBe(true);
    expect(res.data!.users).toBe(41);
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe("/v2/users");
  });

  it("fails when the response shape drifts, instead of reporting zero", async () => {
    // Caught by pointing the smoke harness at a stand-in that had moved the field.
    // The client defaulted the missing value to 0 and reported a healthy connection —
    // a silent zero is indistinguishable from a genuinely empty tenant.
    process.env.GONG_API_KEY = "k";
    fetchMock.mockResolvedValue(reply({ data: { total: 41 } }));

    const res = await gongTestConnection();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/response shape has changed/i);
  });

  it("reports a bad key as a failure", async () => {
    process.env.GONG_API_KEY = "bad";
    fetchMock.mockResolvedValue(reply({ errors: ["Unauthorized"] }, 401));
    const res = await gongTestConnection();
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/rejected the credentials/i);
  });
});

describe("base url override", () => {
  it("honours GONG_API_URL, so a full request cycle can run against a stand-in", async () => {
    process.env.GONG_API_KEY = "k";
    process.env.GONG_API_URL = "http://localhost:4599";
    vi.resetModules();
    const { gongListCalls: fresh } = await import("./integrations/gong");
    fetchMock.mockResolvedValue(reply({ calls: [] }));

    await fresh({});
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^http:\/\/localhost:4599\/v2\/calls/);
  });
});
