import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root@localhost:3306/dashboard';

// Map CSV columns to our database schema
function parseAccount(row) {
  const name = row['Company Name'] || row['Rows from: company Account Insights'] || '';
  const domain = row['Company Domain'] || '';
  
  if (!name || !domain || domain === 'null') return null;
  
  // Extract intent score from various possible fields
  let intentScore = 0;
  const intentFields = ['6sense Intent Score', 'Intent Score', 'Account Intent Score'];
  for (const field of intentFields) {
    if (row[field]) {
      const score = parseFloat(row[field]);
      if (!isNaN(score)) {
        intentScore = score;
        break;
      }
    }
  }
  
  // Extract employee count
  let employees = 0;
  const empFields = ['Employee Count', 'Employees', 'Company Size'];
  for (const field of empFields) {
    if (row[field]) {
      const emp = parseInt(row[field].toString().replace(/[^0-9]/g, ''));
      if (!isNaN(emp)) {
        employees = emp;
        break;
      }
    }
  }
  
  // Extract industry
  const industry = row['Industry'] || row['Company Industry'] || row['Sector'] || 'Unknown';
  
  // Extract region
  const region = row['Region'] || row['State'] || row['Company Country'] || 'Unknown';
  
  // Extract description
  const description = row['Company Description'] || row['Description'] || row['About'] || '';
  
  return {
    name: name.trim(),
    domain: domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    industry: industry.trim(),
    region: region.trim(),
    employees,
    intentScore,
    relationship: 'Prospect',
    description: description.substring(0, 1000), // Limit length
    website: domain.startsWith('http') ? domain : `https://${domain}`
  };
}

async function seedDatabase() {
  console.log('🚀 Starting database seed with real data...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Parse the large accounts CSV
    console.log('📊 Parsing the company Account Insights CSV...');
    const accountsCsv = fs.readFileSync('Beyond-Identity-Account-Insights-Default-view-export-1764061904917.csv', 'utf-8');
    const rawData = parse(accountsCsv, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    console.log(`✓ Found ${rawData.length} rows\n`);
    
    // Parse and filter accounts
    const accounts = rawData
      .map(parseAccount)
      .filter(acc => acc !== null)
      .filter((acc, index, self) => 
        // Remove duplicates by domain
        index === self.findIndex(a => a.domain === acc.domain)
      );
    
    console.log(`✓ Parsed ${accounts.length} valid accounts\n`);
    
    // Insert accounts in batches
    console.log('💾 Inserting accounts into database...');
    let inserted = 0;
    let updated = 0;
    
    for (const account of accounts) {
      try {
        const [result] = await connection.execute(
          `INSERT INTO accounts (name, domain, industry, region, employees, intentScore, relationship, description, website, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           industry = VALUES(industry),
           region = VALUES(region),
           employees = VALUES(employees),
           intentScore = VALUES(intentScore),
           description = VALUES(description),
           website = VALUES(website),
           updatedAt = NOW()`,
          [
            account.name,
            account.domain,
            account.industry,
            account.region,
            account.employees,
            account.intentScore,
            account.relationship,
            account.description,
            account.website
          ]
        );
        
        if (result.affectedRows === 1) {
          inserted++;
        } else if (result.affectedRows === 2) {
          updated++;
        }
        
        if ((inserted + updated) % 100 === 0) {
          console.log(`  ✓ Processed ${inserted + updated} accounts (${inserted} new, ${updated} updated)...`);
        }
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          console.error(`  ✗ Error with account ${account.name}: ${err.message}`);
        }
      }
    }
    
    console.log(`\n✅ Inserted ${inserted} new accounts, updated ${updated} existing accounts\n`);
    
    // Get final counts
    const [accountCount] = await connection.execute('SELECT COUNT(*) as count FROM accounts');
    const [contactCount] = await connection.execute('SELECT COUNT(*) as count FROM contacts');
    const [callCount] = await connection.execute('SELECT COUNT(*) as count FROM calls');
    
    // Get intent score distribution
    const [intentDist] = await connection.execute(`
      SELECT 
        COUNT(CASE WHEN intentScore >= 70 THEN 1 END) as hot,
        COUNT(CASE WHEN intentScore >= 40 AND intentScore < 70 THEN 1 END) as warm,
        COUNT(CASE WHEN intentScore < 40 THEN 1 END) as cold,
        AVG(intentScore) as avg_score
      FROM accounts
    `);
    
    console.log('📊 Database Summary:');
    console.log(`   Total Accounts: ${accountCount[0].count}`);
    console.log(`   Total Contacts: ${contactCount[0].count}`);
    console.log(`   Total Calls: ${callCount[0].count}`);
    console.log(`\n📈 Intent Score Distribution:`);
    console.log(`   Hot Leads (70+): ${intentDist[0].hot}`);
    console.log(`   Warm Leads (40-69): ${intentDist[0].warm}`);
    console.log(`   Cold Leads (<40): ${intentDist[0].cold}`);
    console.log(`   Average Score: ${Math.round(intentDist[0].avg_score)}`);
    console.log('\n✅ Seed complete!\n');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedDatabase().catch(console.error);
