import { getDb } from "../server/db";
import { calls, accounts } from "../drizzle/schema";
import { isNull, sql } from "drizzle-orm";

async function checkCalls() {
  const db = await getDb();
  if (!db) return;
  
  // Get sample of unlinked calls
  const unlinkedCalls = await db.select({
    id: calls.id,
    title: calls.title,
    callDate: calls.callDate
  }).from(calls).where(isNull(calls.accountId)).limit(20);
  
  console.log("=== Sample Unlinked Calls ===");
  for (const call of unlinkedCalls) {
    console.log(`ID: ${call.id} | Title: ${call.title}`);
  }
  
  // Get count of linked vs unlinked
  const [stats] = await db.select({
    total: sql<number>`COUNT(*)`,
    unlinked: sql<number>`SUM(CASE WHEN accountId IS NULL THEN 1 ELSE 0 END)`,
    linked: sql<number>`SUM(CASE WHEN accountId IS NOT NULL THEN 1 ELSE 0 END)`
  }).from(calls);
  
  console.log("\n=== Call Stats ===");
  console.log(`Total: ${stats.total}, Linked: ${stats.linked}, Unlinked: ${stats.unlinked}`);
  
  process.exit(0);
}

checkCalls();
