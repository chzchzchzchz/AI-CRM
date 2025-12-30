import mysql from 'mysql2/promise';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Read CSV with Salesforce IDs
  const csvContent = fs.readFileSync('Beyond-Identity-Account-Insights-Default-view-export-1764061904917.csv', 'utf-8');
  const records = parse(csvContent, { columns: true, skip_empty_lines: true });
  
  let updated = 0;
  let notFound = 0;
  
  for (const row of records) {
    const sfdcId = (row['Salesforce Company ID'] || '').trim();
    const domain = (row['Company Domain'] || '').trim().toLowerCase();
    const companyName = (row['Company Name'] || '').trim();
    
    if (!sfdcId || sfdcId.length < 15 || !domain) continue;
    
    // Update account by domain match
    const [result] = await conn.execute(
      'UPDATE accounts SET sfdcAccountId = ? WHERE LOWER(domain) = ? AND (sfdcAccountId IS NULL OR sfdcAccountId = "")',
      [sfdcId, domain]
    );
    
    if (result.affectedRows > 0) {
      updated++;
      if (updated <= 5) console.log(`Updated: ${companyName} (${domain}) -> ${sfdcId}`);
    } else {
      notFound++;
    }
  }
  
  console.log(`\nUpdated ${updated} accounts with Salesforce IDs`);
  console.log(`${notFound} accounts not found or already had IDs`);
  
  await conn.end();
}

main().catch(console.error);
