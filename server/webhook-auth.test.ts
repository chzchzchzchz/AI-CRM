import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hashWebhookSecret, generateWebhookSecret } from "./_core/webhook-auth";

/**
 * Which organization an inbound webhook belongs to.
 *
 * Webhook receivers are publicProcedures — an HTTP POST with no session — so they were
 * the last unscoped queries in the codebase. The old check authenticated the caller and
 * stopped there: the request was known to be legitimate and not known to belong to
 * anyone, so every inbound Clay record went to the same org regardless of who sent it.
 *
 * The dangerous fix would have been to write DEFAULT_ORG_ID into those queries. The
 * scoping audit would have read zero, the second-org refusal would have lifted, and one
 * customer's inbound enrichment would have been written into another's account table —
 * with a green build saying multi-org was ready.
 *
 * So the org is resolved FROM the credential, and an unrecognised credential is refused
 * rather than defaulted. These tests are mostly about that last clause.
 */

const ENV = "env-secret-for-org-one";

let rows: Array<{ orgId: number; provider: string; secretHash: string; revokedAt: Date | null }> = [];

/** A stand-in for the parts of the drizzle chain resolveWebhookOrg uses. */
function mockDb() {
  return {
    select: () => ({
      from: () => ({
        where: (cond: any) => ({
          limit: async () => {
            // The mock cannot evaluate drizzle conditions, so the filter is applied here
            // from the values the caller stashed. What matters is that the lookup is BY
            // hash and that a revoked row never matches.
            const match = rows.find(
              r => r.provider === cond.__provider && r.secretHash === cond.__hash && r.revokedAt === null
            );
            return match ? [{ orgId: match.orgId }] : [];
          },
        }),
      }),
    }),
  };
}

async function load(demoMode: boolean) {
  vi.resetModules();
  process.env.DEMO_MODE = demoMode ? "true" : "false";
  vi.doMock("./db", () => ({ getDb: async () => mockDb() }));
  vi.doMock("drizzle-orm", async (importOriginal) => {
    const actual = await importOriginal<typeof import("drizzle-orm")>();
    return {
      ...actual,
      // Carry the compared values through so the mock above can apply them.
      and: (...parts: any[]) => Object.assign({}, ...parts.filter(Boolean)),
      eq: (col: any, val: any) => {
        const name = String(col?.name ?? "");
        if (name === "provider") return { __provider: val };
        if (name === "secretHash") return { __hash: val };
        return {};
      },
      isNull: () => ({}),
    };
  });
  return await import("./_core/webhook-auth");
}

beforeEach(() => {
  rows = [];
});

afterEach(() => {
  vi.doUnmock("./db");
  vi.doUnmock("drizzle-orm");
  vi.resetModules();
  delete process.env.DEMO_MODE;
});

describe("webhook secrets", () => {
  it("issues an unguessable secret", async () => {
    // A webhook secret is a credential that grants write access to account data. The
    // recovery codes in twofa.ts came from Math.random() before someone noticed; this
    // pins the same property here rather than waiting to find out.
    const a = generateWebhookSecret();
    const b = generateWebhookSecret();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes deterministically, so the lookup is an index probe", async () => {
    expect(hashWebhookSecret("abc")).toBe(hashWebhookSecret("abc"));
    expect(hashWebhookSecret("abc")).not.toBe(hashWebhookSecret("abd"));
    expect(hashWebhookSecret("abc")).toHaveLength(64);
  });
});

describe("resolveWebhookOrg", () => {
  it("maps the environment secret to the default org, so existing deployments keep working", async () => {
    const { resolveWebhookOrg } = await load(false);
    expect(await resolveWebhookOrg("clay", ENV, ENV)).toBe(1);
  });

  it("resolves an issued credential to its own org", async () => {
    const { resolveWebhookOrg, hashWebhookSecret: h } = await load(false);
    const secret = "credential-for-org-seven";
    rows.push({ orgId: 7, provider: "clay", secretHash: h(secret), revokedAt: null });
    expect(await resolveWebhookOrg("clay", secret, ENV)).toBe(7);
  });

  it("REFUSES an unrecognised secret rather than defaulting to org 1", async () => {
    // The whole point. A receiver that fell back to the default org on an unknown secret
    // would write one tenant's inbound data into another's account table — and would do
    // it while reporting a successful, authenticated-looking request.
    const { resolveWebhookOrg } = await load(false);
    await expect(resolveWebhookOrg("clay", "not-a-real-secret", ENV)).rejects.toThrow(/invalid/i);
  });

  it("refuses a revoked credential", async () => {
    const { resolveWebhookOrg, hashWebhookSecret: h } = await load(false);
    const secret = "revoked-credential";
    rows.push({ orgId: 7, provider: "clay", secretHash: h(secret), revokedAt: new Date() as any });
    await expect(resolveWebhookOrg("clay", secret, ENV)).rejects.toThrow(/invalid/i);
  });

  it("does not accept another provider's credential", async () => {
    const { resolveWebhookOrg, hashWebhookSecret: h } = await load(false);
    const secret = "zapier-only";
    rows.push({ orgId: 7, provider: "zapier", secretHash: h(secret), revokedAt: null });
    await expect(resolveWebhookOrg("clay", secret, ENV)).rejects.toThrow(/invalid/i);
  });

  it("still lets a per-org credential through when an env secret is also configured", async () => {
    // A deployment migrating to multi-org keeps org 1 on the environment secret while
    // issuing credentials for the others. A wrong-env-secret early return would have made
    // that impossible and pushed the operator into deleting the env var mid-migration.
    const { resolveWebhookOrg, hashWebhookSecret: h } = await load(false);
    const secret = "org-nine";
    rows.push({ orgId: 9, provider: "clay", secretHash: h(secret), revokedAt: null });
    expect(await resolveWebhookOrg("clay", secret, ENV)).toBe(9);
    expect(await resolveWebhookOrg("clay", ENV, ENV)).toBe(1);
  });

  it("fails closed when nothing is configured, outside demo mode", async () => {
    // An unconfigured write endpoint must not be an open one. This is the failure by
    // omission the original check was written to prevent, preserved through the change.
    const { resolveWebhookOrg } = await load(false);
    await expect(resolveWebhookOrg("clay", undefined, "")).rejects.toThrow(/not configured/i);
    await expect(resolveWebhookOrg("clay", "anything", "")).rejects.toThrow(/not configured/i);
  });

  it("accepts an unconfigured receiver only in demo mode", async () => {
    const { resolveWebhookOrg } = await load(true);
    expect(await resolveWebhookOrg("clay", undefined, "")).toBe(1);
  });

  it("does not open up in demo mode once a secret IS configured", async () => {
    // DEMO_MODE is a convenience for the bundled dataset, not a bypass that outranks a
    // credential the operator deliberately set.
    const { resolveWebhookOrg } = await load(true);
    await expect(resolveWebhookOrg("clay", "wrong", ENV)).rejects.toThrow(/invalid/i);
  });
});
