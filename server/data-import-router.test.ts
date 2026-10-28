import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * The import, against the real data layer, with two organizations in the store.
 *
 * The mapper is tested on its own in data-import.test.ts; these are the things only a
 * round trip can answer. An import is the easiest place in an app to lose the tenant
 * boundary: the natural key for an account is its domain, and two customers can
 * legitimately both track acme.com — so a lookup on domain alone finds the OTHER
 * tenant's row and the "update" overwrites their data with this import's.
 */

const DB_PATH = path.join(process.cwd(), "data-import-test-db.json");

function seed() {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      {
        organizations: [{ id: 1, name: "Org One" }, { id: 2, name: "Org Two" }],
        users: [],
        accounts: [],
        contacts: [],
      },
      null,
      2
    )
  );
}

const store = () => JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

beforeEach(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  seed();
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(DB_PATH, { force: true });
  vi.resetModules();
});

async function importAs(orgId: number, rawData: string) {
  const { dataImportRouter } = await import("./data-import-router");
  // The org goes on the USER, not on the context. `requireUser` recomputes ctx.orgId
  // from ctx.user and discards whatever the caller supplied — an org id passed in is a
  // parameter, not a boundary. Setting it directly here made every import run as org 1
  // and these tenant tests fail against correct code, which is the middleware doing
  // exactly what it is for.
  const ctx = {
    orgId: null,
    user: { id: orgId * 10, orgId, role: "user" },
    req: { headers: {} },
    res: {},
  };
  return dataImportRouter.createCaller(ctx as any).importRows({ rawData });
}

const LEAD_LIST =
  "first name,last name,email,job title,company,website\n" +
  "Jordan,Okonkwo,jordan@acme.com,VP Engineering,Acme Corp,https://www.acme.com/\n" +
  "Priya,Raman,priya@acme.com,Head of Security,Acme Corp,acme.com";

describe("importing a lead list", () => {
  it("creates the company once and both people, attached to it", async () => {
    const res = await importAs(1, LEAD_LIST);

    expect(res.accounts).toEqual({ imported: 1, updated: 0 });
    expect(res.contacts).toEqual({ imported: 2, updated: 0 });
    expect(res.skipped).toBe(0);
    expect(res.success).toBe(true);

    const { accounts, contacts } = store();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ orgId: 1, domain: "acme.com", name: "Acme Corp" });

    // Attached, not merely co-existing: a contact with a null accountId shows up on the
    // contacts page with no company against it, which is what a rep notices first.
    expect(contacts).toHaveLength(2);
    for (const c of contacts) expect(c.accountId).toBe(accounts[0].id);
  });

  it("is idempotent — the same list twice updates rather than duplicating", async () => {
    await importAs(1, LEAD_LIST);
    const second = await importAs(1, LEAD_LIST);

    expect(second.accounts).toEqual({ imported: 0, updated: 1 });
    expect(second.contacts).toEqual({ imported: 0, updated: 2 });
    expect(store().accounts).toHaveLength(1);
    expect(store().contacts).toHaveLength(2);
  });

  it("does not blank out fields a later, narrower import left out", async () => {
    await importAs(1, LEAD_LIST);
    // A list of phone numbers and nothing else. Setting every column from it would erase
    // the titles the first import supplied.
    await importAs(1, "email,mobile\njordan@acme.com,+1 555 0100");

    const jordan = store().contacts.find((c: any) => c.email === "jordan@acme.com");
    expect(jordan.mobilePhone).toBe("+1 555 0100");
    expect(jordan.title).toBe("VP Engineering");
  });

  it("attaches a person to a company imported earlier, in a separate paste", async () => {
    await importAs(1, "company,website\nAcme Corp,acme.com");
    await importAs(1, "email,website\njordan@acme.com,acme.com");

    const { accounts, contacts } = store();
    expect(accounts).toHaveLength(1);
    expect(contacts[0].accountId).toBe(accounts[0].id);
  });
});

describe("the tenant boundary", () => {
  it("gives two organizations importing the same company their own row", async () => {
    // The failure this is here for: domain is the natural key, so a lookup without orgId
    // finds org 1's Acme and org 2's import overwrites it.
    await importAs(1, "company,website\nAcme Corp,acme.com");
    await importAs(2, "company,website\nAcme Holdings,acme.com");

    const accounts = store().accounts;
    expect(accounts).toHaveLength(2);
    expect(accounts.find((a: any) => a.orgId === 1).name).toBe("Acme Corp");
    expect(accounts.find((a: any) => a.orgId === 2).name).toBe("Acme Holdings");
  });

  it("does not attach one org's contact to another org's account", async () => {
    await importAs(1, "company,website\nAcme Corp,acme.com");
    await importAs(2, "email,website\nspy@acme.com,acme.com");

    const { accounts, contacts } = store();
    const orgOneAccount = accounts.find((a: any) => a.orgId === 1);
    const spy = contacts.find((c: any) => c.email === "spy@acme.com");
    expect(spy.orgId).toBe(2);
    expect(spy.accountId).not.toBe(orgOneAccount.id);
  });

  it("lets two organizations hold the same person without colliding", async () => {
    // One address, two customers who both talk to them. Email is the contact key, so
    // without the org half org 2's import would update org 1's row.
    await importAs(1, "email,job title\njordan@acme.com,VP Engineering");
    await importAs(2, "email,job title\njordan@acme.com,Advisor");

    const contacts = store().contacts;
    expect(contacts).toHaveLength(2);
    expect(contacts.find((c: any) => c.orgId === 1).title).toBe("VP Engineering");
    expect(contacts.find((c: any) => c.orgId === 2).title).toBe("Advisor");
  });
});

describe("what it reports", () => {
  it("says nothing landed when nothing did", async () => {
    // The whole point of reporting skipped separately: an export whose columns are named
    // unexpectedly fails every row, and "3 rows read" must not read as success.
    const res = await importAs(1, "notes,owner\ncall back,Sam\nfollow up,Alex\nping,Chris");
    expect(res.success).toBe(false);
    expect(res.skipped).toBe(3);
    expect(res.total).toBe(3);
    expect(res.accounts).toEqual({ imported: 0, updated: 0 });
    expect(store().accounts).toHaveLength(0);
  });

  it("refuses input it cannot read as a table, instead of reporting an empty success", async () => {
    await expect(importAs(1, "   ")).rejects.toThrow();
  });

  it("counts the rows it could not use alongside the ones it could", async () => {
    const res = await importAs(1, "company,website\nAcme,acme.com\nNo Site Co,\nGlobex,globex.io");
    expect(res.accounts.imported).toBe(2);
    expect(res.skipped).toBe(1);
    expect(res.total).toBe(3);
    expect(res.success).toBe(true);
  });
});
