import { getDb } from '../server/db';
import { contacts, accounts } from '../drizzle/schema';
import { sql, isNull, like } from 'drizzle-orm';

async function checkMapping() {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  console.log('=== CONTACT-ACCOUNT MAPPING AUDIT ===\n');

  // Get total counts
  const totalContacts = await db.select({ count: sql<number>`COUNT(*)` }).from(contacts);
  const totalAccounts = await db.select({ count: sql<number>`COUNT(*)` }).from(accounts);
  
  console.log(`Total Contacts: ${totalContacts[0].count}`);
  console.log(`Total Accounts: ${totalAccounts[0].count}`);

  // Get mapping stats
  const mappedContacts = await db.select({ count: sql<number>`COUNT(*)` })
    .from(contacts)
    .where(sql`accountId IS NOT NULL`);
  
  const unmappedContacts = await db.select({ count: sql<number>`COUNT(*)` })
    .from(contacts)
    .where(isNull(contacts.accountId));

  console.log(`\nMapped Contacts: ${mappedContacts[0].count}`);
  console.log(`Unmapped Contacts: ${unmappedContacts[0].count}`);
  console.log(`Mapping Rate: ${((Number(mappedContacts[0].count) / Number(totalContacts[0].count)) * 100).toFixed(1)}%`);

  // Get sample of unmapped contacts
  console.log('\n=== SAMPLE UNMAPPED CONTACTS ===');
  const unmapped = await db.select({
    id: contacts.id,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    email: contacts.email,
    company: contacts.company,
    title: contacts.title
  })
  .from(contacts)
  .where(isNull(contacts.accountId))
  .limit(30);

  for (const c of unmapped) {
    console.log(`ID ${c.id}: ${c.firstName} ${c.lastName} | ${c.email} | Company: ${c.company} | Title: ${c.title}`);
  }

  // Get all unique company names from unmapped contacts
  console.log('\n=== UNIQUE COMPANIES IN UNMAPPED CONTACTS ===');
  const uniqueCompanies = await db.selectDistinct({ company: contacts.company })
    .from(contacts)
    .where(isNull(contacts.accountId))
    .limit(100);

  let matchCount = 0;
  let noMatchCount = 0;

  for (const c of uniqueCompanies) {
    if (c.company) {
      // Try to find matching account by exact name first
      let matchingAccount = await db.select({ id: accounts.id, name: accounts.name, domain: accounts.domain })
        .from(accounts)
        .where(like(accounts.name, c.company))
        .limit(1);
      
      // If no exact match, try partial match
      if (matchingAccount.length === 0) {
        const firstWord = c.company.split(' ')[0];
        if (firstWord.length > 2) {
          matchingAccount = await db.select({ id: accounts.id, name: accounts.name, domain: accounts.domain })
            .from(accounts)
            .where(like(accounts.name, `%${firstWord}%`))
            .limit(1);
        }
      }
      
      if (matchingAccount.length > 0) {
        console.log(`✓ "${c.company}" -> Account ${matchingAccount[0].id} "${matchingAccount[0].name}" (${matchingAccount[0].domain})`);
        matchCount++;
      } else {
        console.log(`✗ "${c.company}" -> NO MATCH`);
        noMatchCount++;
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Companies with potential matches: ${matchCount}`);
  console.log(`Companies with no matches: ${noMatchCount}`);

  process.exit(0);
}

checkMapping().catch(console.error);
