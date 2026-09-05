import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The other half of the org boundary: putting customers on opposite sides of it.
 *
 * Every tenant table carries an `orgId`, every query filters on it, and a build check
 * fails if one stops. All of that was true and all of it was inert, because nothing ever
 * created an organization — the table was written by no code path at all. Every signup in
 * every deployment took the column default and landed in org 1, so two customers shared a
 * workspace exactly as before, while the README said isolation was enforced.
 *
 * A boundary that nothing puts anyone on the far side of is not a boundary. These tests
 * are about the part that makes it real, and about the two ways it can go wrong: a new
 * customer landing in the incumbent's workspace, or a paying customer stuck behind an
 * approval nobody is watching.
 */

const DB_PATH = path.join(process.cwd(), "onboarding-test-db.json");

function freshStore() {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify({ organizations: [], users: [], accounts: [], contacts: [] }, null, 2)
  );
}

function store() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

beforeEach(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  freshStore();
  vi.resetModules();
});

afterEach(() => {
  delete process.env.SIGNUP_MODE;
  fs.rmSync(DB_PATH, { force: true });
  vi.resetModules();
});

async function signUp(name: string, email: string) {
  const { appRouter } = await import("./routers");
  const ctx = { user: null, orgId: null, req: { headers: {}, socket: {} }, res: { cookie: () => {} } };
  return await appRouter.createCaller(ctx as any).auth.signUp({
    name,
    email,
    password: "Xk9#mLp2$vNq",
  });
}

describe("signup — invite-only (the default, and what every existing install does)", () => {
  it("puts a new signup in the existing organization, pending approval", async () => {
    await signUp("Dana", "dana@example.com");

    const [user] = store().users;
    expect(user.orgId).toBe(1);
    expect(user.isApproved).toBe(false);
    expect(user.role).toBe("user");
  });

  it("creates no organization — this mode is one workspace by design", async () => {
    await signUp("Dana", "dana@example.com");
    expect(store().organizations).toHaveLength(0);
  });
});

describe("signup — self-serve (what selling to more than one customer means)", () => {
  beforeEach(() => {
    process.env.SIGNUP_MODE = "self-serve";
  });

  it("gives the first customer their own organization, and makes them its admin", async () => {
    await signUp("Dana", "dana@example.com");

    const { organizations, users } = store();
    expect(organizations).toHaveLength(1);

    const [user] = users;
    expect(user.orgId).toBe(organizations[0].id);
    // No one exists to approve the first member of a brand-new org — they ARE the
    // customer. Waiting for an admin would mean waiting for themselves.
    expect(user.isApproved).toBe(true);
    expect(user.role).toBe("admin");
  });

  it("puts a SECOND customer in a DIFFERENT organization", async () => {
    // The whole point. Before this, both landed in org 1 and saw each other's accounts
    // and pipeline — the exact scenario the isolation work was for, still live because
    // nothing ever assigned an org.
    await signUp("Dana", "dana@example.com");
    await signUp("Sam", "sam@other.example.com");

    const { organizations, users } = store();
    expect(organizations).toHaveLength(2);

    const orgIds = users.map((u: any) => u.orgId);
    expect(new Set(orgIds).size).toBe(2);
    expect(orgIds).not.toContain(undefined);
  });

  it("never puts a new customer into the incumbent's workspace", async () => {
    // The failure that matters most: a fallback that looks harmless — defaulting to the
    // default org when creation fails — drops a brand-new customer straight into whoever
    // is already there. createOrganization throws instead.
    //
    // Modelled as a real deployment rather than an empty one: the default org exists and
    // already holds someone. (In a genuinely empty store the first org created IS org 1,
    // which is correct, not a leak — the assertion has to be about whose data is there,
    // not about the number.)
    const { ensureDefaultOrganization } = await import("./_core/onboarding");
    const { getDb } = await import("./db");
    await ensureDefaultOrganization(await getDb());

    const seeded = store();
    seeded.users.push({ id: 900, orgId: 1, email: "incumbent@example.com", name: "Incumbent" });
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2));

    await signUp("Dana", "dana@example.com");

    const dana = store().users.find((u: any) => u.email === "dana@example.com");
    expect(dana.orgId).not.toBe(1);
    expect(store().organizations.length).toBeGreaterThan(1);
  });

  it("handles two customers with the same name instead of refusing the second", async () => {
    // A second "Acme" is an ordinary event on a self-serve product. Refusing it would be
    // a dead end for a customer whose only mistake was sharing a name.
    await signUp("Acme", "one@acme.example.com");
    await signUp("Acme", "two@acme-two.example.com");

    const slugs = store().organizations.map((o: any) => o.slug);
    expect(slugs).toHaveLength(2);
    expect(new Set(slugs).size).toBe(2);
  });
});

describe("the default organization exists as a real row", () => {
  it("is created on boot, and creating it twice is a no-op", async () => {
    // orgId defaults to 1 on all 34 tenant tables, so org 1 is referenced by every
    // existing row in every existing deployment — while never having existed as a record.
    // Anything that lists organizations would have found the incumbent to be the one
    // that is missing.
    const { ensureDefaultOrganization } = await import("./_core/onboarding");
    const { getDb } = await import("./db");
    const db = await getDb();

    await ensureDefaultOrganization(db);
    await ensureDefaultOrganization(db);

    const orgs = store().organizations;
    expect(orgs).toHaveLength(1);
    expect(orgs[0].id).toBe(1);
  });
});

describe("the mode is reported, not guessed", () => {
  it("names which signup mode is live", async () => {
    // An operator running self-serve while believing it is invite-only is handing out
    // workspaces; one running invite-only while believing it is self-serve has customers
    // stuck at a screen nobody watches. Neither is visible from inside the app.
    const { buildReport } = await import("./integrations/preflight");

    process.env.SIGNUP_MODE = "self-serve";
    vi.resetModules();
    const selfServe = await (await import("./integrations/preflight")).buildReport();
    expect(selfServe.core.find(c => c.name === "Signup")?.message).toMatch(/self-serve/i);

    delete process.env.SIGNUP_MODE;
    vi.resetModules();
    const inviteOnly = await (await import("./integrations/preflight")).buildReport();
    const finding = inviteOnly.core.find(c => c.name === "Signup");
    expect(finding?.message).toMatch(/invite-only/i);
    // And says what to change to sell to more than one customer.
    expect(finding?.fix).toMatch(/SIGNUP_MODE=self-serve/);
    expect(buildReport).toBeTypeOf("function");
  });
});
