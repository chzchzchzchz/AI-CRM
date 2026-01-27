// Script to fetch contacts from Salesforce with their Account IDs
// and update the database to link contacts to accounts

// The instance URL needs to be the login URL, not lightning URL
const SALESFORCE_LOGIN_URL = 'https://login.salesforce.com';
const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL?.replace('.lightning.force.com', '.my.salesforce.com').replace(/\/$/, '');
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

async function getAccessToken() {
  // Try the my.salesforce.com instance URL
  const tokenUrl = `${SALESFORCE_INSTANCE_URL}/services/oauth2/token`;
  
  console.log('Trying token URL:', tokenUrl);
  
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
    console.log('Token response:', errorText);
    
    // Try login.salesforce.com as fallback
    console.log('\nTrying login.salesforce.com...');
    const loginTokenUrl = `${SALESFORCE_LOGIN_URL}/services/oauth2/token`;
    
    const loginResponse = await fetch(loginTokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    
    if (!loginResponse.ok) {
      const loginErrorText = await loginResponse.text();
      throw new Error(`Salesforce OAuth failed: ${loginResponse.status} - ${loginErrorText}`);
    }
    
    const loginData = await loginResponse.json();
    return { token: loginData.access_token, instanceUrl: loginData.instance_url };
  }

  const data = await response.json();
  return { token: data.access_token, instanceUrl: data.instance_url || SALESFORCE_INSTANCE_URL };
}

async function query(soql, token, instanceUrl) {
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
  console.log('Getting Salesforce access token...');
  console.log('Instance URL:', SALESFORCE_INSTANCE_URL);
  
  const { token, instanceUrl } = await getAccessToken();
  console.log('Connected to:', instanceUrl);
  
  // Query contacts with their Account IDs
  console.log('\nFetching contacts with Account IDs...');
  const soql = `
    SELECT Id, Email, AccountId, Account.Name
    FROM Contact
    WHERE Email != null AND AccountId != null
    ORDER BY Email
    LIMIT 5000
  `;
  
  const result = await query(soql, token, instanceUrl);
  console.log(`Found ${result.totalSize} contacts with Account IDs`);
  
  // Create a mapping of email -> accountId
  const emailToAccount = {};
  result.records.forEach(contact => {
    if (contact.Email && contact.AccountId) {
      emailToAccount[contact.Email.toLowerCase()] = {
        sfdcAccountId: contact.AccountId,
        accountName: contact.Account?.Name
      };
    }
  });
  
  console.log(`\nUnique email-to-account mappings: ${Object.keys(emailToAccount).length}`);
  
  // Sample of mappings
  console.log('\nSample mappings:');
  Object.entries(emailToAccount).slice(0, 10).forEach(([email, info]) => {
    console.log(`  ${email} -> ${info.accountName} (${info.sfdcAccountId})`);
  });
  
  // Output the mapping as JSON for database update
  const fs = await import('fs');
  fs.writeFileSync('/tmp/contact_account_mapping.json', JSON.stringify(emailToAccount, null, 2));
  console.log('\nMapping saved to /tmp/contact_account_mapping.json');
}

main().catch(console.error);
