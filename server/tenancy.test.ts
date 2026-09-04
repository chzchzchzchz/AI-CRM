import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The org boundary, and the reason a half-finished one is still safe.
 *
 * `protectedProcedure` reads as "this is protected". What it actually guaranteed was
 * "somebody is signed in" — it said nothing about whose data the resolver then read, and
 * no query carried an owner. Two customers on one deployment would have seen each other's
 * accounts and pipeline. The README said one deployment per team, which is honest and is
 * not a control: nothing stopped an operator from creating the second customer's users.
 *
 * Scoping every query is a large mechanical migration. These tests are about the property
 * that has to hold WHILE it is unfinished: a deployment must not be able to enter the
 * state where the missing scoping leaks. The refusal is driven by a count that
 * `pnpm check:claims` recomputes from source, so it cannot be edited down to zero.
 */

async function tenancyWith(unscoped: number) {
  vi.resetModules();
  vi.doMock("@shared/tenancy-status", () => ({ UNSCOPED_QUERY_SITES: unscoped }));
  return await import("./_core/tenancy");
}

afterEach(() => {
  vi.doUnmock("@shared/tenancy-status");
  vi.resetModules();
});

describe("org resolution", () => {
  it("reads the org from the session user", async () => {
    const { orgIdFor } = await tenancyWith(0);
    expect(orgIdFor({ orgId: 7 } as any)).toBe(7);
  });

  it("falls back to the default org for a row written before the column existed", async () => {
    // The column defaults to 1 and is not nullable, but a hand-built user object (the
    // in-memory demo admin, a test fixture) can still arrive without one. Resolving to
    // the default beats resolving to undefined, which in a query reads as "no filter".
    const { orgIdFor, DEFAULT_ORG_ID } = await tenancyWith(0);
    expect(orgIdFor({ orgId: null } as any)).toBe(DEFAULT_ORG_ID);
    expect(orgIdFor({} as any)).toBe(DEFAULT_ORG_ID);
  });
});

describe("second-org refusal while queries are unscoped", () => {
  it("refuses a non-default org while any query still runs unscoped", async () => {
    const { assertOrgAllowed } = await tenancyWith(116);
    expect(() => assertOrgAllowed(2)).toThrow(/more than one organization/i);
  });

  it("names the count and the remedy, so the operator is not left guessing", async () => {
    // The failure mode this replaces is silent: customer B sees customer A's accounts and
    // nothing anywhere says why. An error that just says "forbidden" would be a smaller
    // version of the same problem.
    const { assertOrgAllowed } = await tenancyWith(116);
    let message = "";
    try {
      assertOrgAllowed(2);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/116/);
    expect(message).toMatch(/one deployment per customer/i);
  });

  it("still admits the default org — a single-tenant install must keep working", async () => {
    const { assertOrgAllowed, DEFAULT_ORG_ID } = await tenancyWith(116);
    expect(() => assertOrgAllowed(DEFAULT_ORG_ID)).not.toThrow();
  });

  it("lifts the refusal on its own once the count reaches zero", async () => {
    // Nothing to remember to switch on. The migration finishing IS the switch, which is
    // the only version of this that cannot be half-done and forgotten.
    const { assertOrgAllowed, isMultiOrgSafe } = await tenancyWith(0);
    expect(isMultiOrgSafe()).toBe(true);
    expect(() => assertOrgAllowed(2)).not.toThrow();
    expect(() => assertOrgAllowed(99)).not.toThrow();
  });

  it("applies the same refusal outside tRPC, where there is no TRPCError to throw", async () => {
    // Sync jobs, the MCP server and CLI entry points reach the same data by a different
    // door. A guard only on the tRPC path would be a guard on the front door of a house
    // with the back door open.
    const { assertOrgAllowedOrThrow } = await tenancyWith(116);
    expect(() => assertOrgAllowedOrThrow(2)).toThrow(/without an org filter/i);
    expect(() => assertOrgAllowedOrThrow(1)).not.toThrow();
  });
});

describe("the audit behind the count", () => {
  it("counts a query with no org filter and clears one that has it", async () => {
    // Guards the guard: if the audit stopped detecting unscoped queries, the count would
    // drift to zero, the refusal would lift, and the leak it prevents would be back —
    // with a green build. check-claims pins the number; this pins what produces it.
    const { auditTenancy } = await import("../scripts/tenancy-audit.mjs");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tenancy-"));
    fs.mkdirSync(path.join(root, "server"));
    fs.writeFileSync(
      path.join(root, "server", "sample.ts"),
      [
        "const a = await db.select().from(accounts).where(eq(accounts.id, id));",
        "const b = await db.select().from(accounts).where(and(eq(accounts.orgId, orgId), eq(accounts.id, id)));",
      ].join("\n")
    );

    const sites = auditTenancy(root);
    expect(sites).toHaveLength(1);
    expect(sites[0].table).toBe("accounts");
    expect(sites[0].line).toBe(1);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it("does not call a multi-line query unscoped just because it wraps", async () => {
    // A line-based scan would see `.from(accounts)` and the `.where` on a later line as
    // unrelated and report every formatted query in the codebase as a leak — a count so
    // wrong it would never come down, and an audit nobody trusts is an audit nobody runs.
    const { auditTenancy } = await import("../scripts/tenancy-audit.mjs");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tenancy-"));
    fs.mkdirSync(path.join(root, "server"));
    fs.writeFileSync(
      path.join(root, "server", "wrapped.ts"),
      [
        "const rows = await db",
        "  .select()",
        "  .from(contacts)",
        "  .where(and(eq(contacts.orgId, orgId), eq(contacts.accountId, id)))",
        "  .orderBy(desc(contacts.createdAt));",
      ].join("\n")
    );

    expect(auditTenancy(root)).toHaveLength(0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("ignores tables that are not tenant data", async () => {
    const { auditTenancy } = await import("../scripts/tenancy-audit.mjs");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tenancy-"));
    fs.mkdirSync(path.join(root, "server"));
    fs.writeFileSync(
      path.join(root, "server", "auth.ts"),
      "const u = await db.select().from(users).where(eq(users.email, email));\n" +
        "const l = await db.insert(auditLogs).values({ action });\n"
    );

    expect(auditTenancy(root)).toHaveLength(0);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
