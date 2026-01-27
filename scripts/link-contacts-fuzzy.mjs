// Script to link contacts to accounts using fuzzy Account Name matching
import mysql from 'mysql2/promise';

const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL?.replace('.lightning.force.com', '.my.salesforce.com').replace(/\/$/, '');
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

// Normalize account name for matching
function normalizeAccountName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/,?\s*(inc\.?|llc|ltd|corp\.?|corporation|company|co\.?|group|holdings?|international|services?|solutions?|technologies?|tech|systems?)$/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function getAccessToken() {
  const tokenUrl = `${SALESFORCE_INSTANCE_URL}/services/oauth2/token`;
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await response.json();
  return { token: data.access_token, instanceUrl: data.instance_url || SALESFORCE_INSTANCE_URL };
}

async function getReport(reportId, token, instanceUrl) {
  const url = `${instanceUrl}/services/data/v59.0/analytics/reports/${reportId}?includeDetails=true`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

async function main() {
  console.log('Getting Salesforce access token...');
  const { token, instanceUrl } = await getAccessToken();
  console.log('Connected to:', instanceUrl);
  
  // Report ID for "Updated Ping Contacts 01/20/2026"
  const reportId = '00OUI00000GUCQj2AP';
  
  console.log(`\nFetching report ${reportId}...`);
  const reportData = await getReport(reportId, token, instanceUrl);
  
  const columns = reportData.reportMetadata?.detailColumns || [];
  const rows = reportData.factMap?.['T!T']?.rows || [];
  
  console.log(`Total rows: ${rows.length}`);
  
  // Find column indices
  const emailColIndex = columns.findIndex(col => col === 'EMAIL');
  const accountNameColIndex = columns.findIndex(col => col === 'ACCOUNT.NAME');
  
  // Extract email to account name mapping
  const emailToAccountName = {};
  rows.forEach(row => {
    const emailCell = row.dataCells[emailColIndex];
    const accountNameCell = row.dataCells[accountNameColIndex];
    
    const email = emailCell?.label || emailCell?.value;
    const accountName = accountNameCell?.label || accountNameCell?.value;
    
    if (email && accountName && accountName !== '-') {
      emailToAccountName[email.toLowerCase()] = accountName;
    }
  });
  
  console.log(`Extracted ${Object.keys(emailToAccountName).length} email-to-account-name mappings`);
  
  // Connect to database
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  
  // Get all accounts
  const [accounts] = await pool.query('SELECT id, name FROM accounts');
  console.log(`Found ${accounts.length} accounts in database`);
  
  // Create maps for exact and normalized matching
  const exactNameToId = {};
  const normalizedNameToId = {};
  const normalizedToOriginal = {};
  
  accounts.forEach(acc => {
    exactNameToId[acc.name.toLowerCase()] = acc.id;
    const normalized = normalizeAccountName(acc.name);
    if (normalized) {
      normalizedNameToId[normalized] = acc.id;
      normalizedToOriginal[normalized] = acc.name;
    }
  });
  
  // Get all contacts
  const [contacts] = await pool.query('SELECT id, email FROM contacts WHERE email IS NOT NULL AND accountId IS NULL');
  console.log(`Found ${contacts.length} unlinked contacts`);
  
  // Link contacts
  let linkedExact = 0;
  let linkedFuzzy = 0;
  let noMapping = 0;
  let accountNotFound = 0;
  const notFoundAccounts = new Set();
  
  for (const contact of contacts) {
    const emailLower = contact.email.toLowerCase();
    const accountName = emailToAccountName[emailLower];
    
    if (!accountName) {
      noMapping++;
      continue;
    }
    
    // Try exact match first
    let accountId = exactNameToId[accountName.toLowerCase()];
    let matchType = 'exact';
    
    // Try normalized match
    if (!accountId) {
      const normalized = normalizeAccountName(accountName);
      accountId = normalizedNameToId[normalized];
      matchType = 'fuzzy';
    }
    
    if (!accountId) {
      accountNotFound++;
      notFoundAccounts.add(accountName);
      continue;
    }
    
    // Update the contact
    await pool.query(
      'UPDATE contacts SET accountId = ? WHERE id = ?',
      [accountId, contact.id]
    );
    
    if (matchType === 'exact') linkedExact++;
    else linkedFuzzy++;
    
    const total = linkedExact + linkedFuzzy;
    if (total % 100 === 0) {
      console.log(`Linked ${total} contacts (${linkedExact} exact, ${linkedFuzzy} fuzzy)...`);
    }
  }
  
  console.log(`\nResults:`);
  console.log(`  Linked (exact): ${linkedExact}`);
  console.log(`  Linked (fuzzy): ${linkedFuzzy}`);
  console.log(`  No mapping in report: ${noMapping}`);
  console.log(`  Account not in database: ${accountNotFound}`);
  
  console.log(`\nAccounts not found (${notFoundAccounts.size} unique):`);
  [...notFoundAccounts].slice(0, 30).forEach(name => {
    console.log(`  - ${name}`);
  });
  
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
