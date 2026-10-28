import { describe, it, expect, vi, afterEach } from "vitest";
import { identityChecks } from "./integrations/connectors";

/**
 * The read-only credential checks behind `pnpm smoke`.
 *
 * The standing caveat in this repo is that no connector has been verified against a real
 * vendor tenant. That is true and unfixable from here — there are no credentials. What is
 * fixable is that verifying was something a person had to remember to do: with a key set,
 * `pnpm smoke` exercises each connector on every run.
 *
 * These tests are about the failure modes of the checking itself, because a credential
 * check that reports success wrongly is worse than none: it converts "unverified" into a
 * green tick, which is the exact defect class this codebase exists to remove.
 *
 * The vendor call is stubbed. What is asserted is what the check DOES with each kind of
 * response — an authenticated-but-reshaped payload especially, since that is the only
 * failure a live request catches and a mocked unit test cannot.
 */

const originalFetch = globalThis.fetch;

function stubFetch(status: number, body: unknown) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as any;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("connector credential checks", () => {
  it("reports the account it reached, not just 'ok'", async () => {
    process.env.HUBSPOT_ACCESS_TOKEN = "pat-test";
    stubFetch(200, { portalId: 12345678 });
    const r = await identityChecks.hubspot.run();
    expect(r.ok).toBe(true);
    // "ok" alone does not tell an operator they pointed at the right account. Naming
    // what answered is what turns the check into something you can act on when a sync
    // silently returns nothing: right key, wrong portal.
    expect(r.detail).toContain("12345678");
    delete process.env.HUBSPOT_ACCESS_TOKEN;
  });

  it("fails when the response is authenticated but the shape moved", async () => {
    // The whole reason to spend a live request. A mocked transport test asserts we parse
    // what we THINK the vendor sends; only a real call catches the vendor changing it.
    // A check that returned ok on a 200 with an unrecognised body would defeat that.
    process.env.NOTION_TOKEN = "secret_test";
    stubFetch(200, { unexpected: "the API was reshaped" });
    const r = await identityChecks.notion.run();
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/shape changed/i);
    delete process.env.NOTION_TOKEN;
  });

  it("keeps the HTTP status, because 401 and 403 need different fixes", async () => {
    // 401 means the key is wrong; 403 means the key is right and lacks a scope. Collapsing
    // both to "failed" sends the operator to regenerate a key that was never the problem.
    process.env.AIRTABLE_TOKEN = "pat-test";
    stubFetch(403, { error: "INSUFFICIENT_PERMISSIONS" });
    const r = await identityChecks.airtable.run();
    expect(r.ok).toBe(false);
    expect(r.detail).toContain("403");
    delete process.env.AIRTABLE_TOKEN;
  });

  it("reports a network failure as a failure, not as an unset credential", async () => {
    process.env.CALENDLY_API_KEY = "cal-test";
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as any;
    const r = await identityChecks.calendly.run();
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/ECONNREFUSED/);
    delete process.env.CALENDLY_API_KEY;
  });

  it("treats an unset credential as not-configured rather than as a failure", async () => {
    // Every connector here is optional. Reporting an absent key as a failure would make
    // a clean install look broken and train everyone to ignore the output.
    delete process.env.LINEAR_API_KEY;
    expect(identityChecks.linear.configured()).toBe(false);
  });

  it("does not spend a paid credit to check a key", async () => {
    // Apollo's enrich endpoint costs a credit per call. A check that bills the operator
    // on every CI run is a check that gets deleted, so this has to be the free health
    // endpoint — asserted here because the difference is invisible until the bill.
    const src = identityChecks.apollo.run.toString();
    expect(src).toContain("auth/health");
    expect(src).not.toMatch(/people\/match|organizations\/enrich/);
  });

  it("covers every connector it claims to, with a configured() and a run()", async () => {
    for (const [name, check] of Object.entries(identityChecks)) {
      expect(typeof check.configured, name).toBe("function");
      expect(typeof check.run, name).toBe("function");
      expect(check.env.length, name).toBeGreaterThan(0);
    }
  });
});
