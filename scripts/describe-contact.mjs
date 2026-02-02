// Script to describe the Contact object and find LinkedIn field name
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await response.json();
  return { token: data.access_token, instanceUrl: data.instance_url || SALESFORCE_INSTANCE_URL };
}

async function main() {
  const { token, instanceUrl } = await getAccessToken();
  console.log('Connected to:', instanceUrl);
  
  // Describe Contact object to find LinkedIn field
  const url = `${instanceUrl}/services/data/v59.0/sobjects/Contact/describe`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  // Find LinkedIn-related fields
  console.log('\nLinkedIn-related fields:');
  data.fields.filter(f => f.name.toLowerCase().includes('linkedin')).forEach(f => {
    console.log(`  ${f.name} (${f.label})`);
  });
  
  // Find Title field
  console.log('\nTitle field:');
  const titleField = data.fields.find(f => f.name === 'Title');
  if (titleField) {
    console.log(`  ${titleField.name} (${titleField.label})`);
  }
  
  // Show all custom fields
  console.log('\nAll custom fields (__c):');
  data.fields.filter(f => f.name.endsWith('__c')).slice(0, 50).forEach(f => {
    console.log(`  ${f.name} (${f.label})`);
  });
}

main().catch(console.error);
