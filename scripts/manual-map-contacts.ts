import { getDb } from '../server/db';
import { contacts, accounts } from '../drizzle/schema';
import { sql, eq, isNull, like, or } from 'drizzle-orm';

// Manual mappings based on domain research
const MANUAL_MAPPINGS: Record<string, string[]> = {
  // csc.com -> DXC Technology (CSC merged with HP Enterprise Services to form DXC)
  'csc.com': ['DXC', 'Computer Sciences'],
  // afs.com -> could be multiple companies, need to check
  'afs.com': ['AFS', 'American Financial'],
  // vanguard.com -> Vanguard Group
  'vanguard.com': ['Vanguard'],
  // 1800flowers.com -> 1-800-FLOWERS.COM
  '1800flowers.com': ['1-800', 'Flowers', '1800'],
  // cat.com -> Caterpillar Inc
  'cat.com': ['Caterpillar', 'CAT'],
  // zsassociates.com -> ZS Associates
  'zsassociates.com': ['ZS'],
  // raytheon.com -> RTX (Raytheon merged with United Technologies)
  'raytheon.com': ['RTX', 'Raytheon'],
  // onestreamsoftware.com -> OneStream Software
  'onestreamsoftware.com': ['OneStream'],
};

async function manualMapContacts() {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  console.log('=== MANUAL CONTACT-ACCOUNT MAPPING ===\n');

  // Get all unmapped contacts
  const unmappedContacts = await db.select({
    id: contacts.id,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    email: contacts.email,
  })
  .from(contacts)
  .where(isNull(contacts.accountId));

  console.log(`Found ${unmappedContacts.length} unmapped contacts\n`);

  let mappedCount = 0;
  let failedCount = 0;

  for (const contact of unmappedContacts) {
    if (!contact.email) {
      console.log(`✗ Contact ${contact.id} has no email`);
      failedCount++;
      continue;
    }

    const emailDomain = contact.email.split('@')[1]?.toLowerCase();
    if (!emailDomain) {
      console.log(`✗ Contact ${contact.id} has invalid email: ${contact.email}`);
      failedCount++;
      continue;
    }

    // Check if we have a manual mapping for this domain
    const searchTerms = MANUAL_MAPPINGS[emailDomain];
    if (!searchTerms) {
      console.log(`✗ No manual mapping for domain: ${emailDomain}`);
      failedCount++;
      continue;
    }

    // Search for matching account
    let matchedAccount: { id: number; name: string | null } | null = null;
    
    for (const term of searchTerms) {
      const results = await db.select({ id: accounts.id, name: accounts.name })
        .from(accounts)
        .where(or(
          like(accounts.name, `%${term}%`),
          like(accounts.domain, `%${term.toLowerCase()}%`)
        ))
        .limit(1);
      
      if (results.length > 0) {
        matchedAccount = results[0];
        break;
      }
    }

    if (matchedAccount) {
      await db.update(contacts)
        .set({ accountId: matchedAccount.id })
        .where(eq(contacts.id, contact.id));
      
      console.log(`✓ ${contact.firstName || ''} ${contact.lastName || ''} (${contact.email}) -> ${matchedAccount.name} (ID: ${matchedAccount.id})`);
      mappedCount++;
    } else {
      console.log(`✗ No account found for ${contact.email} (searched: ${searchTerms.join(', ')})`);
      failedCount++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Successfully mapped: ${mappedCount}`);
  console.log(`Failed to map: ${failedCount}`);

  // Verify final state
  const finalUnmapped = await db.select({ count: sql<number>`COUNT(*)` })
    .from(contacts)
    .where(isNull(contacts.accountId));
  
  console.log(`\nRemaining unmapped contacts: ${finalUnmapped[0].count}`);

  // List remaining unmapped for manual review
  if (Number(finalUnmapped[0].count) > 0) {
    console.log('\n=== REMAINING UNMAPPED CONTACTS ===');
    const remaining = await db.select({
      id: contacts.id,
      email: contacts.email,
    })
    .from(contacts)
    .where(isNull(contacts.accountId));
    
    for (const c of remaining) {
      console.log(`ID ${c.id}: ${c.email}`);
    }
  }

  process.exit(0);
}

manualMapContacts().catch(console.error);
