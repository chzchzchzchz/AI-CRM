/**
 * Import competitor technology data from 6sense filtered lists
 * Updates securityStack field with actual competitor products in use
 * 
 * Run with: node server/import-competitor-tech.mjs
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

// Competitor tech files mapping
const COMPETITOR_FILES = [
  { file: '/home/ubuntu/upload/oktausersintargetaccountlist-6sense.csv', tech: 'Okta' },
  { file: '/home/ubuntu/upload/entraazureusersintargetaccountlist-6sense.csv', tech: 'Microsoft Entra ID' },
  { file: '/home/ubuntu/upload/duousersintargetaccountlist-6sense.csv', tech: 'Cisco Duo' },
  { file: '/home/ubuntu/upload/pingusersintargetaccountlist-6sense.csv', tech: 'Ping Identity' },
  { file: '/home/ubuntu/upload/figmausersintargetaccountlist-6sense.csv', tech: 'Yubico/YubiKey' }, // Misnamed file
];

async function main() {
  console.log('🔄 Competitor Security Stack Import');
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
  
  // Track which accounts have which tech
  const accountTechMap = new Map(); // domain -> Set of technologies
  
  // Process each competitor file
  for (const { file, tech } of COMPETITOR_FILES) {
    if (!fs.existsSync(file)) {
      console.log(`⚠️ File not found: ${file}`);
      continue;
    }
    
    console.log(`\n📥 Processing ${tech} users from ${file}...`);
    
    const content = fs.readFileSync(file, 'utf-8');
    const rows = parseCSV(content);
    console.log(`   Found ${rows.length} accounts`);
    
    for (const row of rows) {
      const domain = row['Website Address']?.replace(/^https?:\/\//, '').replace(/\/$/, '').trim();
      const accountName = row['Account Name']?.trim();
      
      if (!domain && !accountName) continue;
      
      const key = domain || accountName;
      
      if (!accountTechMap.has(key)) {
        accountTechMap.set(key, { 
          domain, 
          accountName, 
          technologies: new Set(),
          sixsenseData: {
            sixsenseId: row['6sense Mid'],
            intentScore: row['Intent Score'] ? parseInt(row['Intent Score']) : null,
            buyingStage: row['Buying Stage'],
            profileFit: row['Profile Fit'],
            temperature: row['Temperature'],
          }
        });
      }
      
      accountTechMap.get(key).technologies.add(tech);
    }
  }
  
  console.log(`\n📊 Total unique accounts with competitor tech: ${accountTechMap.size}`);
  
  // Update database
  let updated = 0;
  let notFound = 0;
  
  for (const [key, data] of accountTechMap) {
    const { domain, accountName, technologies, sixsenseData } = data;
    const techArray = Array.from(technologies);
    const securityStackJson = JSON.stringify(techArray);
    
    try {
      // Find account by domain or name
      let [existing] = await connection.execute(
        'SELECT id, securityStack FROM accounts WHERE domain = ? OR name = ? LIMIT 1',
        [domain || '', accountName || '']
      );
      
      if (existing.length > 0) {
        const accountId = existing[0].id;
        let currentStack = [];
        
        // Merge with existing security stack
        try {
          if (existing[0].securityStack) {
            currentStack = JSON.parse(existing[0].securityStack);
            if (!Array.isArray(currentStack)) currentStack = [];
          }
        } catch (e) {
          currentStack = [];
        }
        
        // Add new technologies (avoid duplicates)
        const mergedStack = [...new Set([...currentStack, ...techArray])];
        
        // Update account with security stack and 6sense data
        await connection.execute(`
          UPDATE accounts SET
            securityStack = ?,
            sixsenseId = COALESCE(?, sixsenseId),
            intentScore = COALESCE(?, intentScore),
            sixsenseBuyingStage = COALESCE(?, sixsenseBuyingStage),
            sixsenseProfileFit = COALESCE(?, sixsenseProfileFit),
            updatedAt = NOW()
          WHERE id = ?
        `, [
          JSON.stringify(mergedStack),
          sixsenseData.sixsenseId || null,
          sixsenseData.intentScore || null,
          sixsenseData.buyingStage || null,
          sixsenseData.profileFit || null,
          accountId
        ]);
        
        updated++;
      } else {
        notFound++;
      }
    } catch (err) {
      console.error(`  Error updating ${accountName || domain}:`, err.message);
    }
  }
  
  await connection.end();
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Competitor tech import complete!');
  console.log(`   Updated: ${updated} accounts`);
  console.log(`   Not found: ${notFound} accounts`);
  
  // Summary by tech
  console.log('\n📊 Technology breakdown:');
  const techCounts = {};
  for (const [, data] of accountTechMap) {
    for (const tech of data.technologies) {
      techCounts[tech] = (techCounts[tech] || 0) + 1;
    }
  }
  for (const [tech, count] of Object.entries(techCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${tech}: ${count} accounts`);
  }
}

main().catch(console.error);
