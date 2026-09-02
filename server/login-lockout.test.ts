import { describe, it, expect } from "vitest";
import { recordFailedLogin, getLoginLockout, clearLoginAttempts } from "./_core/security";

/**
 * The login lockout was keyed by IP alone, and clearLoginAttempts deleted the WHOLE
 * per-IP record on any successful login from that IP — not just the account that
 * succeeded. On a shared IP (office NAT, VPN, CGNAT, campus wifi), an attacker
 * sustaining a brute-force campaign against one coworker's account got their failed-
 * attempt count silently wiped every time ANY other employee on that same connection
 * happened to sign in to their own, completely unrelated account. The lockout could
 * never actually engage on a busy shared IP. Fixed by keying on (IP, account) instead,
 * so clearing on success only ever touches the account that actually succeeded.
 */

let counter = 0;
// A fresh IP/email pair per test avoids cross-test pollution in the module-level store
// without needing a reset hook — mirrors the pattern used for admin-approval-api.test.ts.
function unique() {
  counter += 1;
  return { ip: `203.0.113.${counter}`, email: `victim${counter}@example.com` };
}

describe("login lockout — per-account isolation on a shared IP", () => {
  it("does not let a different account's successful login on the same IP clear an ongoing attack", async () => {
    const ip = `198.51.100.${++counter}`;
    const victim = `victim-${counter}@example.com`;
    const coworker = `coworker-${counter}@example.com`;

    // Attacker: 4 of 5 allowed failures against the victim's account, from a shared IP.
    for (let i = 0; i < 4; i++) await recordFailedLogin(ip, victim);
    expect((await getLoginLockout(ip, victim)).locked).toBe(false);

    // An unrelated coworker on the same IP logs in successfully to THEIR OWN account —
    // an entirely ordinary event on a shared connection.
    await clearLoginAttempts(ip, coworker);

    // The attack in progress against the victim's account must still be exactly where
    // it was — one more failure should lock it.
    await recordFailedLogin(ip, victim);
    expect((await getLoginLockout(ip, victim)).locked).toBe(true);
  });

  it("still locks out after 5 failed attempts against the same (IP, account) pair", async () => {
    const { ip, email } = unique();
    for (let i = 0; i < 4; i++) await recordFailedLogin(ip, email);
    expect((await getLoginLockout(ip, email)).locked).toBe(false);
    await recordFailedLogin(ip, email);
    expect((await getLoginLockout(ip, email)).locked).toBe(true);
  });

  it("clearing attempts for the account that actually succeeded un-does its own lockout state", async () => {
    const { ip, email } = unique();
    for (let i = 0; i < 5; i++) await recordFailedLogin(ip, email);
    expect((await getLoginLockout(ip, email)).locked).toBe(true);

    await clearLoginAttempts(ip, email);
    expect((await getLoginLockout(ip, email)).locked).toBe(false);
  });

  it("treats the same account from two different IPs as independent lockout identities", async () => {
    const email = `shared-account-${++counter}@example.com`;
    const ipA = `192.0.2.${counter}`;
    const ipB = `192.0.2.${counter + 1000}`;

    for (let i = 0; i < 5; i++) await recordFailedLogin(ipA, email);
    expect((await getLoginLockout(ipA, email)).locked).toBe(true);
    expect((await getLoginLockout(ipB, email)).locked).toBe(false);
  });

  it("is case-insensitive on the email half of the key, matching login's own normalization", async () => {
    const { ip } = unique();
    const email = `Mixed.Case+${counter}@Example.COM`;
    for (let i = 0; i < 5; i++) await recordFailedLogin(ip, email.toLowerCase());
    expect((await getLoginLockout(ip, email.toUpperCase())).locked).toBe(true);
  });
});
