import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isWeakSecret, MIN_SECRET_LENGTH } from "./weak-secret";

/**
 * The guard that didn't guard.
 *
 * `sdk.getSessionSecret` refused to sign in production with a weak JWT_SECRET, and
 * defined weak as: empty, under 16 characters, or exactly the string
 * "change-this-to-a-long-random-string".
 *
 * That string appears nowhere in this repository. The placeholder `.env.example`
 * actually ships is 61 characters long and is not it — so following the documented
 * setup and deploying with DEMO_MODE=false signed real session cookies with a key
 * printed in a public repo.
 *
 * The first test below reads .env.example off disk on purpose. Hardcoding today's
 * placeholder would recreate the original bug the moment someone edits that file.
 */

describe("isWeakSecret", () => {
  it("rejects the placeholder .env.example actually ships", () => {
    const example = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    const line = example.split("\n").find((l) => l.startsWith("JWT_SECRET="));
    expect(line, ".env.example has no JWT_SECRET line to check").toBeTruthy();

    const shipped = line!.slice("JWT_SECRET=".length).trim();
    expect(shipped.length).toBeGreaterThan(0);
    // Whatever that file says today, it must not be usable as a real secret.
    expect(isWeakSecret(shipped)).toBe(true);
  });

  it("rejects empty, missing and short values", () => {
    expect(isWeakSecret(undefined)).toBe(true);
    expect(isWeakSecret(null)).toBe(true);
    expect(isWeakSecret("")).toBe(true);
    expect(isWeakSecret("   ")).toBe(true);
    expect(isWeakSecret("a".repeat(MIN_SECRET_LENGTH - 1))).toBe(true);
  });

  it("rejects long placeholders, which length alone never caught", () => {
    // Every one of these clears 16 characters. Length was the only real test before.
    expect(isWeakSecret("change-this-to-a-long-random-string")).toBe(true);
    expect(isWeakSecret("dev-only-insecure-secret-replace-me-with-openssl-rand-base64-48")).toBe(true);
    expect(isWeakSecret("please-replace-me-before-going-to-production")).toBe(true);
    expect(isWeakSecret("your-secret-goes-right-here-ok")).toBe(true);
    expect(isWeakSecret("EXAMPLE-SECRET-DO-NOT-USE-IN-PROD")).toBe(true);
    expect(isWeakSecret("placeholder-value-1234567890")).toBe(true);
  });

  it("is case-insensitive, because people shout their placeholders", () => {
    expect(isWeakSecret("CHANGEME-CHANGEME-CHANGEME")).toBe(true);
    expect(isWeakSecret("Dev-Only-Do-Not-Ship-This-Value")).toBe(true);
  });

  it("accepts a real generated secret", () => {
    // openssl rand -base64 48, which is what the docs tell you to run.
    expect(isWeakSecret("mVQhTQ0oRe1xM+cCq4lXcQ0v8hI9BvvB8sHRcYGpBBH7cD9K1o0hHXAG0S9nQyUZ")).toBe(false);
    expect(isWeakSecret("f3a9c1e7b5d2084617fbc0a3e8d15926473c0b8faa215e6d")).toBe(false);
  });

  it("does not reject a strong secret that happens to contain a common word", () => {
    // "insecure" and friends are markers; ordinary words must not be. A false
    // rejection in production is an outage, so the list stays narrow on purpose.
    expect(isWeakSecret("correcthorsebatterystaple-9f2b7c1d4a8e")).toBe(false);
    expect(isWeakSecret("Xk92mPqR7vN4tYw8ZbC5hJ3dLfG6sA1eQrTyUiOp")).toBe(false);
  });
});
