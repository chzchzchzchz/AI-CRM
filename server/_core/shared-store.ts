/**
 * Shared state for auth throttling, so it survives more than one instance.
 *
 * Rate limiting, login lockout, the send cooldown and 2FA challenges were module-level
 * Maps. That is correct for exactly one process and silently wrong for two: each pod
 * keeps its own counters, so an attacker gets N pods × 5 login attempts, and a 2FA
 * challenge minted on pod A cannot be redeemed on pod B. Neither failure is visible
 * from inside the app — it just quietly throttles less than it claims to.
 *
 * Driver is chosen once, at import, from REDIS_URL:
 *   unset  → memory. Same behaviour this app has always had. Correct for a single
 *            instance, which is how the demo and most self-hosted installs run.
 *   set    → redis. State is shared, so throttling holds across every instance.
 *
 * `describeStore()` reports which one is live. Nothing here silently upgrades itself:
 * a deployment running two pods with no REDIS_URL is still per-instance, and `pnpm
 * doctor` says so rather than letting the operator assume otherwise.
 */

import Redis from "ioredis";

export type StoreDriver = "memory" | "redis";

export interface SharedStore {
  readonly driver: StoreDriver;
  /** Increment a counter, setting the TTL when it is first created. Returns the new count. */
  increment(key: string, ttlMs: number): Promise<number>;
  /** Milliseconds until `key` expires; 0 when absent or already expired. */
  ttl(key: string): Promise<number>;
  /** Reset an existing key's TTL. No-op when the key is absent. */
  expire(key: string, ttlMs: number): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /**
   * Take an exclusive lock, or return null if someone else holds it. The returned
   * function releases it. `ttlMs` bounds how long a crashed holder can block others.
   */
  acquireLock(key: string, ttlMs: number): Promise<null | (() => Promise<void>)>;
}

// ---------------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------------

type Entry = { value: unknown; expiresAt: number };

class MemoryStore implements SharedStore {
  readonly driver = "memory" as const;
  private readonly entries = new Map<string, Entry>();

  /** Bounded sweep so a long-lived process can't accumulate expired keys forever. */
  private sweep() {
    if (this.entries.size < 5000) return;
    const now = Date.now();
    for (const [k, e] of this.entries) if (e.expiresAt <= now) this.entries.delete(k);
  }

  private live(key: string): Entry | null {
    const e = this.entries.get(key);
    if (!e) return null;
    if (e.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return e;
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    this.sweep();
    const existing = this.live(key);
    if (!existing) {
      this.entries.set(key, { value: 1, expiresAt: Date.now() + ttlMs });
      return 1;
    }
    const next = (existing.value as number) + 1;
    existing.value = next;
    return next;
  }

  async ttl(key: string): Promise<number> {
    const e = this.live(key);
    return e ? Math.max(0, e.expiresAt - Date.now()) : 0;
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    const e = this.live(key);
    if (e) e.expiresAt = Date.now() + ttlMs;
  }

  async get<T>(key: string): Promise<T | null> {
    const e = this.live(key);
    return e ? (e.value as T) : null;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.sweep();
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async acquireLock(key: string, ttlMs: number): Promise<null | (() => Promise<void>)> {
    if (this.live(key)) return null;
    this.entries.set(key, { value: 1, expiresAt: Date.now() + ttlMs });
    return async () => {
      this.entries.delete(key);
    };
  }

  /** Test seam — drops everything. Never called by application code. */
  __reset() {
    this.entries.clear();
  }
}

// ---------------------------------------------------------------------------------
// redis
// ---------------------------------------------------------------------------------

class RedisStore implements SharedStore {
  readonly driver = "redis" as const;
  constructor(private readonly client: any) {}

  async increment(key: string, ttlMs: number): Promise<number> {
    const count = await this.client.incr(key);
    // Only the request that created the key sets the TTL, or every increment would
    // slide the window forward and the counter would never expire under load.
    if (count === 1) await this.client.pexpire(key, ttlMs);
    return count;
  }

  async ttl(key: string): Promise<number> {
    const ms = await this.client.pttl(key);
    // -1 = no expiry, -2 = no key. Neither is a duration.
    return ms > 0 ? ms : 0;
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    await this.client.pexpire(key, ttlMs);
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "PX", ttlMs);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  async acquireLock(key: string, ttlMs: number): Promise<null | (() => Promise<void>)> {
    // A unique token per acquisition: without it, a holder whose lock had already
    // expired could delete a lock a different instance has since taken.
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ok = await this.client.set(key, token, "PX", ttlMs, "NX");
    if (ok !== "OK") return null;
    return async () => {
      // Compare-and-delete, atomically, for the reason above.
      await this.client.eval(
        `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
        1,
        key,
        token,
      );
    };
  }
}

// ---------------------------------------------------------------------------------
// selection
// ---------------------------------------------------------------------------------

const memoryStore = new MemoryStore();
let store: SharedStore = memoryStore;
let redisError: string | null = null;

const REDIS_URL = process.env.REDIS_URL || "";

if (REDIS_URL) {
  try {
    // Imported statically (this is ESM; `require` is not defined) but only *instantiated*
    // here — importing ioredis opens no sockets, so installs that never set REDIS_URL pay
    // nothing but the module load. A broken client degrades to memory with a loud log
    // rather than refusing to boot.
    const client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    });
    client.on("error", (err: Error) => {
      // ioredis reconnects on its own; log rather than crash the process on a blip.
      console.error("[shared-store] redis error:", err.message);
    });
    store = new RedisStore(client);
  } catch (err) {
    redisError = err instanceof Error ? err.message : String(err);
    console.error(
      `[shared-store] REDIS_URL is set but the redis client could not be created (${redisError}). ` +
        `Falling back to per-instance memory — auth throttling will NOT be shared across instances.`,
    );
  }
}

export function getStore(): SharedStore {
  return store;
}

export type StoreStatus = {
  driver: StoreDriver;
  /** True only when state actually crosses instances. */
  shared: boolean;
  /** True when the operator asked for shared state, whether or not they got it. */
  configured: boolean;
  detail: string;
};

/**
 * The mode, from configuration alone — no round trip, so it is cheap enough to log.
 *
 * On the redis driver this reports what was asked for, not what works: `new Redis(url)`
 * succeeds against a host that is down, because ioredis connects lazily. Use
 * `probeStore()` where the answer has to be true rather than intended.
 */
export function describeStore(): StoreStatus {
  if (store.driver === "redis") {
    return {
      driver: "redis",
      shared: true,
      configured: true,
      detail: "Configured to share state via REDIS_URL — not yet verified reachable.",
    };
  }
  if (REDIS_URL) {
    // The dangerous case: the operator believes state is shared and it is not.
    return {
      driver: "memory",
      shared: false,
      configured: true,
      detail: `REDIS_URL is set but the client could not be created (${redisError ?? "unknown error"}) — throttling is per-instance despite being configured for more.`,
    };
  }
  return {
    driver: "memory",
    shared: false,
    configured: false,
    detail:
      "Per-instance. Correct for a single instance; set REDIS_URL before running more than one, or each instance throttles on its own counters.",
  };
}

/**
 * Actually exercise the store, so "state is shared" is a measured fact.
 *
 * A well-formed REDIS_URL pointing at a host that is down constructs a client without
 * complaint — ioredis connects lazily, so nothing fails until the first real operation,
 * which on this path is a login. Reporting "shared" on the strength of the URL alone
 * would be a claim the app never checked, which is the exact failure this codebase
 * spends its effort eliminating everywhere else. So: write, read it back, clean up.
 */
export async function probeStore(timeoutMs = 2000): Promise<StoreStatus> {
  const base = describeStore();
  if (base.driver !== "redis") return base;

  const key = `probe:${process.pid}:${Date.now()}`;
  const expected = Math.random().toString(36).slice(2);
  try {
    await withTimeout(
      (async () => {
        await store.set(key, expected, 10_000);
        const got = await store.get<string>(key);
        await store.delete(key);
        if (got !== expected) throw new Error("value read back did not match what was written");
      })(),
      timeoutMs,
    );
    return {
      ...base,
      shared: true,
      detail:
        "Shared via REDIS_URL, verified by a round trip — login lockout, rate limiting and 2FA challenges hold across instances.",
    };
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    return {
      driver: "redis",
      shared: false,
      configured: true,
      // Not a downgrade to memory: the store still routes to Redis, so this is an
      // outage, not a quieter mode. Login throttling reads will fail until it is back.
      detail: `REDIS_URL is set but the server did not answer (${why}). Auth state is unavailable, not merely per-instance.`,
    };
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no response within ${ms}ms`)), ms);
    }),
  ]);
}

/** Test seam — only meaningful for the memory driver. */
export function __resetMemoryStore() {
  memoryStore.__reset();
}
