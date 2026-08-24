import { describe, it, expect, beforeEach } from "vitest";
// @ts-ignore - speakeasy ships no type definitions
import speakeasy from "speakeasy";
import {
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  redeemBackupCode,
  countBackupCodes,
  normalizeBackupCode,
  createChallenge,
  claimChallengeAttempt,
  consumeChallenge,
  __resetChallenges,
  BACKUP_CODE_COUNT,
  withUserLock,
} from "./twofa";

const sp = speakeasy as any;
// Called through the module object: speakeasy's helpers use `this` internally.
const totp = (opts: any) => sp.totp(opts);

describe("verifyTotp", () => {
  const secret = sp.generateSecret({ length: 32 }).base32;

  it("accepts the current code", () => {
    expect(verifyTotp(secret, totp({ secret, encoding: "base32" }))).toBe(true);
  });

  it("tolerates a code typed with spaces", () => {
    const code = totp({ secret, encoding: "base32" });
    expect(verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`)).toBe(true);
  });

  it("rejects a wrong code, an empty code and a missing secret", () => {
    expect(verifyTotp(secret, "000000")).toBe(false);
    expect(verifyTotp(secret, "")).toBe(false);
    expect(verifyTotp("", totp({ secret, encoding: "base32" }))).toBe(false);
  });

  it("rejects a code from well outside the drift window", () => {
    // Six steps out — three minutes. Inside the window this would be a real code.
    const stale = totp({ secret, encoding: "base32", time: Date.now() / 1000 - 180 });
    expect(verifyTotp(secret, stale)).toBe(false);
  });
});

describe("backup codes", () => {
  it("issues the advertised number of distinct codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(BACKUP_CODE_COUNT);
    expect(new Set(codes).size).toBe(BACKUP_CODE_COUNT);
  });

  it("does not repeat across separate enrolments", () => {
    // Math.random() seeded identically across workers would collide here.
    const a = generateBackupCodes();
    const b = generateBackupCodes();
    expect(a.some((c) => b.includes(c))).toBe(false);
  });

  it("stores hashes, never the codes themselves", async () => {
    const codes = generateBackupCodes();
    const stored = await hashBackupCodes(codes);
    for (const c of codes) {
      expect(stored).not.toContain(c);
      expect(stored).not.toContain(normalizeBackupCode(c));
    }
    expect(countBackupCodes(stored)).toBe(BACKUP_CODE_COUNT);
  }, 30_000);

  it("redeems a valid code and will not redeem it twice", async () => {
    const codes = generateBackupCodes();
    let stored: string | null = await hashBackupCodes(codes);

    const first = await redeemBackupCode(stored, codes[3]);
    expect(first.ok).toBe(true);
    stored = first.remaining;
    expect(countBackupCodes(stored)).toBe(BACKUP_CODE_COUNT - 1);

    // A recovery code that still works after use is a permanent bypass of the
    // second factor, which is the failure this whole file exists to prevent.
    const again = await redeemBackupCode(stored, codes[3]);
    expect(again.ok).toBe(false);
  }, 30_000);

  it("accepts a code however the user typed it", async () => {
    const codes = generateBackupCodes();
    const stored = await hashBackupCodes(codes);
    const messy = codes[0].toLowerCase().replace("-", " ");
    expect((await redeemBackupCode(stored, messy)).ok).toBe(true);
  }, 30_000);

  it("rejects a code that was never issued, and survives junk input", async () => {
    const stored = await hashBackupCodes(generateBackupCodes());
    expect((await redeemBackupCode(stored, "AAAAA-BBBBB")).ok).toBe(false);
    expect((await redeemBackupCode(stored, "")).ok).toBe(false);
    expect((await redeemBackupCode(null, "AAAAA-BBBBB")).ok).toBe(false);
    expect((await redeemBackupCode("not json", "AAAAA-BBBBB")).ok).toBe(false);
    expect((await redeemBackupCode('{"not":"an array"}', "AAAAA")).ok).toBe(false);
  }, 30_000);
});

describe("login challenge", () => {
  beforeEach(() => __resetChallenges());

  it("resolves to the user who passed the password step", () => {
    const id = createChallenge(42);
    const claim = claimChallengeAttempt(id);
    expect(claim).toEqual({ ok: true, userId: 42 });
  });

  it("issues unguessable, distinct ids", () => {
    const ids = new Set(Array.from({ length: 50 }, (_, i) => createChallenge(i)));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.length).toBeGreaterThanOrEqual(40);
  });

  it("rejects an unknown or already-consumed challenge", () => {
    expect(claimChallengeAttempt("nope")).toEqual({ ok: false, reason: "expired" });
    const id = createChallenge(1);
    consumeChallenge(id);
    expect(claimChallengeAttempt(id)).toEqual({ ok: false, reason: "expired" });
  });

  it("stops accepting attempts once they are exhausted", () => {
    // Without this a challenge is a 6-digit code with unlimited guesses, which is
    // not a second factor at all.
    const id = createChallenge(7);
    for (let i = 0; i < 5; i++) expect(claimChallengeAttempt(id).ok).toBe(true);
    expect(claimChallengeAttempt(id)).toEqual({ ok: false, reason: "exhausted" });
    // …and it is gone, not merely refused.
    expect(claimChallengeAttempt(id)).toEqual({ ok: false, reason: "expired" });
  });

  it("keeps challenges separate", () => {
    const a = createChallenge(1);
    const b = createChallenge(2);
    expect(claimChallengeAttempt(a)).toEqual({ ok: true, userId: 1 });
    expect(claimChallengeAttempt(b)).toEqual({ ok: true, userId: 2 });
  });
});

/**
 * redeemBackupCode is a pure read-modify-write helper: the caller reads the stored
 * hashes, calls this, and writes back what's left. With no lock, two callers who both
 * read before either wrote could each remove a different code from the SAME starting
 * snapshot, and whichever write landed last would silently restore the other "used"
 * code. withUserLock closes that by queuing every call for a given userId behind the
 * one before it, so a later call's work always starts after the earlier one's finished
 * — see server/twofa-login.test.ts for the end-to-end version of this exact scenario.
 */
describe("withUserLock", () => {
  it("runs calls for the same key one at a time, in order", async () => {
    const order: number[] = [];
    const started: number[] = [];

    // Deliberately have call 1 take longer than call 2, so completion order would
    // differ from start order if they were allowed to run concurrently.
    const p1 = withUserLock(1, async () => {
      started.push(1);
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    const p2 = withUserLock(1, async () => {
      started.push(2);
      order.push(2);
    });

    await Promise.all([p1, p2]);
    // Call 2 must not have even STARTED until call 1 fully finished.
    expect(started).toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it("does not block calls for a different key", async () => {
    const order: string[] = [];

    const slow = withUserLock(10, async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push("slow-10");
    });
    const fast = withUserLock(20, async () => {
      order.push("fast-20");
    });

    await Promise.all([slow, fast]);
    // The unrelated user's fast call finishes first — it was never queued behind 10's.
    expect(order).toEqual(["fast-20", "slow-10"]);
  });

  it("propagates a failure to its own caller without jamming the queue for the next one", async () => {
    await expect(
      withUserLock(30, async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    // A later call for the same user must still actually run.
    const result = await withUserLock(30, async () => "still works");
    expect(result).toBe("still works");
  });

  it("returns each call's own result, not another call's", async () => {
    const [a, b] = await Promise.all([
      withUserLock(40, async () => "a"),
      withUserLock(40, async () => "b"),
    ]);
    expect(a).toBe("a");
    expect(b).toBe("b");
  });
});
