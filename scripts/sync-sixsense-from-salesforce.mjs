import mysql from 'mysql2/promise';

// Salesforce OAuth configuration from env
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;
const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL;

async function getAccessToken() {
  const tokenUrl = `${SALESFORCE_INSTANCE_URL}/services/oauth2/token`;
  
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce OAuth failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return { token: data.access_token, instanceUrl: data.instance_url };
}

async function querySalesforce(token, instanceUrl, soql) {
  const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log("Syncing 6sense data from Salesforce...");
  
  // Get Salesforce token
  console.log("Getting Salesforce access token...");
  const { token, instanceUrl } = await getAccessToken();
  console.log("Connected to Salesforce at:", instanceUrl);
  
  // First, check what 6sense fields exist on Account
  console.log("\\nChecking for 6sense fields on Account object...");
  
  // Query for accounts with 6sense fields
  // Common 6sense field names in Salesforce
  const sixsenseFields = [
    'X6sense_Intent_Score__c',
    'X6Sense_Intent_Score__c', 
    'X6sense_Buying_Stage__c',
    'X6Sense_Buying_Stage__c',
    'X6sense_Profile_Fit__c',
    'X6Sense_Profile_Fit__c',
    'X6sense_Segments__c',
    'X6Sense_Segments__c',
    'Intent_Score__c',
    'Buying_Stage__c',
    'Profile_Fit__c',
  ];
  
  // Try to query with 6sense fields
  let sixsenseQuery = `
    SELECT Id, Name, Website
    FROM Account
    LIMIT 1
  `;
  
  try {
    // First get the Account describe to find 6sense fields
    const describeUrl = `${instanceUrl}/services/data/v59.0/sobjects/Account/describe`;
    const describeResponse = await fetch(describeUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const describe = await describeResponse.json();
    
    // Find 6sense-related fields
    const sixsenseFieldsFound = describe.fields.filter(f => 
      f.name.toLowerCase().includes('6sense') || 
      f.name.toLowerCase().includes('intent') ||
      f.name.toLowerCase().includes('buying_stage') ||
      f.name.toLowerCase().includes('profile_fit')
    );
    
    console.log("Found 6sense-related fields:", sixsenseFieldsFound.map(f => f.name));
    
    if (sixsenseFieldsFound.length === 0) {
      console.log("\\nNo 6sense fields found on Account object.");
      console.log("The 6sense data may need to be synced from a different source.");
      return;
    }
    
    // Build query with found fields
    const fieldNames = sixsenseFieldsFound.map(f => f.name).join(', ');
    
    // Get accounts that match our database accounts
    const conn = await mysql.createConnection(process.env.DATABASE_URL);
    const [dbAccounts] = await conn.execute('SELECT id, name, sfdcAccountId FROM accounts');
    console.log(`\\nFound ${dbAccounts.length} accounts in database`);
    
    // Query Salesforce for accounts with 6sense data
    const soql = `
      SELECT Id, Name, Website, ${fieldNames}
      FROM Account
      WHERE Id != null
      LIMIT 2000
    `;
    
    console.log("\\nQuerying Salesforce for accounts with 6sense data...");
    const result = await querySalesforce(token, instanceUrl, soql);
    console.log(`Found ${result.totalSize} accounts in Salesforce`);
    
    // Build a map of Salesforce accounts by name and ID
    const sfAccountMap = new Map();
    result.records.forEach(acc => {
      sfAccountMap.set(acc.Name.toLowerCase().trim(), acc);
      sfAccountMap.set(acc.Id, acc);
    });
    
    // Update our database accounts with 6sense data
    let updated = 0;
    for (const dbAccount of dbAccounts) {
      const sfAccount = sfAccountMap.get(dbAccount.name.toLowerCase().trim()) || 
                        (dbAccount.sfdcAccountId ? sfAccountMap.get(dbAccount.sfdcAccountId) : null);
      
      if (sfAccount) {
        // Extract 6sense fields
        const intentScore = sfAccount.X6sense_Intent_Score__c || sfAccount.X6Sense_Intent_Score__c || sfAccount.Intent_Score__c || 0;
        const buyingStage = sfAccount.X6sense_Buying_Stage__c || sfAccount.X6Sense_Buying_Stage__c || sfAccount.Buying_Stage__c || null;
        const profileFit = sfAccount.X6sense_Profile_Fit__c || sfAccount.X6Sense_Profile_Fit__c || sfAccount.Profile_Fit__c || null;
        
        if (intentScore > 0 || buyingStage || profileFit) {
          await conn.execute(`
            UPDATE accounts SET
              intentScore = ?,
              sixsenseBuyingStage = ?,
              sixsenseProfileFit = ?,
              sfdcAccountId = ?,
              lastSixsenseSync = NOW()
            WHERE id = ?
          `, [intentScore, buyingStage, profileFit, sfAccount.Id, dbAccount.id]);
          
          updated++;
          if (intentScore > 70) {
            console.log(`  ✓ ${dbAccount.name}: Intent ${intentScore}, Stage: ${buyingStage}`);
          }
        }
      }
    }
    
    console.log(`\\n=== Sync Complete ===`);
    console.log(`Updated ${updated} accounts with 6sense data`);
    
    // Show top accounts by intent
    const [topAccounts] = await conn.execute(`
      SELECT name, domain, intentScore, sixsenseBuyingStage 
      FROM accounts 
      WHERE intentScore > 0 
      ORDER BY intentScore DESC 
      LIMIT 10
    `);
    
    if (topAccounts.length > 0) {
      console.log(`\\n=== Top 10 Accounts by Intent Score ===`);
      topAccounts.forEach((a, i) => {
        console.log(`${i + 1}. ${a.name} (${a.domain}): ${a.intentScore} - ${a.sixsenseBuyingStage}`);
      });
    }
    
    await conn.end();
    
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main().catch(console.error);
