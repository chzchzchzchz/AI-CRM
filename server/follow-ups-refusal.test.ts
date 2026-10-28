import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createMockContext } from "./test-utils";

/**
 * A follow-up mutation must not report success for a row it refused to touch.
 *
 * `complete` carried this comment: "Scoped to the caller: an id alone must never be
 * enough to close someone else's commitment." The filter was right. The ANSWER was not —
 * all four mutations returned `{ success: true }` whether or not the WHERE matched, so
 * an attempt on someone else's follow-up (the exact case the filter exists to stop) came
 * back as done and the UI struck it off the list.
 *
 * A follow-up is a commitment to contact a person. "Completed" is a claim that it was
 * handled. Making that claim about a row the caller was refused is the same defect this
 * repo keeps finding: a refusal rendered as a success.
 */

const DB_PATH = path.join(process.cwd(), "follow-ups-refusal-test-db.json");

const MINE = 1;
const THEIRS = 2;

function seed() {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      {
        followUps: [
          { id: 100, orgId: 1, userId: MINE, contactId: 1, accountId: 1, status: "open", dueDate: new Date().toISOString() },
          { id: 200, orgId: 1, userId: THEIRS, contactId: 2, accountId: 1, status: "open", dueDate: new Date().toISOString() },
          { id: 300, orgId: 2, userId: MINE, contactId: 3, accountId: 2, status: "open", dueDate: new Date().toISOString() },
        ],
        contacts: [], accounts: [], users: [],
      },
      null,
      2
    )
  );
}

beforeAll(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  seed();
});

afterAll(() => {
  fs.rmSync(DB_PATH, { force: true });
});

/** A caller who is user MINE in org 1. */
function caller() {
  const ctx = createMockContext({ id: MINE, orgId: 1 } as any);
  return import("./follow-ups").then(m => m.followUpsRouter.createCaller(ctx as any));
}

describe("follow-ups — a refused write reads as refused", () => {
  it("completes a follow-up that is actually the caller's", async () => {
    const c = await caller();
    await expect(c.complete({ id: 100 })).resolves.toEqual({ success: true });
  });

  it("refuses another USER's follow-up instead of reporting it done", async () => {
    // Row 200 exists and is in the caller's org — it just belongs to a colleague. The
    // filter already excluded it; what was missing was saying so.
    const c = await caller();
    await expect(c.complete({ id: 200 })).rejects.toThrow(/not yours/i);
  });

  it("refuses another ORG's follow-up", async () => {
    const c = await caller();
    await expect(c.complete({ id: 300 })).rejects.toThrow(/not yours/i);
  });

  it("refuses an id that does not exist at all", async () => {
    const c = await caller();
    await expect(c.complete({ id: 999999 })).rejects.toThrow(/not yours/i);
  });

  it("applies the same rule to reopen and remove", async () => {
    // Separate code paths; only one of them was ever going to get fixed by accident.
    const c = await caller();
    await expect(c.reopen({ id: 200 })).rejects.toThrow(/not yours/i);
    await expect(c.remove({ id: 200 })).rejects.toThrow(/not yours/i);

    // …and still work on the caller's own row.
    await expect(c.reopen({ id: 100 })).resolves.toEqual({ success: true });
    await expect(c.snooze({ id: 100, days: 3 })).resolves.toMatchObject({ success: true });
    await expect(c.remove({ id: 100 })).resolves.toEqual({ success: true });
  });

  it("snooze already refused correctly, via its own lookup", async () => {
    // Three of the four were wrong; snooze was not. It reads the row first (to snooze
    // from today rather than from a stale due date) with the same three-part filter, and
    // throws when that finds nothing. Pinned so the difference is deliberate rather than
    // an accident nobody noticed — and so a later refactor that drops the lookup has to
    // fail here rather than silently reintroduce the bug the other three had.
    const c = await caller();
    await expect(c.snooze({ id: 200, days: 3 })).rejects.toThrow(/not found/i);
    await expect(c.snooze({ id: 300, days: 3 })).rejects.toThrow(/not found/i);
  });

  it("leaves the refused rows untouched", async () => {
    // The point of the whole exercise: nothing the caller was refused actually changed.
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    const theirs = data.followUps.find((f: any) => f.id === 200);
    const otherOrg = data.followUps.find((f: any) => f.id === 300);
    expect(theirs?.status).toBe("open");
    expect(otherOrg?.status).toBe("open");
  });
});
