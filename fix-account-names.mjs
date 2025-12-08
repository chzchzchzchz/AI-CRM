import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { accounts } from "./drizzle/schema.js";
import { eq } from "drizzle-orm";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Get all accounts with "LinkedIn" as name
const linkedinAccounts = await db.select().from(accounts).where(eq(accounts.name, "LinkedIn"));

console.log(`Found ${linkedinAccounts.length} accounts with "LinkedIn" as name`);

// Function to extract company name from domain
function domainToCompanyName(domain) {
  if (!domain) return null;
  
  // Remove www. prefix
  const cleanDomain = domain.replace(/^www\./, "");
  
  // Extract the main part (before first dot)
  const mainPart = cleanDomain.split(".")[0];
  
  // Capitalize first letter of each word
  return mainPart
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Update each account
let updated = 0;
for (const account of linkedinAccounts) {
  if (account.domain) {
    const newName = domainToCompanyName(account.domain);
    if (newName && newName !== "LinkedIn") {
      await db.update(accounts)
        .set({ name: newName })
        .where(eq(accounts.id, account.id));
      console.log(`Updated account ${account.id}: "${account.domain}" → "${newName}"`);
      updated++;
    }
  }
}

console.log(`\nUpdated ${updated} accounts`);
await connection.end();
