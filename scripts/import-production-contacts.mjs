import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const DATABASE_URL = process.env.DATABASE_URL;

async function importContacts() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // Read CSV file
    const csvContent = fs.readFileSync('/home/ubuntu/upload/Find-people-Table-Default-view-export-1765207530663.csv', 'utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} contacts to import`);

    // First, get all accounts to map domain → accountId
    const [accounts] = await conn.execute('SELECT id, domain FROM accounts');
    const domainToAccountId = {};
    for (const acc of accounts) {
      if (acc.domain) {
        domainToAccountId[acc.domain.toLowerCase()] = acc.id;
      }
    }
    console.log(`Loaded ${accounts.length} accounts for matching`);

    let imported = 0;
    let skipped = 0;
    let noAccountMatch = 0;

    for (const record of records) {
      try {
        const firstName = record['First Name'] || '';
        const lastName = record['Last Name'] || '';
        const fullName = record['Full Name'] || `${firstName} ${lastName}`.trim();
        const title = record['Job Title'] || '';
        const email = record['Work Email'] || '';
        const linkedinUrl = record['LinkedIn Profile'] || '';
        const location = record['Employee Location'] || '';
        const domain = (record['Domain Name'] || record['Domain Name (2)'] || '').toLowerCase();

        if (!fullName || !domain) {
          skipped++;
          if (skipped <= 5) {
            console.log(`Skipping contact #${skipped}: name='${fullName}', domain='${domain}'`);
          }
          continue;
        }

        // Find matching account
        const accountId = domainToAccountId[domain];
        if (!accountId) {
          noAccountMatch++;
          if (noAccountMatch <= 5) {
            console.log(`No account found for domain: ${domain} (contact: ${fullName})`);
          }
          continue;
        }

        if (imported === 0) {
          console.log(`First valid contact: ${fullName} at ${domain} (accountId: ${accountId})`);
        }

        await conn.execute(
          `INSERT INTO contacts (
            accountId, firstName, lastName, name, title, email,
            linkedinUrl, location, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            accountId, firstName, lastName, fullName, title, email,
            linkedinUrl, location
          ]
        );

        imported++;
        if (imported % 500 === 0) {
          console.log(`Imported ${imported} contacts...`);
        }
      } catch (err) {
        console.error(`Error importing contact ${record['Full Name']}:`, err.message);
      }
    }

    console.log(`\n✅ Successfully imported ${imported} contacts`);
    console.log(`⏭️  Skipped ${skipped} records with missing data`);
    console.log(`❌ Skipped ${noAccountMatch} contacts with no matching account`);
  } finally {
    await conn.end();
  }
}

importContacts().catch(console.error);
