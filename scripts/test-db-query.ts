import { getAllAccounts, getDb } from "../server/db";

async function run() {
  console.log("DEMO_MODE:", process.env.DEMO_MODE);
  const db = await getDb();
  console.log("Database initialized:", !!db);
  
  const accounts = await getAllAccounts(false);
  console.log("Accounts (isDemoUser=false):", JSON.stringify(accounts, null, 2));

  const accountsDemo = await getAllAccounts(true);
  console.log("Accounts (isDemoUser=true):", JSON.stringify(accountsDemo, null, 2));
}

run().catch(console.error);
