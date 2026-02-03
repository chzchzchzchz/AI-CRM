import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, contacts } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

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
 * Check if two domains match (including subdomain matching)
 */
function domainsMatch(domain1, domain2) {
  const norm1 = normalizeDomain(domain1);
  const norm2 = normalizeDomain(domain2);
  
  if (!norm1 || !norm2) return false;
  
  if (norm1 === norm2) return true;
  
  // Check subdomain matching
  if (norm1.endsWith(`.${norm2}`) || norm2.endsWith(`.${norm1}`)) {
    return true;
  }
  
  return false;
}

async function linkContactsToAccounts() {
  console.log('🔗 Linking contacts to accounts with improved domain matching...');
  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  console.log('📊 Fetching all accounts...');
  const allAccounts = await db.select().from(accounts);
  console.log(`✅ Found ${allAccounts.length} accounts`);

  console.log('📋 Fetching all contacts...');
  const allContacts = await db.select().from(contacts);
  console.log(`✅ Found ${allContacts.length} contacts`);

  // Build comprehensive account lookup maps
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

  console.log('🔄 Linking contacts to accounts...');
  let linked = 0;
  let notLinked = 0;
  const linkReasons = {
    sfdc: 0,
    company: 0,
    emailDomain: 0,
  };

  for (const contact of allContacts) {
    if (contact.accountId) {
      // Already linked
      continue;
    }

    let accountId = null;
    let reason = null;

    // Strategy 1: Match by Salesforce Account ID
    if (contact.sfdcAccountId && accountsBySfdcId.has(contact.sfdcAccountId)) {
      accountId = accountsBySfdcId.get(contact.sfdcAccountId);
      reason = 'sfdc';
    }

    // Strategy 2: Match by company name
    if (!accountId && contact.company) {
      const companyKey = contact.company.toLowerCase().trim();
      if (accountsByName.has(companyKey)) {
        accountId = accountsByName.get(companyKey);
        reason = 'company';
      }
    }

    // Strategy 3: Match by email domain
    if (!accountId && contact.email) {
      const emailDomain = extractDomainFromEmail(contact.email);
      if (emailDomain) {
        // Try exact match first
        if (accountsByDomain.has(emailDomain)) {
          accountId = accountsByDomain.get(emailDomain);
          reason = 'emailDomain';
        } else {
          // Try subdomain matching
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

    if (accountId) {
      await db.update(contacts)
        .set({ accountId })
        .where(eq(contacts.id, contact.id));
      linked++;
      linkReasons[reason]++;
      
      if (linked % 100 === 0) {
        console.log(`  ✓ Linked ${linked} contacts...`);
      }
    } else {
      notLinked++;
    }
  }

  console.log('\n✅ Linking complete!');
  console.log(`   Total linked: ${linked} contacts`);
  console.log(`   Not linked: ${notLinked} contacts`);
  console.log(`\n📊 Link breakdown:`);
  console.log(`   - By Salesforce ID: ${linkReasons.sfdc}`);
  console.log(`   - By company name: ${linkReasons.company}`);
  console.log(`   - By email domain: ${linkReasons.emailDomain}`);

  await connection.end();
}

linkContactsToAccounts().catch(console.error);
