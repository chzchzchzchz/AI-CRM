// Script to fetch missing accounts and link remaining contacts
import mysql from 'mysql2/promise';

const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL?.replace('.lightning.force.com', '.my.salesforce.com').replace(/\/$/, '');
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

async function main() {
  // Get token
  const tokenUrl = SALESFORCE_INSTANCE_URL + '/services/oauth2/token';
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
  });
  const tokenResp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const tokenData = await tokenResp.json();
  const token = tokenData.access_token;
  const instanceUrl = tokenData.instance_url || SALESFORCE_INSTANCE_URL;
  console.log('Connected to:', instanceUrl);
  
  // Get report to find account names
  const reportUrl = instanceUrl + '/services/data/v59.0/analytics/reports/00OUI00000GUCQj2AP?includeDetails=true';
  const reportResp = await fetch(reportUrl, {
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
  });
  const reportData = await reportResp.json();
  const columns = reportData.reportMetadata?.detailColumns || [];
  const rows = reportData.factMap?.['T!T']?.rows || [];
  const accountNameColIndex = columns.findIndex(col => col === 'ACCOUNT.NAME');
  const emailColIndex = columns.findIndex(col => col === 'EMAIL');
  
  const emailToAccountName = {};
  const uniqueAccountNames = new Set();
  rows.forEach(row => {
    const accountName = row.dataCells[accountNameColIndex]?.label;
    const email = row.dataCells[emailColIndex]?.label;
    if (accountName && accountName !== '-') {
      uniqueAccountNames.add(accountName);
      if (email) emailToAccountName[email.toLowerCase()] = accountName;
    }
  });
  
  console.log('Unique account names from report:', uniqueAccountNames.size);
  
  // Connect to DB and find missing accounts
  const pool = await mysql.createPool(process.env.DATABASE_URL);
  const [existingAccounts] = await pool.query('SELECT name FROM accounts');
  const existingNames = new Set(existingAccounts.map(a => a.name.toLowerCase()));
  
  const allNames = [...uniqueAccountNames];
  const missingNames = allNames.filter(n => {
    const exists = existingNames.has(n.toLowerCase());
    return !exists;
  });
  
  console.log('Missing accounts:', missingNames.length);
  console.log('Sample missing:', missingNames.slice(0, 10));
  
  // Fetch missing accounts one by one
  let fetched = 0;
  for (const name of missingNames) {
    const escapedName = name.replace(/'/g, "''");
    const soql = `SELECT Id, Name, Website, Industry, NumberOfEmployees, BillingCountry FROM Account WHERE Name = '${escapedName}'`;
    
    const url = instanceUrl + '/services/data/v59.0/query?q=' + encodeURIComponent(soql);
    const resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    });
    const data = await resp.json();
    
    if (data.records && data.records.length > 0) {
      const acc = data.records[0];
      const domain = acc.Website ? 
        acc.Website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : null;
      
      try {
        await pool.query(
          'INSERT INTO accounts (name, domain, industry, employeeCount, region, website, sfdcAccountId) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [acc.Name, domain, acc.Industry || null, acc.NumberOfEmployees || null, acc.BillingCountry || 'Unknown', acc.Website || null, acc.Id]
        );
        fetched++;
      } catch (e) {
        // Ignore duplicate errors
      }
    }
    
    if (fetched % 10 === 0 && fetched > 0) {
      console.log(`  Fetched ${fetched} accounts...`);
    }
  }
  
  console.log('Fetched and inserted:', fetched, 'missing accounts');
  
  // Now link remaining contacts
  const [accounts] = await pool.query('SELECT id, name FROM accounts');
  const accountNameToId = {};
  accounts.forEach(a => { accountNameToId[a.name.toLowerCase()] = a.id; });
  
  const [contacts] = await pool.query('SELECT id, email FROM contacts WHERE email IS NOT NULL AND accountId IS NULL');
  let linked = 0;
  for (const contact of contacts) {
    const accountName = emailToAccountName[contact.email.toLowerCase()];
    if (accountName === undefined) continue;
    const accountId = accountNameToId[accountName.toLowerCase()];
    if (accountId === undefined) continue;
    await pool.query('UPDATE contacts SET accountId = ? WHERE id = ?', [accountId, contact.id]);
    linked++;
  }
  
  console.log('Linked additional:', linked, 'contacts');
  
  // Final count
  const [result] = await pool.query('SELECT (SELECT COUNT(*) FROM accounts) as accounts, (SELECT COUNT(*) FROM contacts WHERE accountId IS NOT NULL) as linked, (SELECT COUNT(*) FROM contacts) as total');
  console.log('\n=== FINAL RESULTS ===');
  console.log('Accounts:', result[0].accounts);
  console.log('Linked contacts:', result[0].linked, '/', result[0].total, `(${Math.round(result[0].linked/result[0].total*100)}%)`);
  
  await pool.end();
}

main().catch(console.error);
