import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';

const accounts = JSON.parse(readFileSync('./scripts/parsed_accounts.json', 'utf-8'));
const contacts = JSON.parse(readFileSync('./scripts/parsed_contacts.json', 'utf-8'));

console.log(`Loaded ${accounts.length} accounts and ${contacts.length} contacts`);

const conn = await createConnection(process.env.DATABASE_URL);

// Get existing accounts for domain matching
const [existingAccounts] = await conn.execute('SELECT id, name, domain FROM accounts');
const accountByDomain = new Map();
const accountByName = new Map();
existingAccounts.forEach(a => {
  if (a.domain) accountByDomain.set(a.domain.toLowerCase(), a);
  if (a.name) accountByName.set(a.name.toLowerCase(), a);
});

console.log(`Found ${existingAccounts.length} existing accounts in database`);

// Parse employee count from range
function parseEmployeeCount(range) {
  if (!range) return null;
  const match = range.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Parse buying stage to intent score
function buyingStageToIntent(stage) {
  const stages = {
    'Purchase': 95,
    'Decision': 85,
    'Consideration': 70,
    'Awareness': 50,
    'Target': 30
  };
  return stages[stage] || 50;
}

// Update existing accounts with new data
let accountsUpdated = 0;
let accountsCreated = 0;

for (const acc of accounts) {
  const domain = acc.domain?.toLowerCase();
  const name = acc.name?.toLowerCase();
  
  // Try to find existing account
  let existing = accountByDomain.get(domain) || accountByName.get(name);
  
  if (existing) {
    // Update existing account with enrichment data
    await conn.execute(`
      UPDATE accounts SET
        industry = COALESCE(NULLIF(?, ''), industry),
        employeeCount = COALESCE(?, employeeCount),
        intentScore = COALESCE(?, intentScore),
        techStack = COALESCE(NULLIF(?, ''), techStack),
        description = COALESCE(NULLIF(?, ''), description)
      WHERE id = ?
    `, [
      acc.industry || null,
      parseEmployeeCount(acc.employee_count || acc.employee_range),
      buyingStageToIntent(acc.buying_stage),
      [acc.sso_vendors, acc.mfa_vendors].filter(Boolean).join(', ') || null,
      acc.description || null,
      existing.id
    ]);
    accountsUpdated++;
  } else if (acc.domain) {
    // Create new account
    try {
      const [result] = await conn.execute(`
        INSERT INTO accounts (name, domain, industry, employeeCount, intentScore, techStack, description, region, website, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'Unknown', ?, NOW(), NOW())
      `, [
        acc.name,
        acc.domain,
        acc.industry || 'Unknown',
        parseEmployeeCount(acc.employee_count || acc.employee_range),
        buyingStageToIntent(acc.buying_stage),
        [acc.sso_vendors, acc.mfa_vendors].filter(Boolean).join(', ') || null,
        acc.description || null,
        `https://${acc.domain}`
      ]);
      
      // Add to maps for contact matching
      accountByDomain.set(acc.domain.toLowerCase(), { id: result.insertId, name: acc.name, domain: acc.domain });
      accountByName.set(acc.name.toLowerCase(), { id: result.insertId, name: acc.name, domain: acc.domain });
      accountsCreated++;
    } catch (e) {
      // Duplicate or other error, skip
    }
  }
}

console.log(`Accounts: ${accountsUpdated} updated, ${accountsCreated} created`);

// Import contacts
let contactsCreated = 0;
let contactsSkipped = 0;

for (const con of contacts) {
  // Find the account for this contact
  const companyDomain = con.domain?.toLowerCase();
  const companyName = con.company_name?.toLowerCase();
  
  let account = accountByDomain.get(companyDomain) || accountByName.get(companyName);
  
  if (!account) {
    contactsSkipped++;
    continue;
  }
  
  // Check if contact already exists
  const [existing] = await conn.execute(
    'SELECT id FROM contacts WHERE accountId = ? AND (email = ? OR (firstName = ? AND lastName = ?))',
    [account.id, `${con.first_name?.toLowerCase()}.${con.last_name?.toLowerCase()}@${con.domain || 'unknown.com'}`, con.first_name, con.last_name]
  );
  
  if (existing.length > 0) {
    contactsSkipped++;
    continue;
  }
  
  // Create contact
  try {
    await conn.execute(`
      INSERT INTO contacts (accountId, firstName, lastName, title, email, linkedin, intentScore, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, [
      account.id,
      con.first_name || con.full_name?.split(' ')[0] || '',
      con.last_name || con.full_name?.split(' ').slice(1).join(' ') || '',
      con.job_title || '',
      `${(con.first_name || '').toLowerCase()}.${(con.last_name || '').toLowerCase()}@${con.domain || 'unknown.com'}`,
      con.linkedin || null,
      parseInt(con.intent_score) || null
    ]);
    contactsCreated++;
  } catch (e) {
    // Duplicate or other error
    contactsSkipped++;
  }
}

console.log(`Contacts: ${contactsCreated} created, ${contactsSkipped} skipped`);

// Get final counts
const [finalCounts] = await conn.execute(`
  SELECT 
    (SELECT COUNT(*) FROM accounts) as accounts,
    (SELECT COUNT(*) FROM contacts) as contacts
`);
console.log(`\nFinal database counts: ${finalCounts[0].accounts} accounts, ${finalCounts[0].contacts} contacts`);

await conn.end();
