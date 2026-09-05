/**
 * Health checks that can actually fail.
 *
 * `/api/health` returned `{ status: 'ok' }` unconditionally — a function whose body is a
 * literal. It answered "is this process running" while every consumer reads it as "is
 * this working", which are the same answer right up until they are not: a pod whose
 * database is unreachable reports healthy, the load balancer keeps sending it traffic,
 * and the uptime monitor stays green through the outage.
 *
 * Two endpoints, because they answer different questions and want different reactions:
 *
 *   liveness  — is the process alive? A failure here means restart me. It must not depend
 *               on anything external, or a database blip restarts every pod at once and
 *               turns a recoverable outage into a thundering herd.
 *
 *   readiness — can this instance actually serve a request? A failure means stop routing
 *               to me, but do not kill me; I may recover. This one does check the
 *               dependencies, because that is the entire point of asking.
 *
 * Deliberately public, so the payload is deliberately thin: the name of each subsystem
 * and whether it answered. No connection strings, no driver errors, no version numbers —
 * an unauthenticated caller learns that something is down, which they can already tell,
 * and nothing about how to reach it.
 */

export type SubsystemState = "ok" | "down";

export type ReadinessReport = {
  ready: boolean;
  checks: Record<string, SubsystemState>;
};

/** Bounds how long a probe can hang. A readiness check that never answers is a readiness
 *  check that fails by timeout at the load balancer, which is a worse way to find out. */
const PROBE_TIMEOUT_MS = 3000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), ms);
    }),
  ]);
}

/**
 * Can this instance serve?
 *
 * Every subsystem is probed even when an earlier one has already failed: an operator
 * reading this during an incident wants the whole picture, and short-circuiting would
 * hide a second failure behind the first.
 */
export async function checkReadiness(deps: {
  getDb: () => Promise<any>;
  probeStore: () => Promise<{ shared: boolean; configured: boolean; driver: string }>;
}): Promise<ReadinessReport> {
  const checks: Record<string, SubsystemState> = {};

  checks.database = await withTimeout(
    (async () => {
      const db = await deps.getDb();
      if (!db) return "down" as const;
      // A trivial read, not a ping: the connection can be up while the app has no
      // working query path, and it is the query path that serving depends on.
      const { organizations } = await import("../../drizzle/schema");
      await db.select().from(organizations).limit(1);
      return "ok" as const;
    })(),
    PROBE_TIMEOUT_MS
  ).catch(() => "down" as const);

  checks.authState = await withTimeout(
    (async () => {
      const store = await deps.probeStore();
      // Memory is a legitimate, working configuration for a single instance — it is not
      // a failure, and reporting it as one would make every single-instance deployment
      // permanently unready. Only a store that was ASKED to be shared and is not counts.
      if (store.configured && !store.shared) return "down" as const;
      return "ok" as const;
    })(),
    PROBE_TIMEOUT_MS
  ).catch(() => "down" as const);

  return {
    ready: Object.values(checks).every(v => v === "ok"),
    checks,
  };
}
