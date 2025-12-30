import { getDb } from "../server/db";
import { accounts } from "../drizzle/schema";

async function checkRawData() {
  const db = await getDb();
  if (!db) return;
  
  const samples = await db.select({ rawData: accounts.rawData }).from(accounts).limit(5);
  
  const allKeys = new Set<string>();
  
  for (const s of samples) {
    if (s.rawData) {
      const data = typeof s.rawData === 'string' ? JSON.parse(s.rawData) : s.rawData;
      Object.keys(data).forEach(k => allKeys.add(k));
    }
  }
  
  console.log("=== Fields in rawData ===");
  console.log([...allKeys].sort().join('\n'));
  process.exit(0);
}

checkRawData();
