import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  console.log("Updating accounts with 6sense data from saved Salesforce export...");
  
  // Load the saved Salesforce data
  const data = JSON.parse(fs.readFileSync('/tmp/ping_accounts_full.json', 'utf8'));
  console.log(`Loaded ${data.length} accounts from Salesforce export`);
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all accounts from database
  const [dbAccounts] = await conn.execute('SELECT id, name, sfdcAccountId FROM accounts');
  console.log(`Found ${dbAccounts.length} accounts in database`);
  
  // Build maps for matching
  const sfAccountByName = new Map();
  const sfAccountById = new Map();
  
  data.forEach(acc => {
    sfAccountByName.set(acc.Name.toLowerCase().trim(), acc);
    sfAccountById.set(acc.Id, acc);
  });
  
  let updated = 0;
  let notFound = 0;
  
  for (const dbAccount of dbAccounts) {
    // Try to match by Salesforce ID first, then by name
    let sfAccount = null;
    
    if (dbAccount.sfdcAccountId) {
      sfAccount = sfAccountById.get(dbAccount.sfdcAccountId);
    }
    
    if (!sfAccount) {
      sfAccount = sfAccountByName.get(dbAccount.name.toLowerCase().trim());
    }
    
    if (sfAccount) {
      const intentScore = sfAccount.accountIntentScore6sense__c || 0;
      const buyingStage = sfAccount.accountBuyingStage6sense__c || null;
      const profileFit = sfAccount.accountProfileFit6sense__c || null;
      const is6QA = sfAccount.account6QA6sense__c || false;
      const icpTier = sfAccount.ICP_Tier__c || null;
      
      await conn.execute(`
        UPDATE accounts SET
          intentScore = ?,
          sixsenseBuyingStage = ?,
          sixsenseProfileFit = ?,
          sfdcAccountId = COALESCE(sfdcAccountId, ?),
          industry = COALESCE(industry, ?),
          employeeCount = COALESCE(employeeCount, ?),
          phone = COALESCE(phone, ?),
          description = COALESCE(description, ?),
          type = COALESCE(type, ?),
          lastSixsenseSync = NOW()
        WHERE id = ?
      `, [
        intentScore,
        buyingStage,
        profileFit,
        sfAccount.Id,
        sfAccount.Industry || null,
        sfAccount.NumberOfEmployees || null,
        sfAccount.Phone || null,
        sfAccount.Description ? sfAccount.Description.slice(0, 5000) : null,
        sfAccount.Type || null,
        dbAccount.id
      ]);
      
      updated++;
      
      if (intentScore > 70) {
        console.log(`  ✓ ${dbAccount.name}: Intent ${intentScore}, Stage: ${buyingStage}, Fit: ${profileFit}`);
      }
    } else {
      notFound++;
    }
  }
  
  console.log(`\\n=== Update Complete ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Not found in Salesforce export: ${notFound}`);
  
  // Show stats
  const [stats] = await conn.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN intentScore > 0 THEN 1 ELSE 0 END) as withIntent,
      SUM(CASE WHEN intentScore >= 80 THEN 1 ELSE 0 END) as highIntent,
      SUM(CASE WHEN sixsenseBuyingStage = 'Purchase' THEN 1 ELSE 0 END) as purchaseStage,
      SUM(CASE WHEN sixsenseBuyingStage = 'Decision' THEN 1 ELSE 0 END) as decisionStage,
      SUM(CASE WHEN sixsenseBuyingStage = 'Consideration' THEN 1 ELSE 0 END) as considerationStage
    FROM accounts
  `);
  
  console.log(`\\n=== Account Stats ===`);
  console.log(`Total accounts: ${stats[0].total}`);
  console.log(`With intent score > 0: ${stats[0].withIntent}`);
  console.log(`High intent (>= 80): ${stats[0].highIntent}`);
  console.log(`Purchase stage: ${stats[0].purchaseStage}`);
  console.log(`Decision stage: ${stats[0].decisionStage}`);
  console.log(`Consideration stage: ${stats[0].considerationStage}`);
  
  // Show top 15 accounts by intent
  const [topAccounts] = await conn.execute(`
    SELECT name, domain, intentScore, sixsenseBuyingStage, sixsenseProfileFit
    FROM accounts 
    WHERE intentScore > 0 
    ORDER BY intentScore DESC 
    LIMIT 15
  `);
  
  console.log(`\\n=== Top 15 Accounts by Intent Score ===`);
  topAccounts.forEach((a, i) => {
    console.log(`${i + 1}. ${a.name} (${a.domain}): ${a.intentScore} - ${a.sixsenseBuyingStage} - ${a.sixsenseProfileFit}`);
  });
  
  await conn.end();
}

main().catch(console.error);
