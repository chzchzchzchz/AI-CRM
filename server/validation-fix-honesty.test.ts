import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mockAuthContext } from "./test-utils";

/**
 * `validation.fixIssue` reported an edit it had not made.
 *
 * Both branches returned `{ success: true, message: "Updated industry on account 4021" }`
 * unconditionally. The account branch discarded `updateAccount`'s result — it returned
 * void — and the contact branch never looked at the UPDATE's. So an id that matched
 * nothing produced a confident success, the Data Validation page struck the issue off,
 * and the field was exactly as wrong as before.
 *
 * The same shape was already found and fixed in admin-router ("a bare UPDATE with no
 * affectedRows check reported success for a userId that matched nothing — confirmed live,
 * id 999999999 and id -1 both returned {success:true}"). This is the second instance, and
 * the reason it matters more now: org scoping means another tenant's id is a legitimate
 * zero-row write. The write that must not read as success is no longer only a typo — it
 * is the boundary doing its job.
 */

const DB_PATH = path.join(process.cwd(), "validation-fix-test-db.json");

beforeAll(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      {
        accounts: [
          { id: 1, orgId: 1, name: "Ours", industry: "Logistics" },
          { id: 2, orgId: 2, name: "Theirs", industry: "Fintech" },
        ],
        contacts: [
          { id: 10, orgId: 1, accountId: 1, name: "Ours Contact", title: "VP" },
          { id: 11, orgId: 2, accountId: 2, name: "Theirs Contact", title: "VP" },
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

async function fix(input: {
  entityType: "account" | "contact";
  entityId: number;
  field: string;
  newValue: string;
}) {
  const { validationRouter } = await import("./validation-router");
  return await validationRouter.createCaller(mockAuthContext as any).fixIssue({
    issueId: "test-issue",
    ...input,
  });
}

describe("validation.fixIssue — reports the edit it actually made", () => {
  it("succeeds on a row it owns, and the value really changes", async () => {
    const res = await fix({ entityType: "account", entityId: 1, field: "industry", newValue: "Freight" });
    expect(res.success).toBe(true);

    const { getAccountById } = await import("./db");
    expect((await getAccountById(1, 1))?.industry).toBe("Freight");
  });

  it("does NOT report success for an id that matched nothing", async () => {
    // The original bug: "Updated industry on account 999999" for an account that does
    // not exist. The page then removes the issue from the list as resolved.
    const res = await fix({ entityType: "account", entityId: 999999, field: "industry", newValue: "Freight" });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/no account 999999 to update/i);
  });

  it("does NOT report success for another organization's account", async () => {
    // Account 2 exists — it just isn't ours. Before the org filter this would have
    // succeeded and edited another tenant's row; now it matches nothing, and the answer
    // has to say so rather than claiming an edit.
    const res = await fix({ entityType: "account", entityId: 2, field: "industry", newValue: "Freight" });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/another organization|deleted/i);

    const { getAccountById } = await import("./db");
    expect((await getAccountById(2, 2))?.industry).toBe("Fintech");
  });

  it("applies the same rule to contacts, not just accounts", async () => {
    // The two branches are separate code paths and only one of them was ever going to
    // get fixed by accident.
    const ok = await fix({ entityType: "contact", entityId: 10, field: "title", newValue: "SVP" });
    expect(ok.success).toBe(true);

    const missing = await fix({ entityType: "contact", entityId: 999999, field: "title", newValue: "SVP" });
    expect(missing.success).toBe(false);

    const otherOrg = await fix({ entityType: "contact", entityId: 11, field: "title", newValue: "SVP" });
    expect(otherOrg.success).toBe(false);
  });

  it("still refuses a field that is not editable", async () => {
    const res = await fix({ entityType: "account", entityId: 1, field: "orgId", newValue: "2" });
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not editable/i);
  });
});
