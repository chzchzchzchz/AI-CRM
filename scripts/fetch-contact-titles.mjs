// Script to fetch contact Title and LinkedIn URL from Salesforce
import fs from 'fs';
import mysql from 'mysql2/promise';

// Transform the instance URL to .my.salesforce.com format
const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL?.replace('.lightning.force.com', '.my.salesforce.com').replace(/\/$/, '');
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

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
  return { token: data.access_token, instanceUrl: data.instance_url || SALESFORCE_INSTANCE_URL };
}

async function queryContacts(token, instanceUrl, emails) {
  // Build SOQL query for contacts by email
  const emailList = emails.map(e => `'${e.replace(/'/g, "\\'")}'`).join(',');
  const query = `SELECT Id, Email, Title, LinkedIn_profile_URL__c FROM Contact WHERE Email IN (${emailList})`;
  
  const url = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(query)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Query failed:', errorText);
    return [];
  }

  const data = await response.json();
  return data.records || [];
}

async function main() {
  console.log('Connecting to database...');
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all contact emails from database
  const [contacts] = await conn.execute('SELECT id, email FROM contacts WHERE email IS NOT NULL');
  console.log(`Found ${contacts.length} contacts in database`);
  
  // Get Salesforce access token
  console.log('\nGetting Salesforce access token...');
  console.log('Instance URL:', SALESFORCE_INSTANCE_URL);
  const { token, instanceUrl } = await getAccessToken();
  console.log('Connected to:', instanceUrl);
  
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
      const sfContacts = await queryContacts(token, instanceUrl, emails);
      
      // Update database with Title and LinkedIn
      for (const sfc of sfContacts) {
        if (sfc.Title || sfc.LinkedIn_profile_URL__c) {
          await conn.execute(
            'UPDATE contacts SET title = ?, linkedinUrl = ? WHERE email = ?',
            [sfc.Title || null, sfc.LinkedIn_profile_URL__c || null, sfc.Email]
          );
          updated++;
          if (sfc.Title) withTitle++;
          if (sfc.LinkedIn_profile_URL__c) withLinkedIn++;
        }
      }
      
      if ((i + batchSize) % 500 === 0 || i + batchSize >= contacts.length) {
        console.log(`Processed ${Math.min(i + batchSize, contacts.length)}/${contacts.length} contacts | Updated: ${updated} | Titles: ${withTitle} | LinkedIn: ${withLinkedIn}`);
      }
    } catch (err) {
      console.error(`Batch ${i} error:`, err.message);
    }
  }
  
  console.log('\n=== FINAL RESULTS ===');
  console.log(`Updated: ${updated} contacts`);
  console.log(`With Title: ${withTitle}`);
  console.log(`With LinkedIn: ${withLinkedIn}`);
  
  // Verify the update
  const [stats] = await conn.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN title IS NOT NULL AND title != '' THEN 1 ELSE 0 END) as hasTitle,
      SUM(CASE WHEN linkedinUrl IS NOT NULL AND linkedinUrl != '' THEN 1 ELSE 0 END) as hasLinkedIn
    FROM contacts
  `);
  console.log('\n=== DATABASE STATS ===');
  console.log('Total contacts:', stats[0].total);
  console.log('With Title:', stats[0].hasTitle);
  console.log('With LinkedIn:', stats[0].hasLinkedIn);
  
  await conn.end();
}

main().catch(console.error);
