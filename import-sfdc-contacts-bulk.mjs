import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, contacts } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';
import * as salesforce from './server/salesforce.ts';

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Normalize a domain to consistent format
 */
function normalizeDomain(domain) {
  if (!domain) return null;
  
  try {
    let normalized = domain.replace(/^(https?:\/\/)/, '');
    normalized = normalized.replace(/\/$/, '');
    
    try {
      const url = new URL(`https://${normalized}`);
      normalized = url.hostname;
    } catch {
      normalized = normalized.split('/')[0];
    }
    
    normalized = normalized.replace(/^www\./, '').toLowerCase().trim();
    
    if (!normalized.includes('.') || normalized.length < 3) {
      return null;
    }
    
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Extract domain from email
 */
function extractDomainFromEmail(email) {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return normalizeDomain(parts[1]);
}

/**
 * Check if two domains match
 */
function domainsMatch(domain1, domain2) {
  const norm1 = normalizeDomain(domain1);
  const norm2 = normalizeDomain(domain2);
  
  if (!norm1 || !norm2) return false;
  
  if (norm1 === norm2) return true;
  
  if (norm1.endsWith(`.${norm2}`) || norm2.endsWith(`.${norm1}`)) {
    return true;
  }
  
  return false;
}

async function importSalesforceContacts() {
  console.log('🚀 Starting massive Salesforce contact import...\n');

  // Connect to database
  console.log('📊 Connecting to database...');
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  // Fetch all accounts from database
  console.log('📋 Fetching all accounts from database...');
  const allAccounts = await db.select().from(accounts);
  console.log(`✅ Found ${allAccounts.length} accounts in database\n`);

  // Build lookup maps
  const accountsByName = new Map();
  const accountsByDomain = new Map();
  const accountsBySfdcId = new Map();
  
  for (const account of allAccounts) {
    if (account.name) {
      accountsByName.set(account.name.toLowerCase().trim(), account.id);
    }
    if (account.domain) {
      const normalized = normalizeDomain(account.domain);
      if (normalized) {
        accountsByDomain.set(normalized, account.id);
      }
    }
    if (account.sfdcAccountId) {
      accountsBySfdcId.set(account.sfdcAccountId, account.id);
    }
  }

  // Fetch contacts from Salesforce
  console.log('🔗 Fetching contacts from Salesforce...');
  let sfContacts = [];
  try {
    const result = await salesforce.fetchContacts();
    sfContacts = result;
    console.log(`✅ Fetched ${sfContacts.length} contacts from Salesforce\n`);
  } catch (error) {
    console.error('❌ Failed to fetch contacts from Salesforce:', error.message);
    await connection.end();
    return;
  }

  // Get existing contacts to avoid duplicates
  console.log('📊 Fetching existing contacts from database...');
  const existingContacts = await db.select({ sfdcContactId: contacts.sfdcContactId }).from(contacts);
  const existingSfdcIds = new Set(existingContacts.map(c => c.sfdcContactId));
  console.log(`✅ Found ${existingContacts.length} existing contacts\n`);

  // Import contacts
  console.log('📥 Importing contacts from Salesforce...');
  let inserted = 0;
  let updated = 0;
  let linked = 0;
  let skipped = 0;
  let errors = 0;

  const linkReasons = {
    sfdc: 0,
    company: 0,
    emailDomain: 0,
    unlinked: 0,
  };

  for (let i = 0; i < sfContacts.length; i++) {
    const sfContact = sfContacts[i];

    try {
      // Transform contact
      const contact = salesforce.transformContact(sfContact);

      // Check if already exists
      if (existingSfdcIds.has(contact.sfdcContactId)) {
        // Update existing
        await db.update(contacts)
          .set({
            name: contact.name,
            email: contact.email,
            title: contact.title,
            phone: contact.phone,
            linkedinUrl: contact.linkedinUrl,
            location: contact.location,
            updatedAt: new Date(),
          })
          .where(eq(contacts.sfdcContactId, contact.sfdcContactId));
        updated++;
      } else {
        // Find account ID
        let accountId = null;
        let reason = 'unlinked';

        // Strategy 1: Match by Salesforce Account ID
        if (contact.sfdcAccountId && accountsBySfdcId.has(contact.sfdcAccountId)) {
          accountId = accountsBySfdcId.get(contact.sfdcAccountId);
          reason = 'sfdc';
        }

        // Strategy 2: Match by email domain
        if (!accountId && contact.email) {
          const emailDomain = extractDomainFromEmail(contact.email);
          if (emailDomain) {
            if (accountsByDomain.has(emailDomain)) {
              accountId = accountsByDomain.get(emailDomain);
              reason = 'emailDomain';
            } else {
              for (const [accDomain, accId] of accountsByDomain.entries()) {
                if (domainsMatch(emailDomain, accDomain)) {
                  accountId = accId;
                  reason = 'emailDomain';
                  break;
                }
              }
            }
          }
        }

        // Insert new contact
        await db.insert(contacts).values({
          name: contact.name,
          email: contact.email,
          title: contact.title,
          phone: contact.phone,
          sfdcContactId: contact.sfdcContactId,
          linkedinUrl: contact.linkedinUrl,
          location: contact.location,
          accountId: accountId || null,
        });

        inserted++;
        if (accountId) {
          linked++;
          linkReasons[reason]++;
        } else {
          linkReasons.unlinked++;
        }
      }

      // Progress indicator
      if ((i + 1) % 500 === 0) {
        console.log(`  ✓ Processed ${i + 1}/${sfContacts.length} contacts...`);
      }
    } catch (error) {
      console.error(`❌ Error importing contact ${sfContact.Name}:`, error.message);
      errors++;
    }
  }

  console.log('\n✅ Import complete!');
  console.log(`\n📊 Results:`);
  console.log(`   New contacts inserted: ${inserted}`);
  console.log(`   Existing contacts updated: ${updated}`);
  console.log(`   Total linked to accounts: ${linked}`);
  console.log(`   Unlinked contacts: ${linkReasons.unlinked}`);
  console.log(`   Errors: ${errors}`);
  console.log(`\n🔗 Link breakdown:`);
  console.log(`   - By Salesforce ID: ${linkReasons.sfdc}`);
  console.log(`   - By email domain: ${linkReasons.emailDomain}`);
  console.log(`   - Unlinked: ${linkReasons.unlinked}`);

  await connection.end();
}

importSalesforceContacts().catch(console.error);
