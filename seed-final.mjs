import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function seedDatabase() {
  console.log('🚀 Seeding database with 777 accounts...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Parse CSV
    const csv = fs.readFileSync('Beyond-Identity-Account-Insights-Default-view-export-1764061904917.csv', 'utf-8');
    const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    console.log(`📊 Found ${rows.length} rows in CSV\n`);
    
    let inserted = 0;
    
    for (const row of rows) {
      const name = row['Company Name'] || '';
      const domain = row['Company Domain'] || '';
      
      if (!name || !domain || domain === 'null') continue;
      
      const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      
      try {
        await connection.execute(
          `INSERT IGNORE INTO accounts (name, domain, industry, employeeCount, location, region, intentScore, relationship, description, website, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            name.trim(),
            cleanDomain,
            row['Industry'] || 'Unknown',
            parseInt(row['Employee Count'] || '0') || 0,
            row['Location'] || row['Company Country'] || '',
            row['Region'] || row['State'] || 'Unknown',
            parseInt(row['6sense Intent Score'] || row['Intent Score'] || '0') || 0,
            'Prospect',
            (row['Company Description'] || '').substring(0, 1000),
            cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`
          ]
        );
        
        inserted++;
        
        if (inserted % 100 === 0) {
          console.log(`  ✓ Inserted ${inserted} accounts...`);
        }
      } catch (err) {
        // Skip errors
      }
    }
    
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM accounts');
    console.log(`\n✅ Database now has ${count[0].total} accounts!\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

seedDatabase();
