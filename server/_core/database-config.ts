/**
 * How this app connects to a real database, and what it refuses to do instead.
 *
 * Both of the things here were found the first time anyone pointed the app at an actual
 * MySQL server. Every gate in this repo runs against the demo store — an in-memory array
 * behind a hand-written Drizzle shim — so the production connection path had never been
 * executed by anything, ever.
 *
 * ── 1. Outside demo mode, a missing DATABASE_URL served the demo dataset ──────────────
 *
 * `getDb()` ended with, in effect, "no DATABASE_URL? use MockDrizzle", and that branch did
 * not check DEMO_MODE. So `DEMO_MODE=false` with the URL absent — a missing secret in the
 * orchestrator, a renamed env var, a typo'd key — came up serving 1,000 synthetic accounts
 * as though they were the customer's:
 *
 *     store in use   : MockDrizzle
 *     accounts served: 1000
 *     sample names   : Northwind Logistics | Brightwave Health | Vertex Cloud Systems
 *     readiness says : {"ready":true,"checks":{"database":"ok","authState":"ok"}}
 *
 * Note the last line. The readiness probe runs a trivial SELECT, and MockDrizzle answers
 * it perfectly — so the health check built to catch exactly this class of failure reported
 * the instance healthy while it served fabricated data and wrote to a JSON file that a
 * redeploy discards. One console.warn, which nobody reads, was the entire signal.
 *
 * The fix is to refuse. A deployment that asks for a real database and has not been given
 * one is misconfigured, and the only safe thing it can do is say so and stop.
 *
 * ── 2. TLS was on, and verification was off ──────────────────────────────────────────
 *
 * The pool hardcoded `ssl: { rejectUnauthorized: false }`, unconditionally. That is two
 * problems wearing one line:
 *
 *   - Where the server speaks TLS, the connection is encrypted and UNAUTHENTICATED. Every
 *     row of every customer's CRM crosses it, and nothing checks it is the database
 *     answering. On a managed provider — the case where verification is both easy and most
 *     valuable — it was silently switched off.
 *   - Where the server does NOT speak TLS, mysql2 fails the handshake outright
 *     (HANDSHAKE_NO_SSL_SUPPORT), so a plain self-hosted MySQL or MariaDB could not connect
 *     at all. Confirmed against MariaDB 10.11: every query failed before it ran.
 *
 * So it managed to be insecure where it worked and broken where it didn't. `DATABASE_SSL`
 * now names the three real choices, and the default is the safe one.
 */

export type SslMode = "verify" | "skip-verify" | "disable";

/** What mysql2 should be told about TLS. Defaults to verifying, which is the point. */
export function sslMode(env: NodeJS.ProcessEnv = process.env): SslMode {
  const raw = (env.DATABASE_SSL ?? "").trim().toLowerCase();
  if (["disable", "disabled", "off", "false", "none"].includes(raw)) return "disable";
  if (["skip-verify", "no-verify", "insecure", "unverified"].includes(raw)) return "skip-verify";
  return "verify";
}

/**
 * The `ssl` option for mysql2's pool.
 *
 * `undefined` is not "default TLS" — in mysql2 it means do not attempt TLS at all, which
 * is what a server with no certificate needs.
 */
export function sslOption(env: NodeJS.ProcessEnv = process.env):
  | { rejectUnauthorized: boolean }
  | undefined {
  switch (sslMode(env)) {
    case "disable":
      return undefined;
    case "skip-verify":
      return { rejectUnauthorized: false };
    case "verify":
      return { rejectUnauthorized: true };
  }
}

/** One line for the boot log, so which of the three is live is never a guess. */
export function describeSsl(env: NodeJS.ProcessEnv = process.env): string {
  switch (sslMode(env)) {
    case "disable":
      return "TLS disabled (DATABASE_SSL=disable) — the connection to the database is in the clear";
    case "skip-verify":
      return "TLS without certificate verification (DATABASE_SSL=skip-verify) — encrypted, but the server is not authenticated";
    case "verify":
      return "TLS with certificate verification";
  }
}

export class DatabaseNotConfiguredError extends Error {}

/**
 * Refuse to boot a real deployment that has not been given a real database.
 *
 * Deliberately a hard failure at startup rather than a per-request one. The alternative
 * this replaces was worse than an outage: an instance that came up, looked healthy, and
 * served somebody else's demo data to a paying customer.
 */
export function assertDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): void {
  if (env.DEMO_MODE === "true") return;
  if ((env.DATABASE_URL ?? "").trim()) return;

  throw new DatabaseNotConfiguredError(
    "DEMO_MODE is not 'true' but DATABASE_URL is empty, so there is no database to serve " +
      "from. Refusing to start.\n" +
      "  • For a real deployment: set DATABASE_URL=mysql://user:pass@host:3306/dbname\n" +
      "  • To run the zero-config demo instead: set DEMO_MODE=true\n" +
      "This used to fall back to the bundled demo dataset, which meant a misconfigured " +
      "deployment served 1,000 fabricated accounts and reported itself healthy."
  );
}
