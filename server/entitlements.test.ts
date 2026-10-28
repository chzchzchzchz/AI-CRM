import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  LimitExceededError,
  assertWithinLimit,
  checkLimit,
  entitlementsFor,
  monthStart,
  recordUsage,
  usageFor,
} from "./_core/entitlements";

/**
 * The enforcement half of billing, with no pricing in it.
 *
 * There are no plan names here and no default limits, on purpose. A guessed cap is worse
 * than no cap: it fires on a real customer, mid-work, for a rule nobody chose. So a
 * missing limit means unlimited, and every existing deployment is unaffected until an
 * operator decides a number.
 *
 * These are mostly about the ways a limit can be wrong in the customer's disfavour —
 * locking someone out of their own workspace is the failure that matters, and every one
 * of them here fails open instead.
 */

const DB_PATH = path.join(process.cwd(), "entitlements-test-db.json");

function seed(orgs: any[] = [{ id: 1, name: "One" }, { id: 2, name: "Two" }]) {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      { organizations: orgs, users: [], accounts: [], contacts: [], usage_events: [] },
      null,
      2
    )
  );
}

async function db() {
  const { getDb } = await import("./db");
  return getDb();
}

beforeEach(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  seed();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(DB_PATH, { force: true });
  vi.resetModules();
});

describe("no limit is the default, and it means unlimited", () => {
  it("an organization with no entitlements has none", async () => {
    expect(await entitlementsFor(await db(), 1)).toEqual({});
  });

  it("checkLimit returns null rather than a zero limit", async () => {
    // The distinction that matters: "no limit set" and "limit of 0" are opposites, and
    // conflating them would refuse every action on every existing deployment.
    expect(await checkLimit(await db(), 1, "seats", 1)).toBeNull();
  });

  it("assertWithinLimit does nothing at all", async () => {
    await expect(assertWithinLimit(await db(), 1, "seats", 1_000_000)).resolves.toBeUndefined();
  });
});

describe("a limit that is set", () => {
  async function setLimits(orgId: number, entitlements: Record<string, unknown>) {
    const store = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    const org = store.organizations.find((o: any) => o.id === orgId);
    org.entitlements = entitlements;
    fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
  }

  async function addUsers(orgId: number, n: number) {
    const store = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    for (let i = 0; i < n; i++) {
      store.users.push({ id: store.users.length + 1, orgId, email: `u${i}-${orgId}@x.test` });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
  }

  it("allows up to the limit and refuses past it", async () => {
    await setLimits(1, { seats: 3 });
    await addUsers(1, 2);
    expect((await checkLimit(await db(), 1, "seats", 1))?.allowed).toBe(true);
    expect((await checkLimit(await db(), 1, "seats", 2))?.allowed).toBe(false);
  });

  it("counts only this organization's usage", async () => {
    // A shared count would make one customer's growth refuse another's invitation.
    await setLimits(1, { seats: 2 });
    await addUsers(2, 50);
    expect((await checkLimit(await db(), 1, "seats", 1))?.allowed).toBe(true);
  });

  it("says the numbers, not just 'limit reached'", async () => {
    // "47 of 50 seats used, this would be the 51st" tells a person what to do next.
    // "Limit reached" tells them to go and ask somebody.
    await setLimits(1, { seats: 2 });
    await addUsers(1, 2);
    let message = "";
    try {
      await assertWithinLimit(await db(), 1, "seats", 1);
    } catch (e: any) {
      message = e.message;
    }
    expect(message).toMatch(/2 of 2/);
    expect(message).toMatch(/would add 1/i);
    expect(message).toMatch(/seats limit/i);
  });

  it("throws a FORBIDDEN a client can render", async () => {
    await setLimits(1, { seats: 0 });
    await addUsers(1, 1);
    await expect(assertWithinLimit(await db(), 1, "seats", 1)).rejects.toBeInstanceOf(
      LimitExceededError
    );
  });

  it("checks the whole batch, not one at a time", async () => {
    // An import of 500 accounts against 10 remaining has to be refused before any of it
    // is written — a partial import that stops halfway leaves the customer working out
    // which half landed.
    await setLimits(1, { accounts: 10 });
    const c = await checkLimit(await db(), 1, "accounts", 500);
    expect(c?.allowed).toBe(false);
    expect(c?.adding).toBe(500);
  });
});

describe("a malformed limit fails open", () => {
  async function setRaw(orgId: number, entitlements: unknown) {
    const store = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    store.organizations.find((o: any) => o.id === orgId).entitlements = entitlements;
    fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
  }

  it("ignores values that are not finite non-negative numbers", async () => {
    // The failure that matters is locking a paying customer out of their own workspace.
    // "many", null and NaN must not become a cap of zero.
    await setRaw(1, { seats: "many", accounts: null, contacts: Number.NaN, aiCallsPerMonth: -5 });
    expect(await entitlementsFor(await db(), 1)).toEqual({});
  });

  it("treats an unreadable entitlements column as no limits", async () => {
    await setRaw(1, "not json at all");
    expect(await entitlementsFor(await db(), 1)).toEqual({});
    await expect(assertWithinLimit(await db(), 1, "seats", 99)).resolves.toBeUndefined();
  });

  it("keeps a zero that was set deliberately", async () => {
    // Zero IS a valid limit — "this workspace may not invite anyone" is a real policy.
    // It just must not be what a typo produces.
    await setRaw(1, { seats: 0 });
    expect(await entitlementsFor(await db(), 1)).toEqual({ seats: 0 });
  });
});

describe("metering AI calls", () => {
  it("counts what was recorded, for this org and this month", async () => {
    const d = await db();
    await recordUsage(d, 1, "ai_call", "gpt-test");
    await recordUsage(d, 1, "ai_call", "gpt-test");
    await recordUsage(d, 2, "ai_call", "gpt-test");
    const usage = await usageFor(d, 1);
    expect(usage.aiCallsPerMonth).toBe(2);
  });

  it("never throws, because a metering failure must not fail the feature", async () => {
    // Losing a row from an invoice is a far smaller problem than an AI feature that
    // breaks because a usage insert timed out.
    await expect(recordUsage(null, 1, "ai_call")).resolves.toBeUndefined();
    await expect(
      recordUsage({ insert: () => { throw new Error("db down"); } }, 1, "ai_call")
    ).resolves.toBeUndefined();
  });

  it("counts from the start of the calendar month, in UTC", async () => {
    const m = monthStart(new Date("2026-09-20T12:00:00Z"));
    expect(m.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("usage with no database", () => {
  it("reports zeroes rather than throwing", async () => {
    expect(await usageFor(null, 1)).toEqual({
      seats: 0,
      accounts: 0,
      contacts: 0,
      aiCallsPerMonth: 0,
    });
  });
});
