import { describe, it, expect } from "vitest";
import {
  assertDatabaseConfigured,
  describeSsl,
  sslMode,
  sslOption,
} from "./_core/database-config";

/**
 * Both of these were found the first time anyone pointed this app at a real MySQL.
 *
 * Every gate in the repo runs against the demo store — an in-memory array behind a
 * hand-written Drizzle shim — so the production connection path had never been executed
 * by anything. Pointing the eleven-step tenancy walk at MariaDB 10.11 failed all eleven,
 * at the first query, before any of the product logic ran.
 */

describe("refusing to serve the demo dataset as if it were real", () => {
  /**
   * Measured before the fix, with DEMO_MODE=false and DATABASE_URL unset:
   *
   *     store in use   : MockDrizzle
   *     accounts served: 1000
   *     sample names   : Northwind Logistics | Brightwave Health | Vertex Cloud Systems
   *     readiness says : {"ready":true,"checks":{"database":"ok","authState":"ok"}}
   *
   * A missing secret in the orchestrator, a renamed variable, a typo'd key — any of those
   * and the deployment came up serving fabricated companies, writing to a JSON file a
   * redeploy discards, and reporting itself healthy. The readiness probe runs a trivial
   * SELECT and MockDrizzle answers it perfectly, so the check written to catch exactly
   * this called the instance fine.
   */
  it("refuses to start outside demo mode with no database", () => {
    expect(() => assertDatabaseConfigured({ DEMO_MODE: "false" } as any)).toThrow(
      /DATABASE_URL is empty/
    );
  });

  it("refuses when DEMO_MODE is not set at all", () => {
    // Neither "yes this is demo" nor "here is a database" is an answer to which one it is.
    expect(() => assertDatabaseConfigured({} as any)).toThrow();
  });

  it("names both ways out, because the person reading it has done nothing wrong", () => {
    let message = "";
    try {
      assertDatabaseConfigured({ DEMO_MODE: "false" } as any);
    } catch (e: any) {
      message = e.message;
    }
    expect(message).toMatch(/DATABASE_URL=mysql:/);
    expect(message).toMatch(/DEMO_MODE=true/);
  });

  it("lets the two correctly-configured cases through", () => {
    // The documented quickstart is `cp .env.example .env` (DEMO_MODE=true) and the
    // Dockerfile sets ENV DEMO_MODE=true, so no documented path hits the refusal.
    expect(() => assertDatabaseConfigured({ DEMO_MODE: "true" } as any)).not.toThrow();
    expect(() =>
      assertDatabaseConfigured({
        DEMO_MODE: "false",
        DATABASE_URL: "mysql://u:p@h:3306/d",
      } as any)
    ).not.toThrow();
  });

  it("does not accept whitespace as a database URL", () => {
    expect(() =>
      assertDatabaseConfigured({ DEMO_MODE: "false", DATABASE_URL: "   " } as any)
    ).toThrow();
  });
});

describe("TLS to the database", () => {
  /**
   * The pool hardcoded `ssl: { rejectUnauthorized: false }`, which managed to be insecure
   * where it worked and broken where it didn't:
   *
   *   - against a server that speaks TLS, the connection carrying every row of every
   *     customer's CRM was encrypted and UNAUTHENTICATED;
   *   - against one that does not, mysql2 fails the handshake outright
   *     (HANDSHAKE_NO_SSL_SUPPORT) — confirmed against MariaDB 10.11, where every query
   *     failed before it ran.
   */
  it("verifies the certificate by default", () => {
    expect(sslMode({} as any)).toBe("verify");
    expect(sslOption({} as any)).toEqual({ rejectUnauthorized: true });
  });

  it("treats an unrecognised value as the safe one", () => {
    // A typo must not silently downgrade the connection.
    expect(sslMode({ DATABASE_SSL: "yes-please" } as any)).toBe("verify");
    expect(sslMode({ DATABASE_SSL: "" } as any)).toBe("verify");
  });

  it("can turn TLS off entirely, which is what a plain self-hosted server needs", () => {
    // `undefined` is not "default TLS" to mysql2 — it means do not attempt it, which is
    // the only thing that connects to a server with no certificate.
    expect(sslOption({ DATABASE_SSL: "disable" } as any)).toBeUndefined();
    for (const v of ["disable", "disabled", "off", "false", "none"]) {
      expect(sslMode({ DATABASE_SSL: v } as any), v).toBe("disable");
    }
  });

  it("can skip verification, but only when asked in those words", () => {
    // This is the old hardcoded behaviour. It remains available for a self-signed
    // certificate; it is no longer what you get without choosing it.
    expect(sslOption({ DATABASE_SSL: "skip-verify" } as any)).toEqual({
      rejectUnauthorized: false,
    });
    for (const v of ["skip-verify", "no-verify", "insecure", "unverified"]) {
      expect(sslMode({ DATABASE_SSL: v } as any), v).toBe("skip-verify");
    }
  });

  it("says which of the three is live, in words an operator can act on", () => {
    // Printed at boot. Which mode is in force should never be something you infer.
    expect(describeSsl({} as any)).toMatch(/verification/i);
    expect(describeSsl({ DATABASE_SSL: "disable" } as any)).toMatch(/in the clear/i);
    expect(describeSsl({ DATABASE_SSL: "skip-verify" } as any)).toMatch(/not authenticated/i);
  });

  it("is case- and whitespace-insensitive, because env files are typed by hand", () => {
    expect(sslMode({ DATABASE_SSL: "  DISABLE  " } as any)).toBe("disable");
    expect(sslMode({ DATABASE_SSL: "Skip-Verify" } as any)).toBe("skip-verify");
  });
});
