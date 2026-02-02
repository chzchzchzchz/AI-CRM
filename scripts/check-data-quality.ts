import { getDb } from "../server/db";
import { accounts } from "../drizzle/schema";

async function checkDataQuality() {
  const db = await getDb();
  if (!db) {
    console.error("Could not connect to database");
    process.exit(1);
  }
  
  // Get total counts
  const allAccounts = await db.select().from(accounts);
  
  const unknownIndustry = allAccounts.filter((a: any) => 
    !a.industry || a.industry === '' || a.industry === 'Unknown'
  ).length;
  
  const zeroIntent = allAccounts.filter((a: any) => 
    !a.intentScore || a.intentScore === 0
  ).length;
  
  console.log("=== DATA QUALITY REPORT ===");
  console.log(`Total Accounts: ${allAccounts.length}`);
  console.log(`Unknown Industry: ${unknownIndustry} (${((unknownIndustry/allAccounts.length)*100).toFixed(1)}%)`);
  console.log(`Zero Intent Score: ${zeroIntent} (${((zeroIntent/allAccounts.length)*100).toFixed(1)}%)`);
  
  // Sample some accounts with issues
  const issueAccounts = allAccounts
    .filter((a: any) => (!a.industry || a.industry === 'Unknown') && (!a.intentScore || a.intentScore === 0))
    .slice(0, 10);
  
  if (issueAccounts.length > 0) {
    console.log("\\nSample accounts with both issues:");
    issueAccounts.forEach((a: any) => {
      console.log(`  - ${a.name} (${a.domain}): industry=${a.industry}, intent=${a.intentScore}`);
    });
  }
  
  process.exit(0);
}

checkDataQuality().catch(console.error);
