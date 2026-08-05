import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Sessions, in the configuration the README actually tells people to use.
 *
 * Two defects met here, and each hid the other.
 *
 *   1. ENV.appId defaulted to "". createSessionToken puts it in the payload and
 *      verifySession rejects a payload whose appId is not a non-empty string — so
 *      every session token this app minted failed its own verification. Always.
 *
 *   2. Nothing looked wrong, because DEMO_MODE falls back to a demo admin user when
 *      verification returns null. Sign-in appeared to work. It was the fallback
 *      working. With DEMO_MODE=false you would sign in, get a cookie, and be signed
 *      out on the very next request, with a console warning as the only evidence.
 *
 * And a third, introduced while fixing those: tightening the weak-secret check made
 * the shipped placeholder correctly worthless, which sent dev sessions onto a random
 * per-process key — one that changes on every `pnpm dev` reload. Signing in and being
 * signed out by your own next file save is not a demo anyone can give.
 */

const SECRET_FILE = path.join(process.cwd(), ".dev-session-secret");
const ORIGINAL = { ...process.env };

async function freshSdk() {
  // A new module instance stands in for a restarted server process. resetModules
  // rather than a ?query import — Vite refuses the latter on a .ts path.
  vi.resetModules();
  const mod = await import("./_core/sdk");
  return mod.sdk;
}

beforeEach(() => {
  // Exactly what `cp .env.example .env` gives you: demo mode, the placeholder
  // secret, and no VITE_APP_ID.
  process.env.DEMO_MODE = "true";
  process.env.NODE_ENV = "development";
  process.env.JWT_SECRET = "dev-only-insecure-secret-replace-me-with-openssl-rand-base64-48";
  delete process.env.VITE_APP_ID;
  try { fs.unlinkSync(SECRET_FILE); } catch { /* not there */ }
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(SECRET_FILE); } catch { /* not there */ }
});

describe("a session issued in the documented config", () => {
  it("verifies at all", async () => {
    // The bug: this returned null for every token the app had ever issued.
    const sdk = await freshSdk();
    const token = await sdk.createSessionToken("user-42", { name: "Rep" });
    const session = await sdk.verifySession(token);

    expect(session).not.toBeNull();
    expect(session!.openId).toBe("user-42");
    expect(session!.appId).toBeTruthy();
  });

  it("still verifies after a restart", async () => {
    // Under `pnpm dev` a restart is every file save. A per-process signing key means
    // signing in and then being signed out by your own next keystroke.
    const before = await freshSdk();
    const token = await before.createSessionToken("user-42", { name: "Rep" });

    const after = await freshSdk();
    const session = await after.verifySession(token);

    expect(session?.openId).toBe("user-42");
  });

  it("writes a real local secret rather than reusing the public placeholder", async () => {
    const sdk = await freshSdk();
    await sdk.createSessionToken("user-42", { name: "Rep" });

    expect(fs.existsSync(SECRET_FILE)).toBe(true);
    const secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
    expect(secret.length).toBeGreaterThanOrEqual(32);
    // The whole point: not the value printed in the repository.
    expect(secret).not.toContain("dev-only-insecure");
    expect(secret).not.toBe(process.env.JWT_SECRET);
  });

  it("uses a real JWT_SECRET when one is set, in preference to the local file", async () => {
    process.env.JWT_SECRET = "mVQhTQ0oRe1xM+cCq4lXcQ0v8hI9BvvB8sHRcYGpBBH7cD9K1o0hHXAG0S9nQyUZ";
    const sdk = await freshSdk();
    const token = await sdk.createSessionToken("user-9", { name: "Rep" });

    expect(await sdk.verifySession(token)).toMatchObject({ openId: "user-9" });
    // A configured secret needs no local fallback file.
    expect(fs.existsSync(SECRET_FILE)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const sdk = await freshSdk();
    const token = await sdk.createSessionToken("user-42", { name: "Rep" });

    // Someone else's key — the forgery this whole mechanism exists to stop.
    try { fs.unlinkSync(SECRET_FILE); } catch { /* fine */ }
    const other = await freshSdk();
    expect(await other.verifySession(token)).toBeNull();
  });

  it("rejects junk without throwing", async () => {
    const sdk = await freshSdk();
    expect(await sdk.verifySession("not-a-jwt")).toBeNull();
    expect(await sdk.verifySession("")).toBeNull();
    expect(await sdk.verifySession(undefined)).toBeNull();
  });
});
