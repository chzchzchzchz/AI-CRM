import { createConnection } from 'mysql2/promise';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

const DATABASE_URL = process.env.DATABASE_URL;

async function importGongCalls() {
  const conn = await createConnection(DATABASE_URL);
  
  try {
    // Read CSV file
    const csvContent = fs.readFileSync('/home/ubuntu/upload/⚡️-Pull-calls-from-Gong-Table-Default-view-export-1764061905236.csv', 'utf-8');
    const records = parse(csvContent, {
      columns: false, // No header row, so we'll use indexes
      skip_empty_lines: true,
      trim: true
    });

    console.log(`Found ${records.length} rows (including header)`);

    // Get all accounts to map company name → accountId
    const [accounts] = await conn.execute('SELECT id, name FROM accounts');
    const companyToAccountId = {};
    for (const acc of accounts) {
      if (acc.name) {
        companyToAccountId[acc.name.toLowerCase()] = acc.id;
      }
    }
    console.log(`Loaded ${accounts.length} accounts for matching`);

    let imported = 0;
    let skipped = 0;
    let noMatch = 0;

    // Skip header row (index 0)
    for (let i = 1; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Based on the CSV structure:
        // [0] = empty, [1] = gongCallId, [2] = callDate, [3] = duration, [4] = empty,
        // [5] = title, [6] = call found status, [7] = transcript found status, [8] = Response,
        // [9] = transcript/summary, [10] = participants, [11] = Response, [12] = company name
        
        const gongCallId = record[1] || '';
        const callDateStr = record[2] || '';
        const duration = parseInt(record[3]) || 0;
        const title = record[5] || '';
        const transcript = record[9] || '';
        const companyName = (record[12] || '').toLowerCase().trim();

        if (!gongCallId || !callDateStr || !companyName) {
          skipped++;
          console.log(`Skipping call: gongCallId='${gongCallId}', date='${callDateStr}', company='${companyName}'`);
          continue;
        }

        // Find matching account
        const accountId = companyToAccountId[companyName];
        if (!accountId) {
          noMatch++;
          console.log(`No account match for: ${companyName} (call: ${title})`);
          continue;
        }

        // Parse call date
        const callDate = new Date(callDateStr);

        await conn.execute(
          `INSERT INTO calls (
            accountId, gongCallId, title, duration, transcriptUrl,
            callDate, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [accountId, gongCallId, title, duration, transcript, callDate]
        );

        imported++;
        console.log(`✅ Imported call: ${title} (${companyName})`);
      } catch (err) {
        console.error(`Error importing call:`, err.message);
      }
    }

    console.log(`\n✅ Successfully imported ${imported} Gong calls`);
    console.log(`⏭️  Skipped ${skipped} (missing data)`);
    console.log(`❌ Skipped ${noMatch} (no account match)`);
  } finally {
    await conn.end();
  }
}

importGongCalls().catch(console.error);
