// Script to update contacts with Title and LinkedIn URL from Salesforce
import mysql from 'mysql2/promise';
import fs from 'fs';

const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL;
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

async function getAccessToken() {
  // Try JWT bearer flow
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: SALESFORCE_CLIENT_SECRET, // The client secret is actually a JWT assertion
  });

  let response = await fetch(`${SALESFORCE_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    // Try password grant as fallback
    const params2 = new URLSearchParams({
      grant_type: 'password',
      client_id: SALESFORCE_CLIENT_ID,
      client_secret: SALESFORCE_CLIENT_SECRET,
      username: process.env.SALESFORCE_USERNAME || '',
      password: process.env.SALESFORCE_PASSWORD || '',
    });
    
    response = await fetch(`${SALESFORCE_INSTANCE_URL}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params2.toString(),
    });
  }

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function queryContacts(accessToken, emails) {
  // Build SOQL query for contacts by email
  const emailList = emails.map(e => `'${e.replace(/'/g, "\\'")}'`).join(',');
  const query = `SELECT Id, Email, Title, LinkedIn_URL__c FROM Contact WHERE Email IN (${emailList})`;
  
  const response = await fetch(
    `${SALESFORCE_INSTANCE_URL}/services/data/v59.0/query?q=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('Query failed:', errText);
    return [];
  }

  const data = await response.json();
  return data.records || [];
}

async function main() {
  console.log('Connecting to database...');
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all contact emails from database
  const [contacts] = await conn.execute('SELECT id, email FROM contacts');
  console.log(`Found ${contacts.length} contacts in database`);
  
  // Get Salesforce access token
  console.log('\\nGetting Salesforce access token...');
  let accessToken;
  try {
    accessToken = await getAccessToken();
    console.log('Access token obtained');
  } catch (err) {
    console.error('Failed to get access token:', err.message);
    console.log('\\nTrying alternative approach - query Contact object directly...');
    
    // Use the existing saved data to check for LinkedIn field name
    const savedContacts = JSON.parse(fs.readFileSync('/tmp/salesforce_contacts.json', 'utf8'));
    console.log('Saved contact fields:', Object.keys(savedContacts[0] || {}));
    
    await conn.end();
    return;
  }
  
  // Query Salesforce in batches
  const batchSize = 100;
  let updated = 0;
  let withTitle = 0;
  let withLinkedIn = 0;
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const emails = batch.map(c => c.email).filter(e => e);
    
    if (emails.length === 0) continue;
    
    try {
      const sfContacts = await queryContacts(accessToken, emails);
      
      // Update database with Title and LinkedIn
      for (const sfc of sfContacts) {
        if (sfc.Title || sfc.LinkedIn_URL__c) {
          await conn.execute(
            'UPDATE contacts SET title = ?, linkedinUrl = ? WHERE email = ?',
            [sfc.Title || null, sfc.LinkedIn_URL__c || null, sfc.Email]
          );
          updated++;
          if (sfc.Title) withTitle++;
          if (sfc.LinkedIn_URL__c) withLinkedIn++;
        }
      }
      
      console.log(`Processed ${Math.min(i + batchSize, contacts.length)}/${contacts.length} contacts`);
    } catch (err) {
      console.error(`Batch ${i} error:`, err.message);
    }
  }
  
  console.log('\\n=== RESULTS ===');
  console.log(`Updated: ${updated} contacts`);
  console.log(`With Title: ${withTitle}`);
  console.log(`With LinkedIn: ${withLinkedIn}`);
  
  await conn.end();
}

main().catch(console.error);
