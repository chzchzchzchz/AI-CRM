// Import LinkedIn company URLs and IDs from Sales Navigator exports
import mysql from 'mysql2/promise';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const dbUrl = process.env.DATABASE_URL;
const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
const [, user, password, host, port, database] = match;

async function importLinkedInData() {
  const conn = await mysql.createConnection({
    host, port: parseInt(port), user, password, database,
    ssl: { rejectUnauthorized: false }
  });

  console.log('Connected to database');

  // First, check if linkedinCompanyUrl column exists, if not add it
  try {
    await conn.execute(`
      ALTER TABLE accounts 
      ADD COLUMN linkedinCompanyUrl VARCHAR(512) NULL,
      ADD COLUMN linkedinCompanyId VARCHAR(64) NULL,
      ADD COLUMN salesNavUrl VARCHAR(512) NULL
    `);
    console.log('Added LinkedIn columns to accounts table');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('LinkedIn columns already exist');
    } else {
      console.log('Column check:', e.message);
    }
  }

  // Read and parse the Sales Nav exports
  const files = [
    '/home/ubuntu/upload/TargetAccountListUpdated_match_results.csv',
    '/home/ubuntu/upload/targetaccountlist_match_results.csv'
  ];

  let totalUpdated = 0;
  let totalMatched = 0;

  for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    const content = fs.readFileSync(file, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });

    for (const record of records) {
      if (record['Match Status'] !== 'MATCHED') continue;
      totalMatched++;

      const linkedinUrl = record['Matched Company Linkedin Url'];
      const linkedinId = record['Matched Company ID'];
      const salesNavUrl = record['Matched Company Sales Nav Url'];
      const companyName = record['Matched Company Name'] || record['Account Name (REQUIRED)'];
      const domain = record['Website URL (OPTIONAL)'] || record['6sense Domain'];

      if (!linkedinUrl && !linkedinId) continue;

      // Try to match by domain first, then by name
      let result;
      if (domain) {
        // Clean domain
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
        [result] = await conn.execute(
          `UPDATE accounts SET 
            linkedinCompanyUrl = COALESCE(linkedinCompanyUrl, ?),
            linkedinCompanyId = COALESCE(linkedinCompanyId, ?),
            salesNavUrl = COALESCE(salesNavUrl, ?)
          WHERE domain LIKE ? OR domain LIKE ?`,
          [linkedinUrl, linkedinId, salesNavUrl, cleanDomain, `%${cleanDomain}%`]
        );
      }

      if (!result || result.affectedRows === 0) {
        // Try by name
        [result] = await conn.execute(
          `UPDATE accounts SET 
            linkedinCompanyUrl = COALESCE(linkedinCompanyUrl, ?),
            linkedinCompanyId = COALESCE(linkedinCompanyId, ?),
            salesNavUrl = COALESCE(salesNavUrl, ?)
          WHERE name LIKE ?`,
          [linkedinUrl, linkedinId, salesNavUrl, `%${companyName}%`]
        );
      }

      if (result && result.affectedRows > 0) {
        totalUpdated++;
      }
    }
  }

  console.log(`\n=== Import Complete ===`);
  console.log(`Total matched records: ${totalMatched}`);
  console.log(`Accounts updated with LinkedIn data: ${totalUpdated}`);

  // Verify
  const [stats] = await conn.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN linkedinCompanyUrl IS NOT NULL THEN 1 ELSE 0 END) as withLinkedIn,
      SUM(CASE WHEN salesNavUrl IS NOT NULL THEN 1 ELSE 0 END) as withSalesNav
    FROM accounts
  `);
  console.log(`\nAccounts with LinkedIn URL: ${stats[0].withLinkedIn}`);
  console.log(`Accounts with Sales Nav URL: ${stats[0].withSalesNav}`);

  await conn.end();
}

importLinkedInData().catch(console.error);
