import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const DATABASE_URL = process.env.DATABASE_URL;

async function importAccounts() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // Read CSV file
    const csvContent = fs.readFileSync('/home/ubuntu/upload/SFDC-Final-Target-Accounts-Default-view-export-1765207450981.csv', 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} accounts to import`);

    let imported = 0;
    let skipped = 0;
    for (const record of records) {
      try {
        const accountName = record['Account Name'];
        const domain = record['Domain Name'];
        
        if (!accountName || !domain || accountName.trim() === '' || domain.trim() === '') {
          skipped++;
          if (skipped <= 5) {
            console.log(`Skipping record #${skipped}: name='${accountName}', domain='${domain}'`);
          }
          continue;
        }
        
        if (imported === 0) {
          console.log(`First valid record: ${accountName} - ${domain}`);
        }

        const intentScore = parseInt(record['6sense Account Intent Score']) || 0;
        const region = record['Region'] || '';
        const industry = record['Industry'] || '';
        const employeeCount = parseInt(record['Employee Count']) || null;
        const description = record['Description'] || '';
        const website = record['Url'] || `https://${domain}`;
        const location = `${record['Billing City'] || ''}, ${record['Billing State/Province'] || ''}`.trim().replace(/^,\s*|,\s*$/g, '');
        const securityStack = record['Confirmed Security Stack'] || '';

        await conn.execute(
          `INSERT INTO accounts (
            name, domain, intentScore, region, industry,
            employeeCount, description, website, location,
            securityStack, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            accountName, domain, intentScore, region, industry,
            employeeCount, description, website, location,
            securityStack
          ]
        );

        imported++;
        if (imported % 100 === 0) {
          console.log(`Imported ${imported} accounts...`);
        }
      } catch (err) {
        console.error(`Error importing account ${record['Account Name']}:`, err.message);
      }
    }

    console.log(`\n✅ Successfully imported ${imported} accounts`);
    console.log(`⏭️  Skipped ${skipped} records with missing data`);
  } finally {
    await conn.end();
  }
}

importAccounts().catch(console.error);
