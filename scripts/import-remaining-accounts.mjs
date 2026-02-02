// Import remaining 1,552 Ping accounts from saved JSON
import mysql from 'mysql2/promise';
import fs from 'fs';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Load all 2000 accounts from saved JSON
  const allAccounts = JSON.parse(fs.readFileSync('/tmp/ping_accounts_full.json', 'utf-8'));
  console.log(`Loaded ${allAccounts.length} accounts from JSON`);
  
  // Get existing account names from DB
  const [existingRows] = await conn.query('SELECT name FROM accounts');
  const existingNames = new Set(existingRows.map(r => r.name.toLowerCase()));
  console.log(`Found ${existingNames.size} existing accounts in DB`);
  
  // Filter to only new accounts
  const newAccounts = allAccounts.filter(a => !existingNames.has(a.Name?.toLowerCase()));
  console.log(`Found ${newAccounts.length} new accounts to import`);
  
  if (newAccounts.length === 0) {
    console.log('No new accounts to import');
    await conn.end();
    return;
  }
  
  // Import in batches of 100
  const batchSize = 100;
  let imported = 0;
  
  for (let i = 0; i < newAccounts.length; i += batchSize) {
    const batch = newAccounts.slice(i, i + batchSize);
    
    const values = batch.map(a => {
      const name = a.Name || 'Unknown';
      const domain = a.Website || '';
      const industry = a.Industry || '';
      const employeeCount = parseInt(a.NumberOfEmployees) || 0;
      const region = a.BillingState || a.BillingCountry || '';
      const intentScore = parseInt(a.accountIntentScore6sense__c) || 0;
      const sixsenseBuyingStage = a.accountBuyingStage6sense__c || '';
      const sixsenseProfileFit = a.accountProfileFit6sense__c || '';
      const salesforceId = a.Id || '';
      
      return [
        name,
        domain,
        industry,
        employeeCount,
        region,
        intentScore,
        sixsenseBuyingStage,
        sixsenseProfileFit,
        salesforceId
      ];
    });
    
    try {
      await conn.query(`
        INSERT INTO accounts (name, domain, industry, employeeCount, region, intentScore, sixsenseBuyingStage, sixsenseProfileFit, sfdcAccountId)
        VALUES ?
      `, [values]);
      
      imported += batch.length;
      console.log(`Imported ${imported}/${newAccounts.length} accounts`);
    } catch (err) {
      console.error('Error importing batch:', err.message);
      // Try one by one
      for (const a of batch) {
        try {
          const name = a.Name || 'Unknown';
          const domain = a.Website || '';
          const industry = a.Industry || '';
          const employeeCount = parseInt(a.NumberOfEmployees) || 0;
          const region = a.BillingState || a.BillingCountry || '';
          const intentScore = parseInt(a.accountIntentScore6sense__c) || 0;
          const sixsenseBuyingStage = a.accountBuyingStage6sense__c || '';
          const sixsenseProfileFit = a.accountProfileFit6sense__c || '';
          const salesforceId = a.Id || '';
          
          await conn.query(`
            INSERT INTO accounts (name, domain, industry, employeeCount, region, intentScore, sixsenseBuyingStage, sixsenseProfileFit, sfdcAccountId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [name, domain, industry, employeeCount, region, intentScore, sixsenseBuyingStage, sixsenseProfileFit, salesforceId]);
          imported++;
        } catch (e) {
          console.error(`Failed to import ${a.Name}: ${e.message}`);
        }
      }
      console.log(`Imported ${imported}/${newAccounts.length} accounts (with errors)`);
    }
  }
  
  // Final count
  const [finalCount] = await conn.query('SELECT COUNT(*) as count FROM accounts');
  console.log(`\nFinal account count: ${finalCount[0].count}`);
  
  // Show 6sense stats
  const [sixsenseStats] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN intentScore > 0 THEN 1 ELSE 0 END) as with_intent,
      SUM(CASE WHEN intentScore >= 80 THEN 1 ELSE 0 END) as high_intent,
      SUM(CASE WHEN sixsenseBuyingStage = 'Purchase' THEN 1 ELSE 0 END) as purchase_stage
    FROM accounts
  `);
  console.log('\n6sense Stats:');
  console.log(`  Total: ${sixsenseStats[0].total}`);
  console.log(`  With Intent Score: ${sixsenseStats[0].with_intent}`);
  console.log(`  High Intent (80+): ${sixsenseStats[0].high_intent}`);
  console.log(`  Purchase Stage: ${sixsenseStats[0].purchase_stage}`);
  
  await conn.end();
}

main().catch(console.error);
