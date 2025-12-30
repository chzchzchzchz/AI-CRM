import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function checkTranscripts() {
  const db = await getDb();
  if (!db) return;
  
  // Check transcriptReports table structure and sample
  const structure = await db.execute(sql`DESCRIBE transcriptReports`);
  console.log("=== transcriptReports Structure ===");
  console.log(structure[0]);
  
  const count = await db.execute(sql`SELECT COUNT(*) as cnt FROM transcriptReports`);
  console.log("\n=== Count ===");
  console.log(count[0]);
  
  const sample = await db.execute(sql`SELECT * FROM transcriptReports LIMIT 3`);
  console.log("\n=== Sample Data ===");
  console.log(JSON.stringify(sample[0], null, 2));
  
  process.exit(0);
}

checkTranscripts();
