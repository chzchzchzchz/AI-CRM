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
import { getStore, __resetMemoryStore } from "./_core/shared-store";
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
 * Serializes async work per userId, across every instance when one is configured.
 *
 * redeemBackupCode is a pure function over a snapshot: read the stored hashes, find a
 * match, return what's left for the caller to write back. Redeeming is a read → compute
 * → write sequence with no compare-and-swap, so two concurrent redemptions for the same
 * account — someone who has obtained two different valid backup codes and fires both at
 * once — can both read the same starting set, each remove only their own code from that
 * shared snapshot, and whichever write lands last wins: the other "used" code is never
 * actually removed from storage and stays redeemable. Queuing every login-time
 * redemption for a user behind the previous one closes that: the second request's read
 * always sees the first one's write.
 *
 * Two layers, because they solve different halves of the same problem:
 *
 *   - The in-process chain handles same-process concurrency with no round trip, and is
 *     the only thing that runs on the memory driver (where one process *is* the whole
 *     deployment, so a lock in that same process's memory would be pure overhead).
 *   - The distributed lock handles the other pods. Without it, two instances each
 *     serialize their own callers perfectly and still interleave with each other — the
 *     original race, unchanged, just harder to reproduce.
 */
const userLocks = new Map<number, Promise<unknown>>();

/** Bounds how long a crashed or wedged holder can block everyone else. */
const USER_LOCK_TTL_MS = 15_000;
/** How long a caller waits for the lock before giving up rather than racing. */
const USER_LOCK_WAIT_MS = 5_000;
const USER_LOCK_POLL_MS = 25;

async function underDistributedLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + USER_LOCK_WAIT_MS;
  for (;;) {
    const release = await getStore().acquireLock(`userlock:${userId}`, USER_LOCK_TTL_MS);
    if (release) {
      try {
        return await fn();
      } finally {
        await release();
      }
    }
    if (Date.now() >= deadline) {
      // Failing closed is the safe direction here: the caller retries a login step,
      // rather than us running the read-modify-write this lock exists to prevent.
      throw new Error("Another request for this account is still in flight. Please try again.");
    }
    await new Promise((r) => setTimeout(r, USER_LOCK_POLL_MS));
  }
}

export function withUserLock<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  // The stored tail is always the caught/never-rejecting form (see below), so it is
  // safe to chain onto with a plain .then — there is no rejection branch to handle.
  const prior = userLocks.get(userId) ?? Promise.resolve();
  const run = prior.then(() =>
    getStore().driver === "memory" ? fn() : underDistributedLock(userId, fn)
  );
  // Never leave a rejected promise as the queue's tail, or every later call for this
  // user would immediately re-reject without ever running `fn`. Drop the entry once it
  // is both settled and still the tail, so the map doesn't grow one key per user seen.
  const tail: Promise<unknown> = run.catch(() => undefined).then(() => {
    if (userLocks.get(userId) === tail) userLocks.delete(userId);
  });
  userLocks.set(userId, tail);
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
 * Kept in the shared store, like the brute-force lockout counters. On the memory driver
 * that is the same per-process Map it always was: a restart invalidates outstanding
 * challenges and the user re-enters their password, which is the safe direction to fail.
 * With REDIS_URL set it is shared, so a challenge minted by the pod that handled the
 * password step can be redeemed by whichever pod happens to receive the code — which
 * behind a load balancer is usually a different one.
 */
const CHALLENGE_KEY = (id: string) => `2fa:challenge:${id}`;
const CHALLENGE_ATTEMPT_KEY = (id: string) => `2fa:challenge-attempts:${id}`;

/** Long enough to fetch a code from a phone, short enough to be worthless if leaked. */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/** A wrong code must not be retryable forever — that would reduce 2FA to a 6-digit guess. */
const MAX_CHALLENGE_ATTEMPTS = 5;

/** Issue a challenge after the password check succeeds but before any session exists. */
export async function createChallenge(userId: number): Promise<string> {
  const id = crypto.randomBytes(32).toString("base64url");
  await getStore().set(CHALLENGE_KEY(id), { userId }, CHALLENGE_TTL_MS);
  return id;
}

/**
 * Look up a challenge and count the attempt.
 *
 * The attempt is recorded before the code is checked, so a caller cannot burn attempts
 * without them being counted, and the challenge is destroyed once spent. The count is an
 * atomic increment rather than a read-modify-write: guesses fired in parallel — the only
 * way a 6-digit space is worth attacking inside a 5-minute window — must not each read
 * the same low count and all slip past the cap.
 */
export async function claimChallengeAttempt(
  id: string
): Promise<{ ok: true; userId: number } | { ok: false; reason: "expired" | "exhausted" }> {
  const store = getStore();
  const c = await store.get<{ userId: number }>(CHALLENGE_KEY(id));
  if (!c) return { ok: false, reason: "expired" };

  const attempts = await store.increment(CHALLENGE_ATTEMPT_KEY(id), CHALLENGE_TTL_MS);
  if (attempts > MAX_CHALLENGE_ATTEMPTS) {
    await consumeChallenge(id);
    return { ok: false, reason: "exhausted" };
  }
  return { ok: true, userId: c.userId };
}

/** Consume a challenge once its code has been accepted. */
export async function consumeChallenge(id: string): Promise<void> {
  await Promise.all([
    getStore().delete(CHALLENGE_KEY(id)),
    getStore().delete(CHALLENGE_ATTEMPT_KEY(id)),
  ]);
}

/**
 * Test seam: drop all outstanding challenges.
 *
 * Clears the whole memory store, since the interface is deliberately key-addressed with
 * no enumeration. Only meaningful under the memory driver, i.e. in tests.
 */
export function __resetChallenges(): void {
  __resetMemoryStore();
}
