import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The org boundary, exercised against the real data layer rather than asserted about.
 *
 * A query can be given an org filter, compile, pass every unit test that only checks it
 * returns something — and still hand back another tenant's rows, because nothing about
 * the shape of the call says which rows come back. The only way to know is to put two
 * orgs' data in front of it and ask each one separately.
 *
 * `getAccountById` is the one that matters most: an account id is a small integer a
 * caller can simply guess. Before the org half of that filter existed, "give me account
 * 42" reached whichever tenant happened to own 42.
 */

const DB_PATH = path.join(process.cwd(), "org-isolation-test-db.json");

beforeAll(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      {
        accounts: [
          { id: 1, orgId: 1, name: "Org One Corp", createdAt: new Date().toISOString() },
          { id: 2, orgId: 2, name: "Org Two Corp", createdAt: new Date().toISOString() },
          // No orgId at all: a row written before the column existed. It must land in the
          // default org, the same as MySQL's `DEFAULT 1` does — not vanish from every
          // query, which would read as an empty workspace rather than a migration bug.
          { id: 3, name: "Legacy No Org", createdAt: new Date().toISOString() },
        ],
        contacts: [
          { id: 10, orgId: 1, accountId: 1, name: "Alice One" },
          { id: 11, orgId: 2, accountId: 2, name: "Bob Two" },
        ],
        opportunities: [
          { id: 20, orgId: 1, accountId: 1, name: "Deal One" },
          { id: 21, orgId: 2, accountId: 2, name: "Deal Two" },
        ],
        calls: [
          { id: 30, orgId: 1, accountId: 1, title: "Call One", callDate: new Date().toISOString() },
          { id: 31, orgId: 2, accountId: 2, title: "Call Two", callDate: new Date().toISOString() },
        ],
        users: [],
      },
      null,
      2
    )
  );
});

afterAll(() => {
  fs.rmSync(DB_PATH, { force: true });
});

describe("org isolation, against the real data layer", () => {
  it("lists only the asking org's accounts", async () => {
    const db = await import("./db");
    expect((await db.getAllAccounts(1)).map((a: any) => a.name).sort()).toEqual([
      "Legacy No Org",
      "Org One Corp",
    ]);
    expect((await db.getAllAccounts(2)).map((a: any) => a.name)).toEqual(["Org Two Corp"]);
  });

  it("refuses another org's account even when the id is correct", async () => {
    // The failure this prevents: customer B enumerates ids 1..n and reads customer A's
    // book. Nothing about the request looks wrong — the id is real and the caller is
    // authenticated. Only the org half of the filter stops it.
    const db = await import("./db");
    expect((await db.getAccountById(1, 1))?.name).toBe("Org One Corp");
    expect(await db.getAccountById(2, 1)).toBeUndefined();
    expect(await db.getAccountById(1, 2)).toBeUndefined();
  });

  it("scopes contacts, calls and opportunities the same way", async () => {
    const db = await import("./db");
    expect((await db.getAllPeople(1)).map((c: any) => c.name)).toEqual(["Alice One"]);
    expect((await db.getAllPeople(2)).map((c: any) => c.name)).toEqual(["Bob Two"]);
    expect((await db.getAllOpportunities(1)).map((o: any) => o.name)).toEqual(["Deal One"]);
    expect((await db.getAllOpportunities(2)).map((o: any) => o.name)).toEqual(["Deal Two"]);
    expect((await db.getAllGongCalls(1)).map((c: any) => c.title)).toEqual(["Call One"]);
    expect((await db.getAllGongCalls(2)).map((c: any) => c.title)).toEqual(["Call Two"]);
  });

  it("counts only the asking org", async () => {
    // A count is the quietest leak of all: it discloses how much data the other tenant
    // holds, and it drives a pager that then promises pages which come back empty.
    const db = await import("./db");
    expect((await db.getSyncStatus(1)).accounts).toBe(2); // includes the legacy row
    expect((await db.getSyncStatus(2)).accounts).toBe(1);
    expect((await db.getSyncStatus(1)).contacts).toBe(1);
    expect((await db.getSyncStatus(2)).contacts).toBe(1);
  });

  it("gives a row with no orgId to the default org, rather than to nobody", async () => {
    const db = await import("./db");
    expect((await db.getAccountById(1, 3))?.name).toBe("Legacy No Org");
    expect(await db.getAccountById(2, 3)).toBeUndefined();
  });
});
