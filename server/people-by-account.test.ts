import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext } from "./test-utils";

/**
 * The account page's "View all" contacts link goes to /contacts?account=<id>. The contacts
 * page read no parameters, and the unfiltered list it fetches is capped at 1,500 rows —
 * so narrowing on the client would have reported "0 contacts" for any account whose people
 * sit past the cap. people.list now takes the account and returns its contacts in full.
 *
 * people.prioritize had the same shape of problem from the other side: given an account,
 * it looked contacts up with a function that always returned [], so it ranked nobody.
 */

vi.mock("./ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./ai")>()),
  // Capture what the ranking step is handed; the ranking itself needs a model.
  prioritizeContacts: vi.fn(async (contacts: any[]) => contacts),
}));

const DB = path.join(process.cwd(), "demo-db.test-people-by-account.json");
const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_DB_PATH = DB;
  try { fs.unlinkSync(DB); } catch { /* not there */ }
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  try { fs.unlinkSync(DB); } catch { /* not there */ }
});

async function seed() {
  const { getDb } = await import("./db");
  const { accounts, contacts } = await import("../drizzle/schema");
  const db: any = await getDb();
  await db.delete(contacts);
  await db.delete(accounts);
  await db.insert(accounts).values([
    { id: 1, name: "Big Book" },
    { id: 2, name: "Northwind Logistics" },
  ]);
  // The unfiltered list is newest first and capped at 1,500. Northwind's two contacts are
  // older than 1,600 at another account, so they sit past the cap in the list's own order.
  await db.insert(contacts).values([
    { accountId: 2, name: "Sarah Chen", title: "VP Sales", createdAt: new Date("2020-01-01") },
    { accountId: 2, name: "Marcus Reyes", title: "RevOps Director", createdAt: new Date("2020-01-01") },
  ]);
  await db.insert(contacts).values(
    Array.from({ length: 1600 }, (_, i) => ({
      accountId: 1,
      name: `Filler ${i}`,
      createdAt: new Date("2026-01-01"),
    }))
  );
}

describe("one account's contacts", () => {
  it("are all returned, even when they sit past the unfiltered cap", async () => {
    await seed();
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(mockAuthContext as any);

    // The unfiltered list stops at 1,500, before Northwind's contacts.
    const unfiltered = await caller.people.list();
    expect(unfiltered.some((c: any) => c.accountId === 2)).toBe(false);

    const theirs = await caller.people.list({ accountId: 2 });
    expect(theirs.map((c: any) => c.name).sort()).toEqual(["Marcus Reyes", "Sarah Chen"]);
    expect(theirs.every((c: any) => c.accountId === 2)).toBe(true);
  });

  it("are what the ranking step is given, not an empty list", async () => {
    await seed();
    const { appRouter } = await import("./routers");
    const ai = await import("./ai");
    const caller = appRouter.createCaller(mockAuthContext as any);

    await caller.people.prioritize({ accountId: 2 });
    const handed = (ai.prioritizeContacts as any).mock.calls.at(-1)[0];
    expect(handed.map((c: any) => c.name).sort()).toEqual(["Marcus Reyes", "Sarah Chen"]);
  });
});
