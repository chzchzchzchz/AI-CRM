import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createMockContext } from "./test-utils";

/**
 * How a customer's colleague joins the customer's workspace.
 *
 * Neither existing path could do it. Self-serve signup creates a NEW organization —
 * right for a new customer, wrong for their second employee, who would get an empty
 * workspace of their own. The public access-request form runs before any session exists,
 * so it has no org to attach to and lands in the default one, where the admin who
 * actually wanted the teammate never sees it.
 *
 * So a sales-team product could not have a team on it. These tests are about the path
 * that fixes that, and about the ways an invitation can be abused: reused, shared,
 * accepted twice at once, or revoked by someone in a different organization.
 */

const DB_PATH = path.join(process.cwd(), "invites-test-db.json");

const ADMIN_A = { id: 10, orgId: 2, role: "admin" as const, email: "admin@alpha.example" };
const ADMIN_B = { id: 20, orgId: 3, role: "admin" as const, email: "admin@beta.example" };
const MEMBER_A = { id: 11, orgId: 2, role: "user" as const, email: "member@alpha.example" };

function store() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

beforeEach(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      {
        organizations: [
          { id: 2, name: "Alpha", slug: "alpha" },
          { id: 3, name: "Beta", slug: "beta" },
        ],
        organization_invites: [],
        users: [
          { ...ADMIN_A, name: "Admin A", openId: "a", isApproved: true },
          { ...ADMIN_B, name: "Admin B", openId: "b", isApproved: true },
          { ...MEMBER_A, name: "Member A", openId: "m", isApproved: true },
        ],
      },
      null,
      2
    )
  );
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(DB_PATH, { force: true });
  vi.resetModules();
});

async function caller(who: { id: number; orgId: number; role: "admin" | "user" }) {
  const { invitesRouter } = await import("./invites-router");
  return invitesRouter.createCaller(createMockContext(who as any) as any);
}

async function publicCaller() {
  const { invitesRouter } = await import("./invites-router");
  return invitesRouter.createCaller({ user: null, orgId: null } as any);
}

function tokenFrom(acceptUrl: string) {
  return decodeURIComponent(new URL(acceptUrl).searchParams.get("token")!);
}

describe("issuing an invitation", () => {
  it("returns a link, and stores only a hash of it", async () => {
    // The row is a bearer credential that creates an approved account inside a customer's
    // workspace. A database dump must not be a set of working invitations.
    const a = await caller(ADMIN_A);
    const res = await a.create({ email: "New@Alpha.example", role: "user" });

    const token = tokenFrom(res.acceptUrl);
    expect(token.length).toBeGreaterThan(30);

    const [row] = store().organization_invites;
    expect(row.tokenHash).not.toContain(token);
    expect(row.tokenHash).toHaveLength(64);
    // Normalised, so the same address invited two ways is the same person.
    expect(row.email).toBe("new@alpha.example");
    expect(row.orgId).toBe(2);
  });

  it("refuses a non-admin", async () => {
    const m = await caller(MEMBER_A);
    await expect(m.create({ email: "x@alpha.example", role: "user" })).rejects.toThrow(/admin/i);
  });

  it("refuses an address that already has an account, and says which case it is", async () => {
    // Identity is global by email here — one address, one account. Inviting an existing
    // one cannot silently move that person between organizations, so it is refused with
    // the reason rather than creating an account they could never sign into.
    const a = await caller(ADMIN_A);
    await expect(a.create({ email: MEMBER_A.email, role: "user" })).rejects.toThrow(/already in your workspace/i);
    await expect(a.create({ email: ADMIN_B.email, role: "user" })).rejects.toThrow(/elsewhere/i);
  });
});

describe("accepting an invitation", () => {
  it("creates the account inside the INVITING organization", async () => {
    // The whole point: the token names the workspace, so joining is decided by the admin
    // who issued it — not inferred from an email domain, not chosen by the joiner.
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "colleague@alpha.example", role: "user" });

    const pub = await publicCaller();
    await pub.accept({ token: tokenFrom(acceptUrl), name: "Colleague", password: "Xk9#mLp2$vNq" });

    const created = store().users.find((u: any) => u.email === "colleague@alpha.example");
    expect(created.orgId).toBe(2);
    // An invitation IS the approval; a second one from the admin who just invited them
    // would be a queue with nothing in it.
    expect(created.isApproved).toBe(true);
    expect(created.role).toBe("user");
  });

  it("honours the invited role", async () => {
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "second-admin@alpha.example", role: "admin" });
    const pub = await publicCaller();
    await pub.accept({ token: tokenFrom(acceptUrl), name: "Second", password: "Xk9#mLp2$vNq" });
    expect(store().users.find((u: any) => u.email === "second-admin@alpha.example").role).toBe("admin");
  });

  it("is single-use", async () => {
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "once@alpha.example", role: "user" });
    const token = tokenFrom(acceptUrl);

    const pub = await publicCaller();
    await pub.accept({ token, name: "Once", password: "Xk9#mLp2$vNq" });
    await expect(
      pub.accept({ token, name: "Twice", password: "Xk9#mLp2$vNq" })
    ).rejects.toThrow(/already been used/i);

    expect(store().users.filter((u: any) => u.email === "once@alpha.example")).toHaveLength(1);
  });

  it("gives only ONE seat when the same link is opened twice at once", async () => {
    // A forwarded link opened simultaneously. Every check passes for both, so the claim
    // has to be the thing that decides — and the loser must be told, not quietly given a
    // second account inside a customer's workspace.
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "racer@alpha.example", role: "user" });
    const token = tokenFrom(acceptUrl);

    const pub = await publicCaller();
    const results = await Promise.allSettled([
      pub.accept({ token, name: "First", password: "Xk9#mLp2$vNq" }),
      pub.accept({ token, name: "Second", password: "Xk9#mLp2$vNq" }),
    ]);

    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(store().users.filter((u: any) => u.email === "racer@alpha.example")).toHaveLength(1);
  });

  it("refuses a weak password rather than creating a weak account", async () => {
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "weak@alpha.example", role: "user" });
    const pub = await publicCaller();
    await expect(
      pub.accept({ token: tokenFrom(acceptUrl), name: "Weak", password: "password" })
    ).rejects.toThrow(/password/i);
    expect(store().users.find((u: any) => u.email === "weak@alpha.example")).toBeUndefined();
  });

  it("refuses a token that names nothing", async () => {
    const pub = await publicCaller();
    await expect(
      pub.accept({ token: "not-a-real-token", name: "Nobody", password: "Xk9#mLp2$vNq" })
    ).rejects.toThrow(/isn't valid/i);
  });
});

describe("revoking", () => {
  it("stops an unused invitation from working", async () => {
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "revoked@alpha.example", role: "user" });
    const [row] = store().organization_invites;

    await a.revoke({ id: row.id });

    const pub = await publicCaller();
    await expect(
      pub.accept({ token: tokenFrom(acceptUrl), name: "Nope", password: "Xk9#mLp2$vNq" })
    ).rejects.toThrow(/withdrawn/i);
  });

  it("refuses to revoke another organization's invitation", async () => {
    // And says so. Reporting success would tell an admin they had closed a way into
    // their workspace when they had not — and it is not their invitation anyway.
    const a = await caller(ADMIN_A);
    await a.create({ email: "alpha-invitee@alpha.example", role: "user" });
    const [row] = store().organization_invites;

    const b = await caller(ADMIN_B);
    await expect(b.revoke({ id: row.id })).rejects.toThrow(/not yours/i);

    expect(store().organization_invites[0].revokedAt).toBeFalsy();
  });
});

describe("what the person at the link sees first", () => {
  it("shows the address it was sent to, and nothing about the workspace", async () => {
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "preview@alpha.example", role: "user" });

    const pub = await publicCaller();
    const seen: any = await pub.preview({ token: tokenFrom(acceptUrl) });

    expect(seen.valid).toBe(true);
    expect(seen.email).toBe("preview@alpha.example");
    // Deliberately absent: anything that would distinguish a real customer's workspace
    // from an empty one to someone holding a link.
    expect(Object.keys(seen).sort()).toEqual(["email", "role", "valid"]);
  });

  it("explains a broken link differently depending on why", async () => {
    // "Already used" and "not valid" send a person to different places — the first to
    // whoever has their password, the second back to the admin for a new link.
    const { rejectionMessage } = await import("./_core/invites");
    expect(rejectionMessage("expired")).toMatch(/expired/i);
    expect(rejectionMessage("already-accepted")).toMatch(/already been used/i);
    expect(rejectionMessage("revoked")).toMatch(/withdrawn/i);
    expect(rejectionMessage("not-found")).toMatch(/isn't valid/i);

    const messages = new Set(
      (["expired", "already-accepted", "revoked", "not-found"] as const).map(rejectionMessage)
    );
    expect(messages.size).toBe(4);
  });

  it("refuses an expired invitation", async () => {
    const a = await caller(ADMIN_A);
    const { acceptUrl } = await a.create({ email: "stale@alpha.example", role: "user" });

    const data = store();
    data.organization_invites[0].expiresAt = new Date(Date.now() - 60_000).toISOString();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

    const pub = await publicCaller();
    const seen: any = await pub.preview({ token: tokenFrom(acceptUrl) });
    expect(seen.valid).toBe(false);
    expect(seen.message).toMatch(/expired/i);
  });
});

describe("listing", () => {
  it("shows only the caller's own organization's invitations, never the token", async () => {
    const a = await caller(ADMIN_A);
    await a.create({ email: "one@alpha.example", role: "user" });
    const b = await caller(ADMIN_B);
    await b.create({ email: "one@beta.example", role: "user" });

    const mine: any[] = await a.list();
    expect(mine).toHaveLength(1);
    expect(mine[0].email).toBe("one@alpha.example");
    expect(mine[0].status).toBe("pending");
    expect(JSON.stringify(mine)).not.toMatch(/tokenHash|token/i);
  });
});
