import { getDb } from '../server/db';
import { calls, accounts, contacts } from '../drizzle/schema';
import { sql, eq, isNull, like, or } from 'drizzle-orm';

async function mapCallsToAccounts() {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  console.log('=== CALL-ACCOUNT MAPPING ===\n');

  // Get all unmapped calls
  const unmappedCalls = await db.select({
    id: calls.id,
    title: calls.title,
    contactId: calls.contactId,
  })
  .from(calls)
  .where(isNull(calls.accountId));

  console.log(`Found ${unmappedCalls.length} unmapped calls\n`);

  let mappedCount = 0;
  let failedCount = 0;

  for (const call of unmappedCalls) {
    // Strategy 1: If call has a contactId, get the account from the contact
    if (call.contactId) {
      const contact = await db.select({ accountId: contacts.accountId })
        .from(contacts)
        .where(eq(contacts.id, call.contactId))
        .limit(1);
      
      if (contact.length > 0 && contact[0].accountId) {
        await db.update(calls)
          .set({ accountId: contact[0].accountId })
          .where(eq(calls.id, call.id));
        
        console.log(`✓ Call ${call.id} "${call.title}" -> Account ${contact[0].accountId} (via contact ${call.contactId})`);
        mappedCount++;
        continue;
      }
    }

    // Strategy 2: Try to match by call title (often contains company name)
    if (call.title) {
      // Extract potential company name from title
      const titleWords = call.title.split(/[\s\-\|:]+/);
      
      for (const word of titleWords) {
        if (word.length > 3) {
          const matchingAccount = await db.select({ id: accounts.id, name: accounts.name })
            .from(accounts)
            .where(like(accounts.name, `%${word}%`))
            .limit(1);
          
          if (matchingAccount.length > 0) {
            await db.update(calls)
              .set({ accountId: matchingAccount[0].id })
              .where(eq(calls.id, call.id));
            
            console.log(`✓ Call ${call.id} "${call.title}" -> ${matchingAccount[0].name} (ID: ${matchingAccount[0].id}) (via title match: ${word})`);
            mappedCount++;
            break;
          }
        }
      }
    }

    // If still not mapped
    const checkCall = await db.select({ accountId: calls.accountId })
      .from(calls)
      .where(eq(calls.id, call.id))
      .limit(1);
    
    if (!checkCall[0]?.accountId) {
      console.log(`✗ Call ${call.id} "${call.title}" -> NO MATCH`);
      failedCount++;
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Successfully mapped: ${mappedCount}`);
  console.log(`Failed to map: ${failedCount}`);

  // Verify final state
  const finalUnmapped = await db.select({ count: sql<number>`COUNT(*)` })
    .from(calls)
    .where(isNull(calls.accountId));
  
  console.log(`\nRemaining unmapped calls: ${finalUnmapped[0].count}`);

  process.exit(0);
}

mapCallsToAccounts().catch(console.error);
