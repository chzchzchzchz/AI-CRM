import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `system.health` is listed in docs/CAPABILITIES.md as an "uptime probe". Its body was
 * `() => ({ ok: true })` — a constant. Anyone monitoring with it, which is precisely
 * what it is documented for, got `ok: true` from an instance whose database was
 * unreachable, for the whole length of the outage.
 *
 * The interesting case is therefore the down one, so the database is swapped for one
 * that fails. A test that only ever saw a working database would have passed against the
 * constant too, which is how the original went unnoticed.
 *
 * `getDb` is a plain swappable function rather than a `vi.fn`: vi.fn tracks the settled
 * result of every call it makes, and tracking an async rejection registers an unhandled
 * rejection that vitest then charges to whichever test is running. That failed these
 * tests with the very error they were feeding in, while the procedure itself returned
 * the correct answer — the harness inventing the failure it was looking for.
 */

let getDb: () => Promise<any> = async () => null;

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getDb: () => getDb() };
});

const { appRouter } = await import("./routers");

function publicCtx(): any {
  return {
    user: null,
    req: { protocol: "https", headers: {} },
    res: { clearCookie: () => {} },
  };
}

const call = () =>
  appRouter.createCaller(publicCtx()).system.health({ timestamp: Date.now() });

describe("system.health", () => {
  beforeEach(() => {
    getDb = async () => null;
  });

  it("reports ok when the database answers", async () => {
    getDb = async () => ({
      select: () => ({ from: () => ({ limit: async () => [{ id: 1 }] }) }),
    });
    const res = await call();
    expect(res.ok).toBe(true);
    expect(res.checks.database).toBe("ok");
  });

  it("reports NOT ok when the database is unreachable", async () => {
    // The case the constant got wrong. This is the entire reason the procedure exists.
    getDb = async () => {
      throw new Error("ECONNREFUSED");
    };
    const res = await call();
    expect(res.ok).toBe(false);
    expect(res.checks.database).toBe("down");
  });

  it("reports NOT ok when there is no database at all", async () => {
    getDb = async () => null;
    const res = await call();
    expect(res.ok).toBe(false);
  });

  it("names the subsystems instead of returning a bare boolean", async () => {
    // An operator who learns only "not ok" has to go find out which half is broken.
    getDb = async () => {
      throw new Error("nope");
    };
    const res = await call();
    expect(Object.keys(res.checks).sort()).toEqual(["authState", "database"]);
  });

  it("leaks nothing about the failure — it is a public procedure", async () => {
    getDb = async () => {
      throw new Error("Access denied for user 'root'@'10.0.0.5' (using password: YES)");
    };
    const res = await call();
    expect(JSON.stringify(res)).not.toMatch(/root|password|10\.0\.0\.5|denied/i);
  });
});
