import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { contacts, calls, accounts } from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

console.log('Connected to database');

// Import contacts
async function importContacts() {
  console.log('\n=== Importing Contacts ===');
  
  const csvContent = fs.readFileSync('/home/ubuntu/upload/filled_contacts_partial.csv', 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`Found ${records.length} contacts in CSV`);
  
  // Get all accounts to match by name
  const allAccounts = await db.select().from(accounts);
  const accountsByName = new Map(allAccounts.map(a => [a.name?.toLowerCase(), a.id]));
  
  let imported = 0;
  let skipped = 0;
  
  for (const record of records) {
    try {
      // Find account by company name
      const accountId = accountsByName.get(record.account_name?.toLowerCase());
      
      if (!accountId) {
        console.log(`Skipping contact ${record.first_name} ${record.last_name} - account "${record.account_name}" not found`);
        skipped++;
        continue;
      }
      
      // Check if contact already exists
      const existing = await db.select().from(contacts).where(
        eq(contacts.linkedinUrl, record.linkedin_url)
      ).limit(1);
      
      if (existing.length > 0) {
        console.log(`Skipping ${record.first_name} ${record.last_name} - already exists`);
        skipped++;
        continue;
      }
      
      await db.insert(contacts).values({
        accountId,
        firstName: record.first_name || null,
        lastName: record.last_name || null,
        name: `${record.first_name || ''} ${record.last_name || ''}`.trim() || null,
        email: record.email || null,
        linkedinUrl: record.linkedin_url || null,
        company: record.account_name || null,
      });
      
      imported++;
      if (imported % 100 === 0) {
        console.log(`Imported ${imported} contacts...`);
      }
    } catch (error) {
      console.error(`Error importing contact ${record.first_name} ${record.last_name}:`, error.message);
    }
  }
  
  console.log(`\n✅ Contacts import complete: ${imported} imported, ${skipped} skipped`);
}

// Import Gong calls
async function importCalls() {
  console.log('\n=== Importing Gong Calls ===');
  
  const csvContent = fs.readFileSync('/home/ubuntu/upload/⚡️-Pull-calls-from-Gong-Table-Default-view-export-1764945461414.csv', 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
  
  console.log(`Found ${records.length} calls in CSV`);
  
  // Get all accounts to match by name
  const allAccounts = await db.select().from(accounts);
  const accountsByName = new Map(allAccounts.map(a => [a.name?.toLowerCase(), a.id]));
  
  let imported = 0;
  let skipped = 0;
  
  for (const record of records) {
    try {
      // Skip if no call ID
      if (!record['Call ID']) {
        skipped++;
        continue;
      }
      
      // Find account by company name
      const accountName = record['Account_Name_'] || record['Meeting Company'];
      const accountId = accountsByName.get(accountName?.toLowerCase());
      
      if (!accountId) {
        console.log(`Skipping call "${record['Call Title']}" - account "${accountName}" not found`);
        skipped++;
        continue;
      }
      
      // Check if call already exists
      const existing = await db.select().from(calls).where(
        eq(calls.gongCallId, record['Call ID'])
      ).limit(1);
      
      if (existing.length > 0) {
        console.log(`Skipping call ${record['Call ID']} - already exists`);
        skipped++;
        continue;
      }
      
      // Parse call date
      const callDate = new Date(record['Call Date']);
      if (isNaN(callDate.getTime())) {
        console.log(`Skipping call ${record['Call ID']} - invalid date`);
        skipped++;
        continue;
      }
      
      await db.insert(calls).values({
        accountId,
        gongCallId: record['Call ID'],
        title: record['Call Title'] || 'Untitled Call',
        duration: parseInt(record['Call Duration']) || 0,
        recordingUrl: record['Call Link'] || null,
        callDate,
      });
      
      imported++;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} calls...`);
      }
    } catch (error) {
      console.error(`Error importing call ${record['Call ID']}:`, error.message);
    }
  }
  
  console.log(`\n✅ Calls import complete: ${imported} imported, ${skipped} skipped`);
}

// Run imports
try {
  await importContacts();
  await importCalls();
  console.log('\n🎉 All imports complete!');
} catch (error) {
  console.error('Import failed:', error);
} finally {
  await connection.end();
}
