import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { accounts, contacts } from '../../drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Domain Matching Utilities
 */
function extractDomainFromEmail(email: string | null): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return null;
  return parts[1];
}

function extractDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const cleaned = url.toLowerCase().trim();
    const withProtocol = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    const urlObj = new URL(withProtocol);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    const match = url.toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z0-9.-]+)/i);
    return match ? match[1] : null;
  }
}

function normalizeDomain(domain: string | null): string | null {
  if (!domain) return null;
  return domain.toLowerCase().trim().replace(/^www\./, '');
}

function getKnownCompanyVariations(companyName: string): string[] {
  const name = companyName.toLowerCase();
  const variations: string[] = [];
  
  // UKG / Ultimate Software / Kronos
  if (name.includes('ultimate') || name.includes('ukg') || name.includes('kronos')) {
    variations.push('ultimatesoftware.com', 'ukg.com', 'kronos.com');
  }
  
  // Stryker
  if (name.includes('stryker')) {
    variations.push('stryker.com', 'stryker.co.uk', 'stryker.eu');
  }
  
  // HSBC
  if (name.includes('hsbc')) {
    variations.push('hsbc.com', 'hsbc.co.uk', 'hsbc.com.hk');
  }
  
  // Databricks
  if (name.includes('databricks')) {
    variations.push('databricks.com');
  }
  
  // JPMorgan Chase
  if (name.includes('jpmorgan') || name.includes('chase')) {
    variations.push('jpmorganchase.com', 'chase.com', 'jpmorgan.com');
  }
  
  // Bank of America
  if (name.includes('bank of america') || name.includes('bofa')) {
    variations.push('bankofamerica.com', 'bofa.com', 'baml.com');
  }
  
  // Wells Fargo
  if (name.includes('wells fargo')) {
    variations.push('wellsfargo.com', 'wf.com');
  }
  
  // Citigroup / Citibank
  if (name.includes('citi')) {
    variations.push('citigroup.com', 'citi.com', 'citibank.com');
  }
  
  // Goldman Sachs
  if (name.includes('goldman')) {
    variations.push('gs.com', 'goldmansachs.com');
  }
  
  // Morgan Stanley
  if (name.includes('morgan stanley')) {
    variations.push('morganstanley.com', 'ms.com');
  }
  
  // Salesforce
  if (name.includes('salesforce')) {
    variations.push('salesforce.com', 'force.com');
  }
  
  // Oracle
  if (name.includes('oracle')) {
    variations.push('oracle.com');
  }
  
  // SAP
  if (name.includes('sap')) {
    variations.push('sap.com');
  }
  
  // Workday
  if (name.includes('workday')) {
    variations.push('workday.com');
  }
  
  // ServiceNow
  if (name.includes('servicenow')) {
    variations.push('servicenow.com');
  }
  
  // Microsoft
  if (name.includes('microsoft')) {
    variations.push('microsoft.com', 'live.com', 'outlook.com');
  }
  
  // Google
  if (name.includes('google')) {
    variations.push('google.com', 'alphabet.com');
  }
  
  // Amazon
  if (name.includes('amazon')) {
    variations.push('amazon.com', 'aws.amazon.com');
  }
  
  return variations;
}

function generateDomainVariations(primaryDomain: string | null, website: string | null, name: string | null): string[] {
  const variations = new Set<string>();
  
  // Add primary domain
  if (primaryDomain) {
    const normalized = normalizeDomain(primaryDomain);
    if (normalized) variations.add(normalized);
  }
  
  // Extract from website
  if (website) {
    const extracted = extractDomainFromUrl(website);
    if (extracted) variations.add(extracted);
  }
  
  // Generate from company name
  if (name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
    
    if (slug && slug.length > 2) {
      variations.add(`${slug}.com`);
    }
    
    // Handle known company variations
    const knownVariations = getKnownCompanyVariations(name);
    knownVariations.forEach(v => variations.add(v));
  }
  
  return Array.from(variations).filter(Boolean);
}

/**
 * Main script
 */
async function main() {
  console.log('\n=== Fixing Contact-Account Domain Mapping ===\n');
  
  // Create database connection
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(connection);
  
  // Step 1: Populate domain variations for all accounts
  console.log('Step 1: Populating domain variations for accounts...\n');
  
  const allAccounts = await db.select().from(accounts);
  console.log(`Found ${allAccounts.length} accounts\n`);
  
  let accountsUpdated = 0;
  
  for (const account of allAccounts) {
    const variations = generateDomainVariations(
      account.domain,
      account.website,
      account.name
    );
    
    if (variations.length > 0) {
      await db
        .update(accounts)
        .set({ domainVariations: variations as any })
        .where(eq(accounts.id, account.id));
      
      accountsUpdated++;
      
      if (accountsUpdated <= 10) {
        console.log(`✓ Account ${account.id}: ${account.name}`);
        console.log(`  Domain: ${account.domain || 'N/A'}`);
        console.log(`  Variations: ${variations.join(', ')}`);
        console.log('');
      }
    }
  }
  
  console.log(`Updated ${accountsUpdated} accounts with domain variations\n`);
  
  // Step 2: Fix contact-account mappings
  console.log('Step 2: Fixing contact-account mappings...\n');
  
  const allContacts = await db.select().from(contacts);
  console.log(`Found ${allContacts.length} contacts\n`);
  
  // Reload accounts with domain variations
  const accountsWithDomains = await db.select().from(accounts);
  
  let contactsFixed = 0;
  let contactsSkipped = 0;
  
  for (const contact of allContacts) {
    if (!contact.email) {
      contactsSkipped++;
      continue;
    }
    
    const emailDomain = extractDomainFromEmail(contact.email);
    if (!emailDomain) {
      contactsSkipped++;
      continue;
    }
    
    // Find matching account
    let matchedAccountId: number | null = null;
    
    // First pass: exact domain match
    for (const account of accountsWithDomains) {
      if (account.domain && normalizeDomain(emailDomain) === normalizeDomain(account.domain)) {
        matchedAccountId = account.id;
        break;
      }
    }
    
    // Second pass: domain variations match
    if (!matchedAccountId) {
      for (const account of accountsWithDomains) {
        if (account.domainVariations && Array.isArray(account.domainVariations)) {
          const normalizedEmail = normalizeDomain(emailDomain);
          const found = (account.domainVariations as string[]).some(
            variation => normalizeDomain(variation) === normalizedEmail
          );
          if (found) {
            matchedAccountId = account.id;
            break;
          }
        }
      }
    }
    
    // Update contact if we found a match and it's different from current
    if (matchedAccountId && matchedAccountId !== contact.accountId) {
      await db
        .update(contacts)
        .set({ accountId: matchedAccountId })
        .where(eq(contacts.id, contact.id));
      
      contactsFixed++;
      
      if (contactsFixed <= 10) {
        const matchedAccount = accountsWithDomains.find(a => a.id === matchedAccountId);
        console.log(`✓ Fixed contact ${contact.id}: ${contact.email}`);
        console.log(`  Old accountId: ${contact.accountId} → New accountId: ${matchedAccountId} (${matchedAccount?.name})`);
        console.log('');
      }
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Accounts updated with domain variations: ${accountsUpdated}`);
  console.log(`Contacts fixed: ${contactsFixed}`);
  console.log(`Contacts skipped (no email): ${contactsSkipped}`);
  console.log(`Contacts already correct: ${allContacts.length - contactsFixed - contactsSkipped}`);
  
  await connection.end();
}

main().catch(console.error);
