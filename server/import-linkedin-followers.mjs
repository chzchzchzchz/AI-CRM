import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, like, or, sql } from 'drizzle-orm';
import fs from 'fs';

// Read contacts from JSON
const contacts = JSON.parse(fs.readFileSync('/home/ubuntu/linkedin-followers-contacts.json', 'utf8'));

// Filter out the bad "all" contact
const validContacts = contacts.filter(c => c.name !== 'all' && c.name.length > 2);

console.log(`Processing ${validContacts.length} valid contacts...`);

// Connect to database
const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Get all accounts for matching
const [accounts] = await connection.execute('SELECT id, name, domain FROM accounts');
console.log(`Loaded ${accounts.length} accounts for matching`);

// Create a map of company names to account IDs
const companyMap = new Map();
for (const account of accounts) {
  // Add variations of company name
  const name = account.name.toLowerCase();
  companyMap.set(name, account.id);
  
  // Also add without common suffixes
  const cleanName = name.replace(/\s*(inc\.?|corp\.?|corporation|llc|ltd\.?|limited|co\.?)$/i, '').trim();
  companyMap.set(cleanName, account.id);
  
  // Add domain-based matching
  if (account.domain) {
    const domainName = account.domain.replace(/\.(com|io|co|net|org|ai)$/, '');
    companyMap.set(domainName.toLowerCase(), account.id);
  }
}

let matched = 0;
let unmatched = 0;
let created = 0;
let skipped = 0;

for (const contact of validContacts) {
  try {
    // Try to match company to account
    let accountId = null;
    
    if (contact.company) {
      const companyLower = contact.company.toLowerCase().trim();
      
      // Direct match
      if (companyMap.has(companyLower)) {
        accountId = companyMap.get(companyLower);
      } else {
        // Try without suffixes
        const cleanCompany = companyLower.replace(/\s*(inc\.?|corp\.?|corporation|llc|ltd\.?|limited|co\.?)$/i, '').trim();
        if (companyMap.has(cleanCompany)) {
          accountId = companyMap.get(cleanCompany);
        } else {
          // Try fuzzy match - look for accounts containing company name
          for (const [key, id] of companyMap) {
            if (key.includes(cleanCompany) || cleanCompany.includes(key)) {
              accountId = id;
              break;
            }
          }
        }
      }
    }
    
    if (accountId) {
      matched++;
    } else {
      unmatched++;
    }
    
    // Check if contact already exists
    const [existing] = await connection.execute(
      'SELECT id FROM contacts WHERE name = ? LIMIT 1',
      [contact.name]
    );
    
    if (existing.length > 0) {
      // Update existing contact with LinkedIn follower flag
      await connection.execute(
        `UPDATE contacts SET 
          followscompany = 1,
          source = COALESCE(source, 'linkedin_followers'),
          accountId = COALESCE(accountId, ?)
        WHERE id = ?`,
        [accountId, existing[0].id]
      );
      skipped++;
    } else {
      // Insert new contact
      await connection.execute(
        `INSERT INTO contacts (name, title, accountId, location, source, followscompany, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'linkedin_followers', 1, NOW(), NOW())`,
        [contact.name, contact.title || null, accountId, contact.location || null]
      );
      created++;
    }
  } catch (err) {
    console.error(`Error processing ${contact.name}:`, err.message);
  }
}

console.log(`\n=== Import Results ===`);
console.log(`Total contacts: ${validContacts.length}`);
console.log(`Matched to accounts: ${matched}`);
console.log(`Unmatched (no account): ${unmatched}`);
console.log(`New contacts created: ${created}`);
console.log(`Existing contacts updated: ${skipped}`);

// Show some unmatched companies
const unmatchedCompanies = [...new Set(validContacts.filter(c => c.company && !companyMap.has(c.company.toLowerCase())).map(c => c.company))];
console.log(`\nUnmatched companies (sample): ${unmatchedCompanies.slice(0, 20).join(', ')}`);

await connection.end();
