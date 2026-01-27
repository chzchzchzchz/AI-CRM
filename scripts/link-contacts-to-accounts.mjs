// Script to link contacts to accounts using Salesforce Account IDs
import { readFileSync } from 'fs';
import mysql from 'mysql2/promise';

async function main() {
  // Read the mapping
  const mapping = JSON.parse(readFileSync('/tmp/contact_account_mapping.json', 'utf-8'));
  console.log(`Loaded ${Object.keys(mapping).length} email-to-account mappings`);
  
  // Connect to database
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  
  // Get all contacts
  const [contacts] = await pool.query('SELECT id, email FROM contacts WHERE email IS NOT NULL');
  console.log(`Found ${contacts.length} contacts with emails`);
  
  // Get all accounts with sfdcAccountId
  const [accounts] = await pool.query('SELECT id, sfdcAccountId FROM accounts WHERE sfdcAccountId IS NOT NULL');
  console.log(`Found ${accounts.length} accounts with Salesforce IDs`);
  
  // Create a map of sfdcAccountId -> internal account id
  const sfdcToInternalId = {};
  accounts.forEach(acc => {
    sfdcToInternalId[acc.sfdcAccountId] = acc.id;
  });
  
  // Link contacts
  let linked = 0;
  let notFound = 0;
  let noMapping = 0;
  
  for (const contact of contacts) {
    const emailLower = contact.email.toLowerCase();
    const accountInfo = mapping[emailLower];
    
    if (!accountInfo) {
      noMapping++;
      continue;
    }
    
    const internalAccountId = sfdcToInternalId[accountInfo.sfdcAccountId];
    
    if (!internalAccountId) {
      notFound++;
      continue;
    }
    
    // Update the contact
    await pool.query(
      'UPDATE contacts SET accountId = ? WHERE id = ?',
      [internalAccountId, contact.id]
    );
    linked++;
    
    if (linked % 100 === 0) {
      console.log(`Linked ${linked} contacts...`);
    }
  }
  
  console.log(`\nResults:`);
  console.log(`  Linked: ${linked}`);
  console.log(`  No mapping in Salesforce: ${noMapping}`);
  console.log(`  Account not in database: ${notFound}`);
  
  // Verify
  const [result] = await pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN accountId IS NOT NULL THEN 1 ELSE 0 END) as linked,
      SUM(CASE WHEN accountId IS NULL THEN 1 ELSE 0 END) as unlinked
    FROM contacts
  `);
  console.log(`\nFinal state:`);
  console.log(`  Total contacts: ${result[0].total}`);
  console.log(`  Linked: ${result[0].linked}`);
  console.log(`  Unlinked: ${result[0].unlinked}`);
  
  await pool.end();
}

main().catch(console.error);
