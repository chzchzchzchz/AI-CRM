import mysql from 'mysql2/promise';
import fs from 'fs';

// Load target lists
const targetCompanies = JSON.parse(fs.readFileSync('/home/ubuntu/target-companies.json', 'utf8'));
const targetContacts = JSON.parse(fs.readFileSync('/home/ubuntu/target-contacts.json', 'utf8'));

console.log(`Target companies: ${targetCompanies.length}`);
console.log(`Target contacts: ${targetContacts.length}`);

// Create normalized company name set for matching
const normalizedTargetCompanies = new Set();
for (const company of targetCompanies) {
  normalizedTargetCompanies.add(company.toLowerCase().trim());
  // Also add without common suffixes
  const clean = company.toLowerCase().trim()
    .replace(/,?\s*(inc\.?|corp\.?|corporation|llc|ltd\.?|limited|co\.?|l\.p\.)$/i, '')
    .trim();
  normalizedTargetCompanies.add(clean);
}

// Create email set for contact matching
const targetEmails = new Set();
for (const contact of targetContacts) {
  if (contact.email) {
    targetEmails.add(contact.email.toLowerCase().trim());
  }
}

console.log(`Normalized target company names: ${normalizedTargetCompanies.size}`);
console.log(`Target emails: ${targetEmails.size}`);

// Connect to database
const connection = await mysql.createConnection(process.env.DATABASE_URL);

// Get all accounts
const [accounts] = await connection.execute('SELECT id, name, domain FROM accounts');
console.log(`\nCurrent accounts in DB: ${accounts.length}`);

// Find accounts to keep (match target companies)
const accountsToKeep = new Set();
const accountsToDelete = [];

for (const account of accounts) {
  const name = account.name.toLowerCase().trim();
  const cleanName = name.replace(/,?\s*(inc\.?|corp\.?|corporation|llc|ltd\.?|limited|co\.?|l\.p\.)$/i, '').trim();
  
  // Check if account matches any target company
  let isTarget = normalizedTargetCompanies.has(name) || normalizedTargetCompanies.has(cleanName);
  
  // Also check domain-based matching
  if (!isTarget && account.domain) {
    const domainName = account.domain.replace(/\.(com|io|co|net|org|ai)$/, '').toLowerCase();
    isTarget = normalizedTargetCompanies.has(domainName);
  }
  
  // Fuzzy match - check if any target company contains or is contained by account name
  if (!isTarget) {
    for (const target of normalizedTargetCompanies) {
      if (target.length > 3 && (cleanName.includes(target) || target.includes(cleanName))) {
        isTarget = true;
        break;
      }
    }
  }
  
  if (isTarget) {
    accountsToKeep.add(account.id);
  } else {
    accountsToDelete.push({ id: account.id, name: account.name });
  }
}

console.log(`Accounts to keep: ${accountsToKeep.size}`);
console.log(`Accounts to delete: ${accountsToDelete.length}`);

// Show sample of accounts to delete
console.log(`\nSample accounts to delete:`);
for (const acc of accountsToDelete.slice(0, 20)) {
  console.log(`  - ${acc.name}`);
}

// Get all contacts
const [contacts] = await connection.execute('SELECT id, email, accountId FROM contacts');
console.log(`\nCurrent contacts in DB: ${contacts.length}`);

// Find contacts to delete (not in target list AND not linked to target account)
let contactsToDelete = 0;
let contactsToKeep = 0;

for (const contact of contacts) {
  const email = (contact.email || '').toLowerCase().trim();
  const isTargetEmail = email && targetEmails.has(email);
  const isLinkedToTargetAccount = accountsToKeep.has(contact.accountId);
  
  if (isTargetEmail || isLinkedToTargetAccount) {
    contactsToKeep++;
  } else {
    contactsToDelete++;
  }
}

console.log(`Contacts to keep: ${contactsToKeep}`);
console.log(`Contacts to delete: ${contactsToDelete}`);

// Confirm before deleting
console.log(`\n=== CLEANUP PLAN ===`);
console.log(`Will delete ${accountsToDelete.length} accounts`);
console.log(`Will delete contacts linked to deleted accounts`);

// Delete contacts first (foreign key constraint)
if (accountsToDelete.length > 0) {
  const accountIdsToDelete = accountsToDelete.map(a => a.id);
  
  // Delete contacts linked to accounts being deleted
  const [deleteContactsResult] = await connection.execute(
    `DELETE FROM contacts WHERE accountId IN (${accountIdsToDelete.join(',')})`
  );
  console.log(`\nDeleted ${deleteContactsResult.affectedRows} contacts linked to non-target accounts`);
  
  // Delete accounts
  const [deleteAccountsResult] = await connection.execute(
    `DELETE FROM accounts WHERE id IN (${accountIdsToDelete.join(',')})`
  );
  console.log(`Deleted ${deleteAccountsResult.affectedRows} non-target accounts`);
}

// Also delete any remaining orphaned contacts (not linked to any account)
const [deleteOrphanedResult] = await connection.execute(
  `DELETE FROM contacts WHERE accountId NOT IN (SELECT id FROM accounts)`
);
console.log(`Deleted ${deleteOrphanedResult.affectedRows} orphaned contacts`);

// Final counts
const [finalAccounts] = await connection.execute('SELECT COUNT(*) as cnt FROM accounts');
const [finalContacts] = await connection.execute('SELECT COUNT(*) as cnt FROM contacts');

console.log(`\n=== FINAL COUNTS ===`);
console.log(`Accounts: ${finalAccounts[0].cnt}`);
console.log(`Contacts: ${finalContacts[0].cnt}`);

await connection.end();
