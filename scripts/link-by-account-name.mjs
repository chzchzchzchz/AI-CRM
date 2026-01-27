// Script to link contacts to accounts using Account Name from Salesforce report
import mysql from 'mysql2/promise';

const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL?.replace('.lightning.force.com', '.my.salesforce.com').replace(/\/$/, '');
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

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
  const columnInfo = reportData.reportExtendedMetadata?.detailColumnInfo || {};
  const rows = reportData.factMap?.['T!T']?.rows || [];
  
  console.log(`Total rows: ${rows.length}`);
  
  // Find column indices
  const emailColIndex = columns.findIndex(col => col === 'EMAIL');
  const accountNameColIndex = columns.findIndex(col => col === 'ACCOUNT.NAME');
  
  console.log(`Email column index: ${emailColIndex}`);
  console.log(`Account Name column index: ${accountNameColIndex}`);
  
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
  
  // Create a map of account name -> internal id (case-insensitive)
  const accountNameToId = {};
  accounts.forEach(acc => {
    accountNameToId[acc.name.toLowerCase()] = acc.id;
  });
  
  // Get all contacts
  const [contacts] = await pool.query('SELECT id, email FROM contacts WHERE email IS NOT NULL');
  console.log(`Found ${contacts.length} contacts in database`);
  
  // Link contacts
  let linked = 0;
  let alreadyLinked = 0;
  let noMapping = 0;
  let accountNotFound = 0;
  
  for (const contact of contacts) {
    const emailLower = contact.email.toLowerCase();
    const accountName = emailToAccountName[emailLower];
    
    if (!accountName) {
      noMapping++;
      continue;
    }
    
    const accountId = accountNameToId[accountName.toLowerCase()];
    
    if (!accountId) {
      accountNotFound++;
      // Log first few not found
      if (accountNotFound <= 10) {
        console.log(`  Account not found: "${accountName}"`);
      }
      continue;
    }
    
    // Update the contact
    await pool.query(
      'UPDATE contacts SET accountId = ? WHERE id = ?',
      [accountId, contact.id]
    );
    linked++;
    
    if (linked % 100 === 0) {
      console.log(`Linked ${linked} contacts...`);
    }
  }
  
  console.log(`\nResults:`);
  console.log(`  Linked: ${linked}`);
  console.log(`  No mapping in report: ${noMapping}`);
  console.log(`  Account not in database: ${accountNotFound}`);
  
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
