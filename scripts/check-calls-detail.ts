import { getDb } from "../server/db";
import { calls, accounts } from "../drizzle/schema";
import { isNull, sql, like } from "drizzle-orm";

async function checkCallsDetail() {
  const db = await getDb();
  if (!db) return;
  
  // Get sample of calls with all fields
  const sampleCalls = await db.select().from(calls).where(isNull(calls.accountId)).limit(5);
  
  console.log("=== Full Call Data Sample ===");
  for (const call of sampleCalls) {
    console.log(JSON.stringify(call, null, 2));
  }
  
  // Get sample of accounts with names/domains
  const sampleAccounts = await db.select({
    id: accounts.id,
    name: accounts.name,
    domain: accounts.domain
  }).from(accounts).limit(10);
  
  console.log("\n=== Sample Account Names/Domains ===");
  for (const acc of sampleAccounts) {
    console.log(`ID: ${acc.id} | Name: ${acc.name} | Domain: ${acc.domain}`);
  }
  
  process.exit(0);
}

checkCallsDetail();
