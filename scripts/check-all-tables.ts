import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function checkTables() {
  const db = await getDb();
  if (!db) return;
  
  // List all tables
  const tables = await db.execute(sql`SHOW TABLES`);
  console.log("=== All Tables ===");
  console.log(tables);
  
  process.exit(0);
}

checkTables();
