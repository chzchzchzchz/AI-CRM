import { getDb } from '../server/db';
import { contacts, accounts } from '../drizzle/schema';
import { sql, eq, isNull, like, or } from 'drizzle-orm';

async function mapContactsToAccounts() {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  console.log('=== CONTACT-ACCOUNT MAPPING ===\n');

  // Get all unmapped contacts
  const unmappedContacts = await db.select({
    id: contacts.id,
    firstName: contacts.firstName,
    lastName: contacts.lastName,
    email: contacts.email,
    title: contacts.title,
  })
  .from(contacts)
  .where(isNull(contacts.accountId));

  console.log(`Found ${unmappedContacts.length} unmapped contacts\n`);

  // Get all accounts with their domains
  const allAccounts = await db.select({
    id: accounts.id,
    name: accounts.name,
    domain: accounts.domain,
  }).from(accounts);

  console.log(`Found ${allAccounts.length} accounts to match against\n`);

  // Create domain lookup map
  const domainToAccount = new Map<string, { id: number; name: string }>();
  const nameToAccount = new Map<string, { id: number; name: string }>();
  
  for (const acc of allAccounts) {
    if (acc.domain) {
      // Extract base domain (e.g., cisco.com from www.cisco.com)
      const baseDomain = acc.domain.replace(/^(www\.|https?:\/\/)/, '').toLowerCase();
      domainToAccount.set(baseDomain, { id: acc.id, name: acc.name });
      
      // Also map without TLD for fuzzy matching
      const domainWithoutTld = baseDomain.split('.')[0];
      if (domainWithoutTld.length > 2) {
        domainToAccount.set(domainWithoutTld, { id: acc.id, name: acc.name });
      }
    }
    if (acc.name) {
      nameToAccount.set(acc.name.toLowerCase(), { id: acc.id, name: acc.name });
      // Also map first word of name
      const firstWord = acc.name.split(' ')[0].toLowerCase();
      if (firstWord.length > 2 && !nameToAccount.has(firstWord)) {
        nameToAccount.set(firstWord, { id: acc.id, name: acc.name });
      }
    }
  }

  let mappedCount = 0;
  let failedCount = 0;
  const mappings: { contactId: number; accountId: number; reason: string }[] = [];

  for (const contact of unmappedContacts) {
    let matchedAccount: { id: number; name: string } | undefined;
    let matchReason = '';

    // Strategy 1: Match by email domain
    if (contact.email) {
      const emailDomain = contact.email.split('@')[1]?.toLowerCase();
      if (emailDomain) {
        // Try exact domain match
        matchedAccount = domainToAccount.get(emailDomain);
        if (matchedAccount) {
          matchReason = `email domain exact: ${emailDomain}`;
        } else {
          // Try domain without TLD
          const domainWithoutTld = emailDomain.split('.')[0];
          matchedAccount = domainToAccount.get(domainWithoutTld);
          if (matchedAccount) {
            matchReason = `email domain partial: ${domainWithoutTld}`;
          }
        }
      }
    }

    // Strategy 2: Match by name in email (e.g., john@cisco.com -> Cisco)
    if (!matchedAccount && contact.email) {
      const emailParts = contact.email.split('@');
      if (emailParts[1]) {
        const domainName = emailParts[1].split('.')[0].toLowerCase();
        matchedAccount = nameToAccount.get(domainName);
        if (matchedAccount) {
          matchReason = `email domain name: ${domainName}`;
        }
      }
    }

    if (matchedAccount) {
      mappings.push({
        contactId: contact.id,
        accountId: matchedAccount.id,
        reason: matchReason
      });
      console.log(`✓ ${contact.firstName} ${contact.lastName} (${contact.email}) -> ${matchedAccount.name} (${matchReason})`);
      mappedCount++;
    } else {
      console.log(`✗ ${contact.firstName} ${contact.lastName} (${contact.email}) -> NO MATCH`);
      failedCount++;
    }
  }

  console.log(`\n=== APPLYING MAPPINGS ===`);
  console.log(`Mapping ${mappings.length} contacts...`);

  // Apply mappings in batches
  for (const mapping of mappings) {
    await db.update(contacts)
      .set({ accountId: mapping.accountId })
      .where(eq(contacts.id, mapping.contactId));
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Successfully mapped: ${mappedCount}`);
  console.log(`Failed to map: ${failedCount}`);
  console.log(`Total processed: ${unmappedContacts.length}`);

  // Verify final state
  const finalUnmapped = await db.select({ count: sql<number>`COUNT(*)` })
    .from(contacts)
    .where(isNull(contacts.accountId));
  
  console.log(`\nRemaining unmapped contacts: ${finalUnmapped[0].count}`);

  process.exit(0);
}

mapContactsToAccounts().catch(console.error);
