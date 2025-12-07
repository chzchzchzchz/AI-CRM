import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root@localhost:3306/dashboard';

async function seedDatabase() {
  console.log('🚀 Starting database seed from CSV files...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Parse accounts CSV
    console.log('📊 Parsing accounts CSV...');
    const accountsCsv = fs.readFileSync('Beyond-Identity-Account-Insights-Default-view-export-1764061904917.csv', 'utf-8');
    const accountsData = parse(accountsCsv, { columns: true, skip_empty_lines: true });
    
    console.log(`✓ Found ${accountsData.length} accounts\n`);
    
    // Parse contacts CSV
    console.log('👥 Parsing contacts CSV...');
    const contactsCsv = fs.readFileSync('Find-people-Table-Default-view-export-1764057009669.csv', 'utf-8');
    const contactsData = parse(contactsCsv, { columns: true, skip_empty_lines: true });
    
    console.log(`✓ Found ${contactsData.length} contacts\n`);
    
    // Parse calls CSV
    console.log('📞 Parsing calls CSV...');
    const callsCsv = fs.readFileSync('⚡️-Pull-calls-from-Gong-Table-Default-view-export-1764061905236.csv', 'utf-8');
    const callsData = parse(callsCsv, { columns: true, skip_empty_lines: true });
    
    console.log(`✓ Found ${callsData.length} calls\n`);
    
    // Insert accounts
    console.log('💾 Inserting accounts...');
    let accountsInserted = 0;
    
    for (const row of accountsData) {
      try {
        const name = row['Account Name'] || row['Company Name'] || 'Unknown';
        const domain = row['Domain'] || row['Website'] || row['Domain Name'] || '';
        
        if (!domain) continue;
        
        const intentScore = parseFloat(row['6sense Intent Score'] || row['Intent Score'] || '0');
        const employees = parseInt(row['Employee Count'] || row['Employees'] || '0');
        
        await connection.execute(
          `INSERT INTO accounts (name, domain, industry, region, employees, intentScore, relationship, description, website, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
           intentScore = VALUES(intentScore),
           employees = VALUES(employees),
           updatedAt = NOW()`,
          [
            name,
            domain,
            row['Industry'] || 'Unknown',
            row['Region'] || row['State'] || 'Unknown',
            employees,
            intentScore,
            row['Relationship'] || 'Prospect',
            row['Description'] || row['Company Description'] || '',
            domain.startsWith('http') ? domain : `https://${domain}`
          ]
        );
        
        accountsInserted++;
        
        if (accountsInserted % 100 === 0) {
          console.log(`  ✓ Inserted ${accountsInserted} accounts...`);
        }
      } catch (err) {
        // Skip duplicates
        if (!err.message.includes('Duplicate')) {
          console.error(`  ✗ Error inserting account: ${err.message}`);
        }
      }
    }
    
    console.log(`\n✅ Inserted ${accountsInserted} accounts\n`);
    
    // Insert contacts
    console.log('💾 Inserting contacts...');
    let contactsInserted = 0;
    
    for (const row of contactsData) {
      try {
        const name = row['Full Name'] || row['Name'] || '';
        const company = row['Account Name'] || row['Company'] || '';
        
        if (!name || !company) continue;
        
        // Get account ID
        const [accounts] = await connection.execute(
          'SELECT id FROM accounts WHERE name = ? LIMIT 1',
          [company]
        );
        
        if (accounts.length === 0) continue;
        
        const accountId = accounts[0].id;
        
        await connection.execute(
          `INSERT INTO contacts (accountId, name, title, email, linkedin, location, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           updatedAt = NOW()`,
          [
            accountId,
            name,
            row['Job Title'] || row['Title'] || '',
            row['Work Email'] || row['Email'] || null,
            row['LinkedIn Profile'] || row['LinkedIn'] || null,
            row['Employee Location'] || row['Location'] || null
          ]
        );
        
        contactsInserted++;
        
        if (contactsInserted % 100 === 0) {
          console.log(`  ✓ Inserted ${contactsInserted} contacts...`);
        }
      } catch (err) {
        if (!err.message.includes('Duplicate')) {
          console.error(`  ✗ Error inserting contact: ${err.message}`);
        }
      }
    }
    
    console.log(`\n✅ Inserted ${contactsInserted} contacts\n`);
    
    // Insert calls
    console.log('💾 Inserting calls...');
    let callsInserted = 0;
    
    for (const row of callsData) {
      try {
        const company = row['Counterparty Company'] || row['Company'] || '';
        const title = row['Call Title'] || row['Title'] || 'Call';
        
        if (!company) continue;
        
        // Get account ID
        const [accounts] = await connection.execute(
          'SELECT id FROM accounts WHERE name = ? LIMIT 1',
          [company]
        );
        
        if (accounts.length === 0) continue;
        
        const accountId = accounts[0].id;
        
        const callDate = row['Call Date'] ? new Date(row['Call Date']) : new Date();
        const duration = parseInt(row['Call Duration'] || row['Duration'] || '0');
        
        await connection.execute(
          `INSERT INTO calls (accountId, title, callDate, duration, recording, transcript, summary, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            accountId,
            title,
            callDate,
            duration,
            row['Call Link'] || row['Recording'] || null,
            row['Call Transcript'] || row['Transcript'] || null,
            row['Call Summary'] || row['Summary'] || null
          ]
        );
        
        callsInserted++;
      } catch (err) {
        console.error(`  ✗ Error inserting call: ${err.message}`);
      }
    }
    
    console.log(`\n✅ Inserted ${callsInserted} calls\n`);
    
    // Summary
    const [accountCount] = await connection.execute('SELECT COUNT(*) as count FROM accounts');
    const [contactCount] = await connection.execute('SELECT COUNT(*) as count FROM contacts');
    const [callCount] = await connection.execute('SELECT COUNT(*) as count FROM calls');
    
    console.log('📊 Database Summary:');
    console.log(`   Accounts: ${accountCount[0].count}`);
    console.log(`   Contacts: ${contactCount[0].count}`);
    console.log(`   Calls: ${callCount[0].count}`);
    console.log('\n✅ Seed complete!\n');
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedDatabase().catch(console.error);
