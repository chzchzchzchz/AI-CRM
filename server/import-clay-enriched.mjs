/**
 * Import Clay enriched data from CSV files
 * Run with: node server/import-clay-enriched.mjs
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);

// Parse CSV manually (simple parser)
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx] || '';
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
      inQuotes = !inQuotes;
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

function cleanRevenue(str) {
  if (!str || str === '#N/A') return null;
  const cleaned = str.replace(/,/g, '').replace('$', '').trim();
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

function cleanEmployees(str) {
  if (!str || str === '#N/A') return null;
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseInt(cleaned);
  return isNaN(num) ? null : num;
}

async function main() {
  console.log('🔄 Clay Enriched Data Import');
  console.log('='.repeat(50));
  
  // Dynamic import of drizzle
  const { drizzle } = await import('drizzle-orm/mysql2');
  const mysql = await import('mysql2/promise');
  
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
  
  // Read CSV file
  const csvPath = '/home/ubuntu/upload/TALENRICHED-SFList.csv';
  console.log(`\\n📥 Reading ${csvPath}...`);
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);
  console.log(`📊 Found ${rows.length} rows`);
  
  let updated = 0;
  let created = 0;
  let skipped = 0;
  
  for (const row of rows) {
    const name = row['Account Name']?.trim();
    const domain = row['Domain Name']?.trim();
    
    if (!name) {
      skipped++;
      continue;
    }
    
    // Clean data
    let description = row['Description'];
    if (description === '#N/A') description = null;
    
    let website = row['Website'];
    if (website === '#N/A' || !website) website = null;
    
    let industry = row['Industry'];
    if (industry === '#N/A') industry = null;
    
    const subIndustry = row['Sub-Industry'];
    const revenue = cleanRevenue(row['Annual Revenue']);
    const employees = cleanEmployees(row['Number of Employees']);
    
    let region = row['Region'];
    if (region === '#N/A') region = null;
    
    // Build location
    const locationParts = [];
    const city = row['Billing City'];
    const state = row['Billing State/Province'];
    const country = row['Billing Country'];
    if (city && city !== '#N/A') locationParts.push(city);
    if (state && state !== '#N/A') locationParts.push(state);
    if (country && country !== '#N/A') locationParts.push(country);
    const location = locationParts.length > 0 ? locationParts.join(', ') : null;
    
    // Raw data for reference
    const rawData = JSON.stringify({
      zoomInfoCompanyId: row['ZoomInfo Company ID'],
      sfAccountId: row['Account ID (18 digit)'],
      subIndustry,
      yearFounded: row['Year Founded'],
      phone: row['Phone'],
      lastModified: row['Last Modified Date'],
      source: 'clay_sflist_enriched'
    });
    
    try {
      // Check if account exists
      let [existing] = await connection.execute(
        'SELECT id FROM accounts WHERE domain = ? OR name = ? LIMIT 1',
        [domain || '', name]
      );
      
      if (existing.length > 0) {
        // Update
        await connection.execute(`
          UPDATE accounts SET
            description = COALESCE(?, description),
            website = COALESCE(?, website),
            industry = COALESCE(?, industry),
            employeeCount = COALESCE(?, employeeCount),
            revenue = COALESCE(?, revenue),
            region = COALESCE(?, region),
            location = COALESCE(?, location),
            rawData = ?,
            updatedAt = NOW()
          WHERE id = ?
        `, [description, website, industry, employees, revenue ? String(revenue) : null, region, location, rawData, existing[0].id]);
        updated++;
      } else {
        // Insert
        await connection.execute(`
          INSERT INTO accounts (name, domain, description, website, industry, employeeCount, revenue, region, location, rawData, intentScore, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
        `, [name, domain || null, description, website, industry, employees, revenue ? String(revenue) : null, region, location, rawData]);
        created++;
      }
      
      if ((updated + created) % 100 === 0) {
        console.log(`  Progress: ${updated} updated, ${created} created...`);
      }
    } catch (err) {
      console.error(`  Error processing ${name}:`, err.message);
      skipped++;
    }
  }
  
  await connection.end();
  
  console.log('\\n' + '='.repeat(50));
  console.log(`✅ Import complete!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
}

main().catch(console.error);
