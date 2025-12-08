import Database from 'better-sqlite3';

const db = new Database('local.db');

// Check contacts without valid accountId
const orphanedContacts = db.prepare(`
  SELECT c.id, c.name, c.email, c.accountId, a.name as accountName
  FROM contacts c
  LEFT JOIN accounts a ON c.accountId = a.id
  WHERE a.id IS NULL
  LIMIT 10
`).all();

console.log('\n=== Orphaned Contacts (no matching account) ===');
console.log(`Total: ${orphanedContacts.length}`);
orphanedContacts.forEach(c => {
  console.log(`Contact ${c.id}: ${c.name} (${c.email}) -> accountId ${c.accountId} NOT FOUND`);
});

// Check accounts and their contact counts
const accountStats = db.prepare(`
  SELECT a.id, a.name, a.domain, COUNT(c.id) as contactCount
  FROM accounts a
  LEFT JOIN contacts c ON c.accountId = a.id
  GROUP BY a.id
  ORDER BY contactCount DESC
  LIMIT 20
`).all();

console.log('\n=== Top 20 Accounts by Contact Count ===');
accountStats.forEach(a => {
  console.log(`Account ${a.id}: ${a.name} (${a.domain}) - ${a.contactCount} contacts`);
});

// Check for email domain mismatches
const emailDomains = db.prepare(`
  SELECT c.id, c.name, c.email, c.accountId, a.name as accountName, a.domain
  FROM contacts c
  JOIN accounts a ON c.accountId = a.id
  WHERE c.email IS NOT NULL
  LIMIT 20
`).all();

console.log('\n=== Sample Contact Email vs Account Domain ===');
emailDomains.forEach(c => {
  const emailDomain = c.email ? c.email.split('@')[1] : 'NO EMAIL';
  const match = emailDomain === c.domain ? '✓' : '✗';
  console.log(`${match} Contact: ${c.email} -> Account: ${c.accountName} (${c.domain})`);
});

db.close();
