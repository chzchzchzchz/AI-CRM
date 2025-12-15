/**
 * Import 6sense data from CSV exports
 * Run with: node server/import-6sense-data.mjs
 */

import fs from 'fs';
import mysql from 'mysql2/promise';

// Parse CSV with proper quote handling
function parseCSV(content) {
  const lines = content.split('\n');
  // Remove BOM if present
  if (lines[0].charCodeAt(0) === 65279) {
    lines[0] = lines[0].substring(1);
  }
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      // Remove quotes from header and value
      const key = h.replace(/^"|"$/g, '').trim();
      const val = (values[idx] || '').replace(/^"|"$/g, '').trim();
      row[key] = val;
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseIntentScore(str) {
  if (!str || str === '') return null;
  const num = parseInt(str);
  return isNaN(num) ? null : num;
}

async function main() {
  console.log('🔄 6sense Data Import');
  console.log('='.repeat(50));
  
  // Get DATABASE_URL from environment
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  
  // Parse URL
  const match = dbUrl.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!match) {
    console.error('❌ Could not parse DATABASE_URL');
    process.exit(1);
  }
  
  const [, user, password, host, port, database] = match;
  
  console.log(`📡 Connecting to ${host}:${port}/${database}...`);
  
  const connection = await mysql.createConnection({
    host,
    port: parseInt(port),
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false }
  });
  
  console.log('✅ Connected to database');
  
  // ========== IMPORT ACCOUNTS ==========
  const accountsPath = '/home/ubuntu/upload/report_accounts_2025-12-14.csv';
  console.log(`\n📥 Importing accounts from ${accountsPath}...`);
  
  const accountsContent = fs.readFileSync(accountsPath, 'utf-8');
  const accountRows = parseCSV(accountsContent);
  console.log(`📊 Found ${accountRows.length} account rows`);
  
  let accountsUpdated = 0;
  let accountsSkipped = 0;
  
  for (const row of accountRows) {
    const name = row['Account Name']?.trim();
    const domain = row['Website Address']?.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    const sixsenseId = row['6sense Mid']?.trim();
    
    if (!name && !domain) {
      accountsSkipped++;
      continue;
    }
    
    // Parse 6sense data
    const intentScore = parseIntentScore(row['Intent Score']);
    const buyingStage = row['Buying Stage']?.trim() || null;
    const profileFit = row['Profile Fit']?.trim() || null;
    const temperature = row['Temperature']?.trim() || null;
    const engagementActivities = parseInt(row['No.of Engagement Activities (Account)']) || 0;
    const salesActivities = parseInt(row['No.of sales Activities(Account)']) || 0;
    const lastSalesActivityDays = parseInt(row['Last Sales Activity (Days ago) (Account)']) || null;
    const opportunityStatus = row['Opportunity Status']?.trim() || null;
    
    // Build raw data JSON
    const rawData = JSON.stringify({
      sixsenseId,
      crmAccountId: row['CRM Account Id'],
      hqCompanyId: row['hqCompanyId'],
      accountOwner: row['Account Owner'],
      opportunityStatus,
      accountReach: row['Account Reach'],
      temperature,
      engagementActivities,
      salesActivities,
      lastSalesActivityDays,
      daysSinceLastEngagement: row['Days Since Last Engagement Activity (Account)'],
      lastSalesActivity: row['Last Sales Activity (Account)'],
      latestEngagementActivity: row['Latest Engagement Activity (Account)'],
      last6QA: row['Last 6QA'],
      sixsenseVerified: row['6sense Verified Account'],
      source: '6sense_report_2025-12-14'
    });
    
    try {
      // Find account by domain or name
      let [existing] = await connection.execute(
        'SELECT id FROM accounts WHERE domain = ? OR name = ? LIMIT 1',
        [domain || '', name]
      );
      
      if (existing.length > 0) {
        // Update with 6sense data
        await connection.execute(`
          UPDATE accounts SET
            intentScore = COALESCE(?, intentScore),
            sixsenseId = COALESCE(?, sixsenseId),
            sixsenseBuyingStage = COALESCE(?, sixsenseBuyingStage),
            sixsenseProfileFit = COALESCE(?, sixsenseProfileFit),
            rawData = ?,
            lastSixsenseSync = NOW(),
            updatedAt = NOW()
          WHERE id = ?
        `, [intentScore, sixsenseId, buyingStage, profileFit, rawData, existing[0].id]);
        accountsUpdated++;
      } else {
        accountsSkipped++;
      }
      
      if (accountsUpdated % 100 === 0 && accountsUpdated > 0) {
        console.log(`  Progress: ${accountsUpdated} accounts updated...`);
      }
    } catch (err) {
      console.error(`  Error processing account ${name}:`, err.message);
      accountsSkipped++;
    }
  }
  
  console.log(`✅ Accounts: ${accountsUpdated} updated, ${accountsSkipped} skipped`);
  
  // ========== IMPORT CONTACTS ==========
  const contactsPath = '/home/ubuntu/upload/report_people_2025-12-14.csv';
  console.log(`\n📥 Importing contacts from ${contactsPath}...`);
  
  const contactsContent = fs.readFileSync(contactsPath, 'utf-8');
  const contactRows = parseCSV(contactsContent);
  console.log(`📊 Found ${contactRows.length} contact rows`);
  
  let contactsUpdated = 0;
  let contactsCreated = 0;
  let contactsSkipped = 0;
  
  for (const row of contactRows) {
    const name = row['Contact name']?.trim();
    const email = row['Email']?.trim();
    const accountName = row['Account Name']?.trim();
    const domain = row['Website Address']?.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
    
    if (!name || !accountName) {
      contactsSkipped++;
      continue;
    }
    
    try {
      // Find account
      let [accountResult] = await connection.execute(
        'SELECT id FROM accounts WHERE domain = ? OR name = ? LIMIT 1',
        [domain || '', accountName]
      );
      
      if (accountResult.length === 0) {
        contactsSkipped++;
        continue;
      }
      
      const accountId = accountResult[0].id;
      
      // Parse contact data
      const title = row['Title']?.trim() || null;
      const phone = row['Contact Phone']?.trim() || null;
      const city = row['Contact City']?.trim() || null;
      const state = row['Contact State']?.trim() || null;
      const country = row['Contact Country']?.trim() || null;
      const location = [city, state, country].filter(Boolean).join(', ') || null;
      
      const engagementScore = row['Engagement Score (Person)']?.trim() || null;
      const profileFit = row['Contact Profile Fit']?.trim() || null;
      const profileScore = row['Contact Profile Score']?.trim() || null;
      const engagementGrade = row['Engagement Grade']?.trim() || null;
      const engagementTrend = row['Engagement Trend (Person)']?.trim() || null;
      const personaImportance = row['Persona Importance']?.trim() || null;
      
      // Split name into first/last
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || null;
      const lastName = nameParts.slice(1).join(' ') || null;
      
      // Check if contact exists
      let [existingContact] = await connection.execute(
        'SELECT id FROM contacts WHERE accountId = ? AND (email = ? OR name = ?) LIMIT 1',
        [accountId, email || '', name]
      );
      
      if (existingContact.length > 0) {
        // Update existing contact
        await connection.execute(`
          UPDATE contacts SET
            email = COALESCE(?, email),
            phone = COALESCE(?, phone),
            title = COALESCE(?, title),
            location = COALESCE(?, location),
            updatedAt = NOW()
          WHERE id = ?
        `, [email || null, phone, title, location, existingContact[0].id]);
        contactsUpdated++;
      } else {
        // Create new contact
        await connection.execute(`
          INSERT INTO contacts (accountId, name, firstName, lastName, email, phone, title, location, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `, [accountId, name, firstName, lastName, email || null, phone, title, location]);
        contactsCreated++;
      }
      
      if ((contactsUpdated + contactsCreated) % 500 === 0 && (contactsUpdated + contactsCreated) > 0) {
        console.log(`  Progress: ${contactsUpdated} updated, ${contactsCreated} created...`);
      }
    } catch (err) {
      // Silently skip duplicates
      if (!err.message.includes('Duplicate')) {
        console.error(`  Error processing contact ${name}:`, err.message);
      }
      contactsSkipped++;
    }
  }
  
  console.log(`✅ Contacts: ${contactsUpdated} updated, ${contactsCreated} created, ${contactsSkipped} skipped`);
  
  await connection.end();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 6sense import complete!');
}

main().catch(console.error);
