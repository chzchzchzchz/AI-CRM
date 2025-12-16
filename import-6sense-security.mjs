import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Read 6sense security CSV
  const csvContent = fs.readFileSync('company-Account-Insights-Default-view-export-1764061898651.csv', 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });
  
  console.log(`Found ${records.length} records in 6sense CSV`);
  console.log('Sample record:', records[0]);
  
  let updated = 0;
  
  for (const row of records) {
    const domain = (row['6sense Domain'] || '').trim().toLowerCase();
    const mfaSolution = (row['MFA Solution'] || '').trim();
    const ssoProvider = (row['SSO Provider'] || '').trim();
    const securityIncidents = (row['Recent Security Incidents'] || '').trim();
    const complianceStatus = (row['Compliance Status'] || '').trim();
    const competitorIntent = (row['Competitor MFA Intent'] || '').trim();
    
    if (!domain) continue;
    
    // Get current rawData for this account
    const [existing] = await conn.execute(
      'SELECT id, rawData FROM accounts WHERE LOWER(domain) = ?',
      [domain]
    );
    
    if (existing.length === 0) continue;
    
    const account = existing[0];
    let rawData = {};
    try {
      rawData = account.rawData ? (typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData) : {};
    } catch (e) {}
    
    // Add 6sense security data
    if (mfaSolution && mfaSolution !== 'Response') rawData['MFA Solution'] = mfaSolution;
    if (ssoProvider && ssoProvider !== 'Response' && ssoProvider !== 'Not found') rawData['SSO Provider'] = ssoProvider;
    if (securityIncidents && securityIncidents !== 'Response') rawData['Recent Security Incidents'] = securityIncidents;
    if (complianceStatus && complianceStatus !== 'Response') rawData['Compliance Status'] = complianceStatus;
    if (competitorIntent && competitorIntent !== 'Response') rawData['Competitor MFA Intent'] = competitorIntent;
    
    // Update account
    await conn.execute(
      'UPDATE accounts SET rawData = ? WHERE id = ?',
      [JSON.stringify(rawData), account.id]
    );
    updated++;
  }
  
  console.log(`Updated ${updated} accounts with 6sense security data`);
  
  // Check a sample
  const [sample] = await conn.execute(
    'SELECT name, rawData FROM accounts WHERE domain = "okta.com" OR domain = "3playmedia.com" LIMIT 1'
  );
  if (sample.length > 0) {
    console.log('\nSample account:', sample[0].name);
    const data = typeof sample[0].rawData === 'string' ? JSON.parse(sample[0].rawData) : sample[0].rawData;
    console.log('MFA Solution:', data['MFA Solution']);
    console.log('SSO Provider:', data['SSO Provider']);
  }
  
  await conn.end();
}

main().catch(console.error);
