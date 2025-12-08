import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, contacts } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

async function linkContactsToAccounts() {
  console.log('Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('Fetching all accounts...');
  const allAccounts = await db.select().from(accounts);
  console.log(`Found ${allAccounts.length} accounts`);

  console.log('Fetching all contacts...');
  const allContacts = await db.select().from(contacts);
  console.log(`Found ${allContacts.length} contacts`);

  // Create a map of company name -> account ID
  const companyToAccountId = new Map();
  for (const account of allAccounts) {
    if (account.name) {
      companyToAccountId.set(account.name.toLowerCase().trim(), account.id);
    }
    if (account.domain) {
      companyToAccountId.set(account.domain.toLowerCase().trim(), account.id);
    }
  }

  console.log('Linking contacts to accounts...');
  let linked = 0;
  let notLinked = 0;

  for (const contact of allContacts) {
    if (contact.accountId) {
      // Already linked
      continue;
    }

    let accountId = null;

    // Try to match by company name
    if (contact.company) {
      const companyKey = contact.company.toLowerCase().trim();
      accountId = companyToAccountId.get(companyKey);
    }

    // If not found, try to extract domain from email
    if (!accountId && contact.email) {
      const emailDomain = contact.email.split('@')[1];
      if (emailDomain) {
        accountId = companyToAccountId.get(emailDomain.toLowerCase().trim());
      }
    }

    if (accountId) {
      await db.update(contacts)
        .set({ accountId })
        .where(eq(contacts.id, contact.id));
      linked++;
      if (linked % 100 === 0) {
        console.log(`Linked ${linked} contacts...`);
      }
    } else {
      notLinked++;
    }
  }

  console.log(`\n✅ Linking complete!`);
  console.log(`   Linked: ${linked} contacts`);
  console.log(`   Not linked: ${notLinked} contacts`);

  await connection.end();
}

linkContactsToAccounts().catch(console.error);
