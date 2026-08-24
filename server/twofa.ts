/**
 * Two-factor authentication — the parts that must be right.
 *
 * This is split out from the router because the login path needs it before a session
 * exists, and the router's procedures are all session-scoped.
 *
 * Three things were wrong with the original implementation, which was written, never
 * mounted, and claimed in the README as shipped:
 *
 *   1. `verify` was a protectedProcedure. Login-time 2FA happens *before* a session is
 *      granted, so a procedure requiring one could never be part of the login flow.
 *      Anything it protected was already past the gate.
 *
 *   2. Backup codes were generated, displayed at enrolment, and never stored. There was
 *      no column for them. A user who lost their phone held a printed list of strings
 *      that could not be redeemed, and no way to find out until they needed one.
 *
 *   3. Those codes came from Math.random(), which is not a CSPRNG. For a string that
 *      bypasses the second factor entirely, that is the whole point of the control.
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
// @ts-ignore - speakeasy ships no type definitions
import speakeasy from "speakeasy";

// Not destructured: speakeasy's totp helpers call each other through `this`, so a
// detached reference throws "Cannot read properties of undefined (reading 'hotp')".
const sp = speakeasy as any;

/** How many recovery codes to issue at enrolment. */
export const BACKUP_CODE_COUNT = 10;

/**
 * Accept a code from the adjacent time steps as well as the current one.
 *
 * ±1 step (30s each) tolerates ordinary clock drift between the phone and the server.
 * The original used window: 2, which is ±60s — five valid codes at any moment rather
 * than three. Narrower is better as long as real users can still get in.
 */
const TOTP_WINDOW = 1;

/** Verify a TOTP code against a base32 secret. */
export function verifyTotp(secret: string, code: string): boolean {
  if (!secret || !code) return false;
  return !!sp.totp.verify({
    secret,
    encoding: "base32",
    token: code.replace(/\s/g, ""),
    window: TOTP_WINDOW,
  });
}

/**
 * Generate recovery codes.
 *
 * crypto.randomBytes, not Math.random: these are credentials. Formatted in two groups
 * so they can be read aloud and typed without ambiguity, and uppercased because that is
 * how people write them down.
 */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Hash recovery codes for storage. They are credentials, so they are never stored in the clear. */
export async function hashBackupCodes(codes: string[]): Promise<string> {
  const hashes = await Promise.all(codes.map((c) => bcrypt.hash(normalizeBackupCode(c), 10)));
  return JSON.stringify(hashes);
}

/** Codes are typed by hand, so compare them case- and separator-insensitively. */
export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Serializes async work per userId within this process.
 *
 * redeemBackupCode is a pure function over a snapshot: read the stored hashes, find a
 * match, return what's left for the caller to write back. Redeeming is a read → compute
 * → write sequence with no compare-and-swap, so two concurrent redemptions for the same
 * account — someone who has obtained two different valid backup codes and fires both at
 * once — can both read the same starting set, each remove only their own code from that
 * shared snapshot, and whichever write lands last wins: the other "used" code is never
 * actually removed from storage and stays redeemable. Queuing every login-time
 * redemption for a user behind the previous one closes that: the second request's read
 * always sees the first one's write. Same accepted single-instance scope as the
 * challenge store above — a multi-instance deployment needs this in shared storage.
 */
const userLocks = new Map<number, Promise<unknown>>();
export function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  // The stored tail is always the caught/never-rejecting form (see below), so it is
  // safe to chain onto with a plain .then — there is no rejection branch to handle.
  const prior = userLocks.get(userId) ?? Promise.resolve();
  const run = prior.then(fn);
  // Never leave a rejected promise as the queue's tail, or every later call for this
  // user would immediately re-reject without ever running `fn`.
  userLocks.set(userId, run.catch(() => undefined));
  return run;
}

/**
 * Redeem a recovery code.
 *
 * Returns the remaining hashes when the code matches, so the caller can write them
 * back — a recovery code is single-use, and one that still works after being used is
 * a permanent bypass of the second factor.
 */
export async function redeemBackupCode(
  stored: string | null | undefined,
  code: string
): Promise<{ ok: boolean; remaining: string | null }> {
  if (!stored) return { ok: false, remaining: null };
  let hashes: string[];
  try {
    hashes = JSON.parse(stored);
    if (!Array.isArray(hashes)) return { ok: false, remaining: null };
  } catch {
    return { ok: false, remaining: null };
  }

  const candidate = normalizeBackupCode(code);
  if (!candidate) return { ok: false, remaining: null };

  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(candidate, hashes[i])) {
      const remaining = hashes.filter((_, idx) => idx !== i);
      return { ok: true, remaining: JSON.stringify(remaining) };
    }
  }
  return { ok: false, remaining: null };
}

/** How many recovery codes are left, for the settings page to warn on. */
export function countBackupCodes(stored: string | null | undefined): number {
  if (!stored) return 0;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/* -------------------------------------------------------------- login challenge */

/**
 * A short-lived ticket proving the password step passed, issued instead of a session.
 *
 * Held in memory, like the brute-force lockout store next to it. That means a server
 * restart invalidates outstanding challenges and a user has to enter their password
 * again — which is the safe direction to fail, and acceptable for a single-instance
 * deployment. A multi-instance deployment needs this in shared storage; noted here so
 * it is a known limit rather than a surprise.
 */
type Challenge = { userId: number; expiresAt: number; attempts: number };
const challenges = new Map<string, Challenge>();

/** Long enough to fetch a code from a phone, short enough to be worthless if leaked. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** A wrong code must not be retryable forever — that would reduce 2FA to a 6-digit guess. */
const MAX_CHALLENGE_ATTEMPTS = 5;

function sweep() {
  const now = Date.now();
  for (const [id, c] of challenges) if (c.expiresAt <= now) challenges.delete(id);
}

/** Issue a challenge after the password check succeeds but before any session exists. */
export function createChallenge(userId: number): string {
  sweep();
  const id = crypto.randomBytes(32).toString("base64url");
  challenges.set(id, { userId, expiresAt: Date.now() + CHALLENGE_TTL_MS, attempts: 0 });
  return id;
}

/**
 * Look up a challenge and count the attempt.
 *
 * The attempt is recorded before the code is checked, so a caller cannot burn attempts
 * without them being counted, and the challenge is destroyed once spent.
 */
export function claimChallengeAttempt(
  id: string
): { ok: true; userId: number } | { ok: false; reason: "expired" | "exhausted" } {
  sweep();
  const c = challenges.get(id);
  if (!c || c.expiresAt <= Date.now()) {
    challenges.delete(id);
    return { ok: false, reason: "expired" };
  }
  c.attempts += 1;
  if (c.attempts > MAX_CHALLENGE_ATTEMPTS) {
    challenges.delete(id);
    return { ok: false, reason: "exhausted" };
  }
  return { ok: true, userId: c.userId };
}

/** Consume a challenge once its code has been accepted. */
export function consumeChallenge(id: string): void {
  challenges.delete(id);
}

/** Test seam: drop all outstanding challenges. */
export function __resetChallenges(): void {
  challenges.clear();
}
