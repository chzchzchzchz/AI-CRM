import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { accounts, contacts } from "../drizzle/schema";
import { parseUniversalData } from "./universal-parser";
import { mapRows, type MappedAccount, type MappedContact } from "./_core/data-import";

/**
 * Import a customer's own accounts and contacts into their own workspace.
 *
 * `SIGNUP_MODE=self-serve` gives every new customer an empty organization. Before this
 * there was no way to fill one without operator-level connector credentials: the CSV
 * Processor builds a file for Salesforce or HubSpot, the Lead Processor parses and
 * returns, and `clayImport.importRawData` — the one procedure that wrote accounts — had
 * no UI and handled accounts only.
 *
 * Everything read or written here is scoped to `ctx.orgId`, which comes from the session.
 * An import is the easiest place in an app to lose that: the natural key for an account
 * is its domain and two customers can legitimately both track acme.com, so a lookup on
 * domain alone would find the OTHER tenant's row and the update would overwrite their
 * data with this import's.
 */

const BATCH_LIMIT = 20_000;

export const dataImportRouter = router({
  /**
   * Parse pasted rows and write what they describe.
   *
   * Reports accounts and contacts separately, and skipped rows separately again, because
   * they are separate facts. Summing them into one number is how "400 rows imported"
   * comes to mean "400 rows read, none of which had a column this could match on" — the
   * exact failure a mis-named domain column produces on every row at once.
   */
  importRows: protectedProcedure
    .input(z.object({ rawData: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      let parsed;
      try {
        parsed = parseUniversalData(input.rawData);
      } catch (e) {
        // The parser throws on input it cannot make rows of at all. Saying so beats a
        // zero-count success, which reads as "your file was fine and empty".
        throw new Error(
          "Couldn't read that as a table. Paste rows with a header line, or a JSON array."
        );
      }

      if (parsed.length > BATCH_LIMIT) {
        throw new Error(
          `That's ${parsed.length.toLocaleString()} rows. Import up to ${BATCH_LIMIT.toLocaleString()} at a time.`
        );
      }

      const batch = mapRows(parsed);

      const accountResult = await writeAccounts(db, ctx.orgId, batch.accounts);
      const contactResult = await writeContacts(db, ctx.orgId, batch.contacts, accountResult.idByDomain);

      const landed =
        accountResult.imported + accountResult.updated + contactResult.imported + contactResult.updated;

      return {
        // False only when there was something to import and none of it landed. An empty
        // paste is not a failure; a 400-row paste that wrote nothing is.
        success: !(batch.total > 0 && landed === 0),
        accounts: { imported: accountResult.imported, updated: accountResult.updated },
        contacts: { imported: contactResult.imported, updated: contactResult.updated },
        skipped: batch.skipped,
        total: batch.total,
      };
    }),
});

/**
 * Upsert accounts by (org, domain), and hand back the ids so contacts in the same import
 * can be attached to them without a second round of lookups.
 */
async function writeAccounts(db: any, orgId: number, rows: MappedAccount[]) {
  let imported = 0;
  let updated = 0;
  const idByDomain = new Map<string, number>();

  for (const row of rows) {
    // orgId is half of the key, not a filter added for tidiness: domain alone matches
    // another tenant's row for the same company.
    const [existing] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.domain, row.domain)))
      .limit(1);

    const values: Record<string, unknown> = { name: row.name, domain: row.domain };
    if (Object.keys(row.extra).length > 0) values.rawData = row.extra;

    if (existing) {
      await db
        .update(accounts)
        .set(values)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.id, existing.id)));
      idByDomain.set(row.domain, existing.id);
      updated++;
    } else {
      const result: any = await db.insert(accounts).values({ ...values, orgId });
      // The demo store and mysql2 report a new id differently; re-read when neither
      // shape carries one, rather than attaching this import's contacts to nothing.
      const insertId = result?.insertId ?? result?.[0]?.insertId;
      if (insertId) {
        idByDomain.set(row.domain, Number(insertId));
      } else {
        const [fresh] = await db
          .select()
          .from(accounts)
          .where(and(eq(accounts.orgId, orgId), eq(accounts.domain, row.domain)))
          .limit(1);
        if (fresh) idByDomain.set(row.domain, fresh.id);
      }
      imported++;
    }
  }

  return { imported, updated, idByDomain };
}

/**
 * Upsert contacts by (org, email).
 *
 * A contact whose company is not in this import keeps a null accountId — the column
 * allows it, and inventing an account from a name with no domain would create a second,
 * unmatched copy of a company the customer already has.
 */
async function writeContacts(
  db: any,
  orgId: number,
  rows: MappedContact[],
  idByDomain: Map<string, number>
) {
  let imported = 0;
  let updated = 0;

  for (const row of rows) {
    const [existing] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.orgId, orgId), eq(contacts.email, row.email)))
      .limit(1);

    let accountId: number | null = row.domain ? idByDomain.get(row.domain) ?? null : null;
    if (accountId === null && row.domain) {
      // The company may already be in the workspace from an earlier import.
      const [account] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.domain, row.domain)))
        .limit(1);
      if (account) accountId = account.id;
    }

    // Only fields this row actually carried. A partial re-import — a list of job titles,
    // say — must not blank out the phone numbers an earlier one supplied.
    const values: Record<string, unknown> = {};
    for (const key of [
      "firstName", "lastName", "name", "title", "phone",
      "mobilePhone", "linkedinUrl", "location", "department",
    ] as const) {
      if (row[key] !== null) values[key] = row[key];
    }
    if (accountId !== null) values.accountId = accountId;

    if (existing) {
      if (Object.keys(values).length > 0) {
        await db
          .update(contacts)
          .set(values)
          .where(and(eq(contacts.orgId, orgId), eq(contacts.id, existing.id)));
      }
      updated++;
    } else {
      await db.insert(contacts).values({ ...values, email: row.email, orgId });
      imported++;
    }
  }

  return { imported, updated };
}
