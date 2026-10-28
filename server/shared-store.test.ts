import { describe, it, expect, beforeEach } from "vitest";
import { getStore, describeStore, __resetMemoryStore } from "./_core/shared-store";

/**
 * The store behind login lockout, the send cooldown, /api rate limiting and 2FA
 * challenges.
 *
 * All four were module-level Maps. That is exactly right for one process and quietly
 * wrong for two: each pod keeps its own counters, so five allowed login attempts becomes
 * five per pod, and a 2FA challenge minted on pod A cannot be redeemed on pod B. Neither
 * failure surfaces anywhere — the app looks like it is throttling and isn't.
 *
 * These pin the contract every driver has to satisfy. They run against the memory
 * driver (no REDIS_URL in CI); the Redis driver implements the same interface with
 * INCR/PEXPIRE/PTTL and a token-checked compare-and-delete lock.
 */

describe("shared store — counters", () => {
  beforeEach(() => __resetMemoryStore());

  it("counts up from one and keeps counting", async () => {
    const s = getStore();
    expect(await s.increment("k", 60_000)).toBe(1);
    expect(await s.increment("k", 60_000)).toBe(2);
    expect(await s.increment("k", 60_000)).toBe(3);
  });

  it("keeps separate keys separate", async () => {
    const s = getStore();
    await s.increment("a", 60_000);
    await s.increment("a", 60_000);
    expect(await s.increment("b", 60_000)).toBe(1);
  });

  it("does not slide the window forward on every increment", async () => {
    // If each increment reset the TTL, a counter under sustained load would never
    // expire — a lockout would last as long as the attack rather than the configured
    // window, and the legitimate account holder would be locked out indefinitely.
    const s = getStore();
    await s.increment("slide", 1_000);
    const first = await s.ttl("slide");
    await new Promise((r) => setTimeout(r, 30));
    await s.increment("slide", 1_000);
    expect(await s.ttl("slide")).toBeLessThan(first);
  });

  it("starts over once the window has passed", async () => {
    const s = getStore();
    await s.increment("short", 20);
    await s.increment("short", 20);
    await new Promise((r) => setTimeout(r, 40));
    expect(await s.increment("short", 20)).toBe(1);
  });

  it("reports no remaining time for a key that was never set", async () => {
    expect(await getStore().ttl("never-existed")).toBe(0);
  });

  it("counts parallel increments once each", async () => {
    // The whole point of the counter: concurrent requests are exactly the case a
    // read-modify-write gets wrong, and exactly how brute force arrives.
    const s = getStore();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => s.increment("parallel", 60_000))
    );
    expect(new Set(results).size).toBe(20);
    expect(Math.max(...results)).toBe(20);
  });
});

describe("shared store — values", () => {
  beforeEach(() => __resetMemoryStore());

  it("round-trips a value", async () => {
    await getStore().set("v", { userId: 7 }, 60_000);
    expect(await getStore().get<{ userId: number }>("v")).toEqual({ userId: 7 });
  });

  it("returns null for a missing key rather than undefined", async () => {
    expect(await getStore().get("absent")).toBeNull();
  });

  it("returns null once the value has expired", async () => {
    await getStore().set("gone", { userId: 1 }, 20);
    await new Promise((r) => setTimeout(r, 40));
    expect(await getStore().get("gone")).toBeNull();
  });

  it("deletes", async () => {
    await getStore().set("d", 1, 60_000);
    await getStore().delete("d");
    expect(await getStore().get("d")).toBeNull();
  });

  it("expire() extends an existing key and ignores an absent one", async () => {
    const s = getStore();
    await s.set("e", 1, 50);
    await s.expire("e", 60_000);
    expect(await s.ttl("e")).toBeGreaterThan(1_000);
    await s.expire("no-such-key", 60_000);
    expect(await s.ttl("no-such-key")).toBe(0);
  });
});

describe("shared store — lock", () => {
  beforeEach(() => __resetMemoryStore());

  it("grants the lock to exactly one holder", async () => {
    const s = getStore();
    const first = await s.acquireLock("lk", 5_000);
    expect(first).not.toBeNull();
    expect(await s.acquireLock("lk", 5_000)).toBeNull();
  });

  it("frees the lock when released", async () => {
    const s = getStore();
    const release = await s.acquireLock("lk2", 5_000);
    await release!();
    expect(await s.acquireLock("lk2", 5_000)).not.toBeNull();
  });

  it("does not let a crashed holder block the key forever", async () => {
    // A process that dies holding the lock never calls release. Without the TTL the
    // key is a permanent denial of service on that user's login.
    const s = getStore();
    await s.acquireLock("lk3", 20);
    expect(await s.acquireLock("lk3", 20)).toBeNull();
    await new Promise((r) => setTimeout(r, 40));
    expect(await s.acquireLock("lk3", 5_000)).not.toBeNull();
  });

  it("locks different keys independently", async () => {
    const s = getStore();
    await s.acquireLock("user:1", 5_000);
    expect(await s.acquireLock("user:2", 5_000)).not.toBeNull();
  });
});

describe("describeStore", () => {
  it("says plainly that state is per-instance when no REDIS_URL is set", () => {
    // The failure this whole module exists to prevent is an operator running two pods
    // and believing throttling is shared. `pnpm doctor` has to say which mode is live,
    // not leave it to be inferred from the absence of a warning.
    const d = describeStore();
    expect(d.driver).toBe("memory");
    expect(d.shared).toBe(false);
    expect(d.detail).toMatch(/per-instance/i);
    expect(d.detail).toMatch(/REDIS_URL/);
  });
});
