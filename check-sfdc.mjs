import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);
  
  // Check current SFDC IDs
  const [rows] = await conn.execute(
    'SELECT name, sfdcAccountId FROM accounts WHERE sfdcAccountId IS NOT NULL AND sfdcAccountId != "" LIMIT 10'
  );
  
  console.log('Current SFDC IDs:');
  for (const row of rows) {
    console.log(`  ${row.name}: ${row.sfdcAccountId}`);
  }
  
  // Check if any still have CMA prefix
  const [cmaRows] = await conn.execute(
    'SELECT COUNT(*) as count FROM accounts WHERE sfdcAccountId LIKE "CMA%"'
  );
  console.log(`\nAccounts with CMA prefix: ${cmaRows[0].count}`);
  
  // Strip CMA prefix if any remain
  if (cmaRows[0].count > 0) {
    const [result] = await conn.execute(
      'UPDATE accounts SET sfdcAccountId = SUBSTRING(sfdcAccountId, 4) WHERE sfdcAccountId LIKE "CMA%"'
    );
    console.log(`Fixed ${result.affectedRows} accounts`);
  }
  
  // Check NVIDIA specifically
  const [nvidia] = await conn.execute(
    'SELECT name, sfdcAccountId FROM accounts WHERE name LIKE "%NVIDIA%"'
  );
  console.log('\nNVIDIA:');
  for (const row of nvidia) {
    console.log(`  ${row.name}: ${row.sfdcAccountId || 'NO SFDC ID'}`);
  }
  
  await conn.end();
}

main().catch(console.error);
