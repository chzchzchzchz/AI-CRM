// Script to import accounts that contacts belong to from Salesforce
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
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return response.json();
}

async function query(soql, token, instanceUrl) {
  const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = await response.json();
  if (data.errorCode || (Array.isArray(data) && data[0]?.errorCode)) {
    console.log('Query error:', JSON.stringify(data));
    return { records: [] };
  }
  return data;
}

async function main() {
  console.log('Getting Salesforce access token...');
  const { token, instanceUrl } = await getAccessToken();
  console.log('Connected to:', instanceUrl);
  
  // Step 1: Get unique account names from contacts report
  console.log('\nStep 1: Fetching contacts report...');
  const reportData = await getReport('00OUI00000GUCQj2AP', token, instanceUrl);
  const columns = reportData.reportMetadata?.detailColumns || [];
  const rows = reportData.factMap?.['T!T']?.rows || [];
  
  const accountNameColIndex = columns.findIndex(col => col === 'ACCOUNT.NAME');
  const emailColIndex = columns.findIndex(col => col === 'EMAIL');
  
  const uniqueAccountNames = new Set();
  const emailToAccountName = {};
  
  rows.forEach(row => {
    const accountName = row.dataCells[accountNameColIndex]?.label || row.dataCells[accountNameColIndex]?.value;
    const email = row.dataCells[emailColIndex]?.label || row.dataCells[emailColIndex]?.value;
    if (accountName && accountName !== '-') {
      uniqueAccountNames.add(accountName);
      if (email) emailToAccountName[email.toLowerCase()] = accountName;
    }
  });
  
  console.log(`Found ${uniqueAccountNames.size} unique account names from ${rows.length} contacts`);
  
  // Step 2: Query Salesforce for these accounts (basic fields only)
  console.log('\nStep 2: Fetching account details from Salesforce...');
  
  const accountNames = [...uniqueAccountNames];
  const allAccounts = [];
  const batchSize = 20;
  
  for (let i = 0; i < accountNames.length; i += batchSize) {
    const batch = accountNames.slice(i, i + batchSize);
    // Escape single quotes for SOQL (single quote becomes two single quotes)
    const escapedNames = batch.map(n => n.replace(/'/g, "''")).join("','");
    
    // Use only standard fields that exist on Account
    const soql = `SELECT Id, Name, Website, Industry, NumberOfEmployees, BillingCity, BillingState, BillingCountry, Description, Type, Phone FROM Account WHERE Name IN ('${escapedNames}')`;
    
    const result = await query(soql, token, instanceUrl);
    if (result.records && result.records.length > 0) {
      allAccounts.push(...result.records);
    }
    
    if ((i + batchSize) % 100 === 0 || i + batchSize >= accountNames.length) {
      console.log(`  Fetched ${allAccounts.length} accounts so far (processed ${Math.min(i + batchSize, accountNames.length)}/${accountNames.length} names)...`);
    }
  }
  
  console.log(`Total accounts fetched: ${allAccounts.length}`);
  
  // Step 3: Update database
  console.log('\nStep 3: Updating database...');
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  
  // Clear existing accounts
  await pool.query('DELETE FROM accounts');
  console.log('Cleared existing accounts');
  
  // Insert new accounts
  let inserted = 0;
  const accountNameToId = {};
  
  for (const acc of allAccounts) {
    const domain = acc.Website ? 
      acc.Website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : null;
    
    const [result] = await pool.query(`
      INSERT INTO accounts (name, domain, industry, employeeCount, region, website, sfdcAccountId)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      acc.Name,
      domain,
      acc.Industry || null,
      acc.NumberOfEmployees || null,
      acc.BillingCountry || 'Unknown',
      acc.Website || null,
      acc.Id
    ]);
    
    accountNameToId[acc.Name.toLowerCase()] = result.insertId;
    inserted++;
  }
  
  console.log(`Inserted ${inserted} accounts`);
  
  // Step 4: Link all contacts to accounts
  console.log('\nStep 4: Linking contacts to accounts...');
  
  // Reset all contact links first
  await pool.query('UPDATE contacts SET accountId = NULL');
  
  const [contacts] = await pool.query('SELECT id, email FROM contacts WHERE email IS NOT NULL');
  let linked = 0;
  
  for (const contact of contacts) {
    const accountName = emailToAccountName[contact.email.toLowerCase()];
    if (!accountName) continue;
    
    const accountId = accountNameToId[accountName.toLowerCase()];
    if (!accountId) continue;
    
    await pool.query('UPDATE contacts SET accountId = ? WHERE id = ?', [accountId, contact.id]);
    linked++;
  }
  
  console.log(`Linked ${linked} contacts to accounts`);
  
  // Verify
  const [result] = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM accounts) as totalAccounts,
      (SELECT COUNT(*) FROM contacts) as totalContacts,
      (SELECT COUNT(*) FROM contacts WHERE accountId IS NOT NULL) as linkedContacts
  `);
  
  console.log('\n=== FINAL RESULTS ===');
  console.log(`Accounts: ${result[0].totalAccounts}`);
  console.log(`Contacts: ${result[0].totalContacts}`);
  console.log(`Linked: ${result[0].linkedContacts} (${Math.round(result[0].linkedContacts/result[0].totalContacts*100)}%)`);
  
  await pool.end();
}

main().catch(console.error);
