import { getDb } from "../server/db";
import { calls, accounts } from "../drizzle/schema";
import { sql, eq, desc } from "drizzle-orm";

async function verify() {
  const db = await getDb();
  if (!db) return;

  const [stats] = await db.select({
    total: sql<number>`COUNT(*)`,
    linked: sql<number>`SUM(CASE WHEN accountId IS NOT NULL THEN 1 ELSE 0 END)`,
    unlinked: sql<number>`SUM(CASE WHEN accountId IS NULL THEN 1 ELSE 0 END)`
  }).from(calls);

  console.log("=== Call Stats ===");
  console.log(`Total: ${stats.total}`);
  console.log(`Linked: ${stats.linked}`);
  console.log(`Unlinked: ${stats.unlinked}`);

  if (stats.linked > 0) {
    const distribution = await db.select({
      accountName: accounts.name,
      callCount: sql<number>`COUNT(*)`.as('callCount')
    })
      .from(calls)
      .innerJoin(accounts, eq(calls.accountId, accounts.id))
      .groupBy(accounts.name)
      .orderBy(desc(sql`callCount`))
      .limit(15);

    console.log("\n=== Top 15 Accounts by Call Count ===");
    distribution.forEach((d, i) => {
      console.log(`${i + 1}. ${d.accountName}: ${d.callCount} calls`);
    });
  }

  process.exit(0);
}

verify();
