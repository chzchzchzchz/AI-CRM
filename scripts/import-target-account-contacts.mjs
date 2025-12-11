import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const DATABASE_URL = process.env.DATABASE_URL;

async function importTargetAccountContacts() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // Get all accounts to map company name → accountId
    const [accounts] = await conn.execute('SELECT id, name, domain FROM accounts');
    const companyToAccountId = {};
    for (const acc of accounts) {
      if (acc.name) {
        companyToAccountId[acc.name.toLowerCase()] = acc.id;
      }
      // Also map by domain for fallback
      if (acc.domain) {
        companyToAccountId[acc.domain.toLowerCase()] = acc.id;
      }
    }
    console.log(`Loaded ${accounts.length} accounts for matching`);

    let totalImported = 0;
    let totalSkipped = 0;
    let totalNoMatch = 0;

    // Import from both CSV files
    const files = [
      '/home/ubuntu/upload/TargetAccountContacts-LinkedInContactUpload.csv',
      '/home/ubuntu/upload/TargetAccountContacts-SFDCContactUpload.csv'
    ];

    for (const filePath of files) {
      console.log(`\n📂 Processing: ${filePath.split('/').pop()}`);
      
      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      console.log(`Found ${records.length} contacts in file`);

      let imported = 0;
      let skipped = 0;
      let noMatch = 0;

      for (const record of records) {
        try {
          const firstName = record['firstname'] || record['First Name'] || '';
          const lastName = record['lastname'] || record['Last Name'] || '';
          const fullName = `${firstName} ${lastName}`.trim();
          const title = record['jobtitle'] || record['Job Title'] || '';
          const email = record['email'] || record['Email'] || '';
          const company = (record['employeecompany'] || record['Company'] || '').toLowerCase();

          if (!fullName || !company) {
            skipped++;
            continue;
          }

          // Find matching account
          const accountId = companyToAccountId[company];
          if (!accountId) {
            noMatch++;
            if (noMatch <= 3) {
              console.log(`No account match for: ${company} (contact: ${fullName})`);
            }
            continue;
          }

          // Check if contact already exists
          const [existing] = await conn.execute(
            'SELECT id FROM contacts WHERE accountId = ? AND email = ? LIMIT 1',
            [accountId, email]
          );

          if (existing.length > 0) {
            skipped++;
            continue; // Skip duplicate
          }

          await conn.execute(
            `INSERT INTO contacts (
              accountId, firstName, lastName, name, title, email,
              createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [accountId, firstName, lastName, fullName, title, email]
          );

          imported++;
          if (imported % 100 === 0) {
            console.log(`Imported ${imported} contacts from this file...`);
          }
        } catch (err) {
          console.error(`Error importing contact:`, err.message);
        }
      }

      console.log(`✅ Imported ${imported} contacts from this file`);
      console.log(`⏭️  Skipped ${skipped} (duplicates or missing data)`);
      console.log(`❌ Skipped ${noMatch} (no account match)`);

      totalImported += imported;
      totalSkipped += skipped;
      totalNoMatch += noMatch;
    }

    console.log(`\n🎉 TOTAL: Imported ${totalImported} additional contacts`);
    console.log(`⏭️  TOTAL: Skipped ${totalSkipped} (duplicates or missing data)`);
    console.log(`❌ TOTAL: Skipped ${totalNoMatch} (no account match)`);
  } finally {
    await conn.end();
  }
}

importTargetAccountContacts().catch(console.error);
