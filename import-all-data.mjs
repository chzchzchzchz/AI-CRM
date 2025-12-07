import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function importAllData() {
  console.log('🚀 Starting comprehensive data import...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await connection.execute('DELETE FROM contacts');
    await connection.execute('DELETE FROM accounts');
    console.log('✓ Cleared\n');
    
    // Import accounts from multiple CSV files
    const accountFiles = [
      'Beyond-Identity-Account-Insights-Default-view-export-1764061904917.csv',
      'company-Account-Insights-Default-view-export-1764061898651.csv',
      'SFDC-Final-Target-Accounts-Default-view-export-1764061853259.csv',
      'TALENRICHED.csv',
      'TARGETACCOUNTSZOOMINFOEXPORT-ZoomInfoAcctlist.csv'
    ];
    
    const accountsMap = new Map(); // domain -> account data
    
    for (const file of accountFiles) {
      const path = `/home/ubuntu/upload/${file}`;
      if (!fs.existsSync(path)) continue;
      
      console.log(`📊 Processing ${file}...`);
      const csv = fs.readFileSync(path, 'utf-8');
      const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
      
      for (const row of rows) {
        const name = row['Company Name'] || row['Account Name'] || row['Company'] || '';
        const domain = (row['Company Domain'] || row['Domain Name'] || row['Website'] || row['Domain'] || '').trim().toLowerCase();
        
        if (!name || !domain || domain === 'null') continue;
        
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
        
        if (!accountsMap.has(cleanDomain)) {
          accountsMap.set(cleanDomain, {
            name: name.trim(),
            domain: cleanDomain,
            industry: row['Industry'] || row['Primary Industry'] || 'Unknown',
            employeeCount: parseInt(row['Employee Count'] || row['Employees'] || '0') || 0,
            location: row['Location'] || row['Company City'] || row['Billing City'] || '',
            region: row['Region'] || row['Billing State/Province'] || row['Company State'] || 'Unknown',
            intentScore: parseInt(row['6sense Intent Score'] || row['6sense Account Intent Score'] || row['Intent Score'] || '0') || 0,
            relationship: 'Prospect',
            description: (row['Company Description'] || row['Description'] || '').substring(0, 1000),
            website: cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`
          });
        }
      }
    }
    
    console.log(`\n✓ Found ${accountsMap.size} unique accounts\n`);
    
    // Insert accounts
    console.log('💾 Inserting accounts...');
    let accountCount = 0;
    for (const [domain, account] of accountsMap) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO accounts (name, domain, industry, employeeCount, location, region, intentScore, relationship, description, website, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            account.name,
            account.domain,
            account.industry,
            account.employeeCount,
            account.location,
            account.region,
            account.intentScore,
            account.relationship,
            account.description,
            account.website
          ]
        );
        accountCount++;
        if (accountCount % 100 === 0) {
          console.log(`  ✓ Inserted ${accountCount} accounts...`);
        }
      } catch (err) {
        // Skip errors
      }
    }
    
    console.log(`\n✅ Inserted ${accountCount} accounts!\n`);
    
    // Import contacts
    const contactFiles = [
      'Find-people-Table-Default-view-export-1764057009669.csv',
      'filled_contacts_partial.csv',
      'asap-filled_contacts_partial.csv.csv',
      'filled_contacts_partial-filled_contacts_partial.csv.csv',
      'TALENRICHED-pidfpf-enhance.csv'
    ];
    
    console.log('👥 Importing contacts...\n');
    let contactCount = 0;
    
    for (const file of contactFiles) {
      const path = `/home/ubuntu/upload/${file}`;
      if (!fs.existsSync(path)) continue;
      
      console.log(`📊 Processing ${file}...`);
      const csv = fs.readFileSync(path, 'utf-8');
      const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
      
      for (const row of rows) {
        const firstName = row['First Name'] || row['First name'] || '';
        const lastName = row['Last Name'] || row['Last name'] || '';
        const fullName = row['Full Name'] || row['Name'] || `${firstName} ${lastName}`.trim();
        const email = row['Email'] || row['Email Address'] || '';
        const title = row['Title'] || row['Job Title'] || '';
        const company = row['Company'] || row['Company Name'] || row['Account Name'] || '';
        const linkedinUrl = row['LinkedIn URL'] || row['LinkedIn Profile'] || row['LinkedIn'] || '';
        const location = row['Location'] || row['City'] || '';
        
        if (!fullName || !company) continue;
        
        // Find account ID by company name
        const [accounts] = await connection.execute(
          'SELECT id FROM accounts WHERE name = ? LIMIT 1',
          [company]
        );
        
        if (accounts.length === 0) continue;
        
        const accountId = accounts[0].id;
        
        try {
          await connection.execute(
            `INSERT IGNORE INTO contacts (accountId, name, email, title, linkedinUrl, location, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [accountId, fullName, email || null, title, linkedinUrl || null, location]
          );
          contactCount++;
          
          if (contactCount % 100 === 0) {
            console.log(`  ✓ Inserted ${contactCount} contacts...`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }
    }
    
    console.log(`\n✅ Inserted ${contactCount} contacts!\n`);
    
    // Final counts
    const [accountTotal] = await connection.execute('SELECT COUNT(*) as total FROM accounts');
    const [contactTotal] = await connection.execute('SELECT COUNT(*) as total FROM contacts');
    const [hotLeads] = await connection.execute('SELECT COUNT(*) as total FROM accounts WHERE intentScore >= 70');
    const [warmLeads] = await connection.execute('SELECT COUNT(*) as total FROM accounts WHERE intentScore >= 40 AND intentScore < 70');
    
    console.log('\n📊 Final Database Stats:');
    console.log(`   Accounts: ${accountTotal[0].total}`);
    console.log(`   Contacts: ${contactTotal[0].total}`);
    console.log(`   Hot Leads (70+): ${hotLeads[0].total}`);
    console.log(`   Warm Leads (40-69): ${warmLeads[0].total}`);
    console.log('\n✅ Import complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

importAllData();
