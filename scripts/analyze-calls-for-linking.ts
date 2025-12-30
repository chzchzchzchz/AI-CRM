import { getDb } from "../server/db";
import { calls, accounts, contacts } from "../drizzle/schema";
import { isNull, sql, like, or, eq } from "drizzle-orm";

async function analyzeCallsForLinking() {
  const db = await getDb();
  if (!db) return;
  
  // Get all accounts with their names and domains
  const allAccounts = await db.select({
    id: accounts.id,
    name: accounts.name,
    domain: accounts.domain
  }).from(accounts);
  
  console.log(`Total accounts: ${allAccounts.length}`);
  
  // Get all contacts with their email domains
  const allContacts = await db.select({
    id: contacts.id,
    accountId: contacts.accountId,
    email: contacts.email,
    name: contacts.name
  }).from(contacts);
  
  console.log(`Total contacts: ${allContacts.length}`);
  
  // Build email domain to account mapping
  const emailDomainToAccount = new Map<string, number>();
  for (const contact of allContacts) {
    if (contact.email && contact.accountId) {
      const domain = contact.email.split('@')[1]?.toLowerCase();
      if (domain && !domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
        emailDomainToAccount.set(domain, contact.accountId);
      }
    }
  }
  
  console.log(`\nUnique email domains mapped to accounts: ${emailDomainToAccount.size}`);
  
  // Build account name variations for matching
  const accountNameToId = new Map<string, number>();
  for (const acc of allAccounts) {
    // Add full name
    accountNameToId.set(acc.name.toLowerCase(), acc.id);
    
    // Add domain without TLD
    if (acc.domain) {
      const domainBase = acc.domain.replace(/\.(com|io|net|org|co|ai)$/i, '').toLowerCase();
      accountNameToId.set(domainBase, acc.id);
      accountNameToId.set(acc.domain.toLowerCase(), acc.id);
    }
    
    // Add first word of name (for "Salesforce, Inc." -> "salesforce")
    const firstWord = acc.name.split(/[\s,.-]+/)[0].toLowerCase();
    if (firstWord.length > 3) {
      accountNameToId.set(firstWord, acc.id);
    }
  }
  
  console.log(`Account name variations for matching: ${accountNameToId.size}`);
  
  // Sample some account names
  console.log("\n=== Sample Account Name Variations ===");
  let count = 0;
  for (const [name, id] of accountNameToId) {
    if (count++ < 20) {
      console.log(`"${name}" -> Account ID ${id}`);
    }
  }
  
  process.exit(0);
}

analyzeCallsForLinking();
