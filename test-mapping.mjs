import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);

console.log('\n=== Testing Contact-Account Mapping ===\n');

// Test 1: Get account with contacts
const [account] = await connection.query(`
  SELECT a.id, a.name, a.domain, a.domainVariations,
         COUNT(c.id) as contactCount
  FROM accounts a
  LEFT JOIN contacts c ON c.accountId = a.id
  WHERE a.id = 60658
  GROUP BY a.id
`);
console.log('Test 1: Account 60658 (Ultimatesoftware)');
console.log(JSON.stringify(account[0], null, 2));

// Test 2: Get contacts for this account
const [accountContacts] = await connection.query(`
  SELECT id, name, email, accountId
  FROM contacts
  WHERE accountId = 60658
  LIMIT 5
`);
console.log('\nTest 2: Contacts for account 60658');
console.log(JSON.stringify(accountContacts, null, 2));

// Test 3: Verify email domains match
const [emailCheck] = await connection.query(`
  SELECT c.id, c.name, c.email, a.name as accountName, a.domain
  FROM contacts c
  JOIN accounts a ON c.accountId = a.id
  WHERE c.email IS NOT NULL
  LIMIT 10
`);
console.log('\nTest 3: Email domain verification (sample)');
emailCheck.forEach(row => {
  const emailDomain = row.email.split('@')[1];
  const match = emailDomain === row.domain ? '✓' : '✗';
  console.log(`${match} ${row.email} → ${row.accountName} (${row.domain})`);
});

// Test 4: Count total contacts with emails
const [stats] = await connection.query(`
  SELECT 
    COUNT(*) as totalContacts,
    COUNT(email) as contactsWithEmail,
    COUNT(DISTINCT accountId) as accountsWithContacts
  FROM contacts
`);
console.log('\nTest 4: Overall statistics');
console.log(JSON.stringify(stats[0], null, 2));

await connection.end();
