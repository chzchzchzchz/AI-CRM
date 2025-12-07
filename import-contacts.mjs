import fs from 'fs';
import { parse } from 'csv-parse/sync';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function importContacts() {
  console.log('👥 Starting contact import...\n');
  
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Clear existing contacts
    console.log('🗑️  Clearing existing contacts...');
    await connection.execute('DELETE FROM contacts');
    console.log('✓ Cleared\n');
    
    // Parse Find-people CSV (column-based, no headers)
    const findPeoplePath = '/home/ubuntu/upload/Find-people-Table-Default-view-export-1764057009669.csv';
    
    if (fs.existsSync(findPeoplePath)) {
      console.log('📊 Processing Find-people CSV...');
      const csv = fs.readFileSync(findPeoplePath, 'utf-8');
      const rows = parse(csv, { skip_empty_lines: true, relax_column_count: true });
      
      let contactCount = 0;
      
      for (const row of rows) {
        // Column mapping from analysis:
        // [5]: Company Name
        // [6]: Domain
        // [8]: First Name
        // [9]: Last Name
        // [10]: Full Name
        // [11]: Title
        // [12]: LinkedIn URL
        // [13]: Location
        
        const company = row[5];
        const fullName = row[10];
        const title = row[11];
        const linkedinUrl = row[12];
        const location = row[13];
        
        if (!company || !fullName) continue;
        
        // Find account by company name
        const [accounts] = await connection.execute(
          'SELECT id FROM accounts WHERE name LIKE ? LIMIT 1',
          [`%${company}%`]
        );
        
        if (accounts.length === 0) {
          // Try by domain if available
          const domain = row[6];
          if (domain) {
            const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
            const [accountsByDomain] = await connection.execute(
              'SELECT id FROM accounts WHERE domain = ? LIMIT 1',
              [cleanDomain]
            );
            
            if (accountsByDomain.length > 0) {
              const accountId = accountsByDomain[0].id;
              
              try {
                await connection.execute(
                  `INSERT IGNORE INTO contacts (accountId, name, title, linkedinUrl, location, createdAt, updatedAt)
                   VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
                  [accountId, fullName, title || null, linkedinUrl || null, location || null]
                );
                contactCount++;
              } catch (err) {
                // Skip duplicates
              }
            }
          }
          continue;
        }
        
        const accountId = accounts[0].id;
        
        try {
          await connection.execute(
            `INSERT IGNORE INTO contacts (accountId, name, title, linkedinUrl, location, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [accountId, fullName, title || null, linkedinUrl || null, location || null]
          );
          contactCount++;
          
          if (contactCount % 100 === 0) {
            console.log(`  ✓ Inserted ${contactCount} contacts...`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }
      
      console.log(`\n✅ Inserted ${contactCount} contacts from Find-people CSV!\n`);
    }
    
    // Now try the filled_contacts CSV files
    const filledContactsFiles = [
      'filled_contacts_partial.csv',
      'asap-filled_contacts_partial.csv.csv',
      'filled_contacts_partial-filled_contacts_partial.csv.csv'
    ];
    
    for (const file of filledContactsFiles) {
      const path = `/home/ubuntu/upload/${file}`;
      if (!fs.existsSync(path)) continue;
      
      console.log(`📊 Processing ${file}...`);
      const csv = fs.readFileSync(path, 'utf-8');
      
      try {
        const rows = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
        
        let contactCount = 0;
        
        for (const row of rows) {
          const company = row['Company'] || row['Company Name'] || row['Account Name'] || '';
          const fullName = row['Full Name'] || row['Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
          const email = row['Email'] || row['Email Address'] || '';
          const title = row['Title'] || row['Job Title'] || '';
          const linkedinUrl = row['LinkedIn URL'] || row['LinkedIn Profile'] || row['LinkedIn'] || '';
          const location = row['Location'] || row['City'] || '';
          
          if (!company || !fullName) continue;
          
          // Find account
          const [accounts] = await connection.execute(
            'SELECT id FROM accounts WHERE name LIKE ? LIMIT 1',
            [`%${company}%`]
          );
          
          if (accounts.length === 0) continue;
          
          const accountId = accounts[0].id;
          
          try {
            await connection.execute(
              `INSERT IGNORE INTO contacts (accountId, name, email, title, linkedinUrl, location, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              [accountId, fullName, email || null, title || null, linkedinUrl || null, location || null]
            );
            contactCount++;
            
            if (contactCount % 100 === 0) {
              console.log(`  ✓ Inserted ${contactCount} contacts...`);
            }
          } catch (err) {
            // Skip duplicates
          }
        }
        
        console.log(`✅ Inserted ${contactCount} contacts from ${file}!\n`);
      } catch (err) {
        console.log(`⚠️  Could not parse ${file}: ${err.message}\n`);
      }
    }
    
    // Final counts
    const [contactTotal] = await connection.execute('SELECT COUNT(*) as total FROM contacts');
    const [accountsWithContacts] = await connection.execute('SELECT COUNT(DISTINCT accountId) as total FROM contacts');
    
    console.log('\n📊 Final Contact Stats:');
    console.log(`   Total Contacts: ${contactTotal[0].total}`);
    console.log(`   Accounts with Contacts: ${accountsWithContacts[0].total}`);
    console.log('\n✅ Contact import complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

importContacts();
