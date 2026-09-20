import { describe, it, expect } from "vitest";
import { checkReadiness } from "./_core/health";

/**
 * A health check that cannot fail is not a health check.
 *
 * `/api/health` returned `{ status: 'ok' }` unconditionally — a function whose body was a
 * literal. Every consumer of a health endpoint reads it as "is this working", and it
 * answered "is this process running", which are the same answer right up until they are
 * not. A pod whose database is unreachable reported healthy, kept receiving traffic from
 * the load balancer, and left the uptime monitor green for the length of the outage.
 *
 * These tests are almost entirely about the failing cases, because the passing case is
 * the one that already worked.
 */

const workingDb = {
  select: () => ({ from: () => ({ limit: async () => [{ id: 1 }] }) }),
};

const sharedStore = async () => ({ shared: true, configured: true, driver: "redis" });
const memoryStore = async () => ({ shared: false, configured: false, driver: "memory" });

describe("readiness", () => {
  it("is ready when the database answers and the store is fine", async () => {
    const r = await checkReadiness({ getDb: async () => workingDb, probeStore: memoryStore });
    expect(r.ready).toBe(true);
    expect(r.checks).toEqual({ database: "ok", authState: "ok" });
  });

  it("is NOT ready when the database is unreachable", async () => {
    // The case the old endpoint got wrong, and the only one that matters: traffic must
    // stop arriving at an instance that cannot answer.
    const r = await checkReadiness({
      getDb: async () => {
        throw new Error("ECONNREFUSED");
      },
      probeStore: memoryStore,
    });
    expect(r.ready).toBe(false);
    expect(r.checks.database).toBe("down");
  });

  it("is NOT ready when there is no database at all", async () => {
    const r = await checkReadiness({ getDb: async () => null, probeStore: memoryStore });
    expect(r.ready).toBe(false);
    expect(r.checks.database).toBe("down");
  });

  it("is NOT ready when the query path is broken even though the connection is up", async () => {
    // A ping would pass here. Serving depends on the query path, so that is what gets
    // probed — the connection being alive is not the thing being asked about.
    const r = await checkReadiness({
      getDb: async () => ({
        select: () => ({ from: () => ({ limit: async () => { throw new Error("table missing"); } }) }),
      }),
      probeStore: memoryStore,
    });
    expect(r.ready).toBe(false);
    expect(r.checks.database).toBe("down");
  });

  it("treats a single-instance memory store as healthy, not as a fault", async () => {
    // Memory is a legitimate working configuration. Reporting it as down would make every
    // single-instance deployment permanently unready — a check that cries wolf gets
    // switched off, and then the real failure has nothing watching it.
    const r = await checkReadiness({ getDb: async () => workingDb, probeStore: memoryStore });
    expect(r.checks.authState).toBe("ok");
  });

  it("is NOT ready when a store that was ASKED to be shared is not", async () => {
    // REDIS_URL set and unreachable. Throttling silently degrades to per-instance, which
    // is exactly the thing the operator configured against.
    const r = await checkReadiness({
      getDb: async () => workingDb,
      probeStore: async () => ({ shared: false, configured: true, driver: "redis" }),
    });
    expect(r.ready).toBe(false);
    expect(r.checks.authState).toBe("down");
  });

  it("reports every subsystem, not just the first to fail", async () => {
    // An operator reading this mid-incident wants the whole picture; short-circuiting
    // would hide a second failure behind the first and send them chasing one cause.
    const r = await checkReadiness({
      getDb: async () => null,
      probeStore: async () => ({ shared: false, configured: true, driver: "redis" }),
    });
    expect(r.checks).toEqual({ database: "down", authState: "down" });
  });

  it("fails rather than hanging when a probe never answers", async () => {
    // A readiness check that never returns fails at the load balancer's timeout instead,
    // which is a slower and less legible way to learn the same thing.
    const r = await checkReadiness({
      getDb: () => new Promise(() => {}),
      probeStore: memoryStore,
    });
    expect(r.ready).toBe(false);
    expect(r.checks.database).toBe("down");
  }, 10_000);

  it("leaks nothing beyond subsystem names and their state", async () => {
    // The endpoint is public by necessity. A caller learns that something is down, which
    // they can already tell, and nothing about how to reach it.
    const r = await checkReadiness({
      getDb: async () => {
        throw new Error("Access denied for user 'root'@'10.0.0.5' (using password: YES)");
      },
      probeStore: sharedStore,
    });
    const serialised = JSON.stringify(r);
    expect(serialised).not.toMatch(/root|password|10\.0\.0\.5|denied/i);
    expect(Object.values(r.checks).every(v => v === "ok" || v === "down")).toBe(true);
  });
});
