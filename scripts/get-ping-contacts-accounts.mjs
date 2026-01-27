// Script to fetch the Ping contacts report and get Account IDs

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

async function getReport(reportId, token, instanceUrl) {
  // Get report with all details
  const url = `${instanceUrl}/services/data/v59.0/analytics/reports/${reportId}?includeDetails=true`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Salesforce report query failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function main() {
  console.log('Getting Salesforce access token...');
  const { token, instanceUrl } = await getAccessToken();
  console.log('Connected to:', instanceUrl);
  
  // Report ID for "Updated Ping Contacts 01/20/2026"
  const reportId = '00OUI00000GUCQj2AP';
  
  console.log(`\nFetching report ${reportId}...`);
  const reportData = await getReport(reportId, token, instanceUrl);
  
  console.log('Report name:', reportData.reportMetadata?.name);
  console.log('Report columns:', reportData.reportMetadata?.detailColumns);
  
  // Get column info
  const columnInfo = reportData.reportExtendedMetadata?.detailColumnInfo || {};
  console.log('\nColumn details:');
  const columns = reportData.reportMetadata?.detailColumns || [];
  columns.forEach((col, i) => {
    const info = columnInfo[col];
    console.log(`  ${i}: ${col} -> ${info?.label} (${info?.dataType})`);
  });
  
  // Get rows
  const rows = reportData.factMap?.['T!T']?.rows || [];
  console.log(`\nTotal rows: ${rows.length}`);
  
  // Find the Account ID column
  const accountIdColIndex = columns.findIndex(col => 
    col.toLowerCase().includes('accountid') || 
    columnInfo[col]?.label?.toLowerCase().includes('account id')
  );
  
  const emailColIndex = columns.findIndex(col => 
    col.toLowerCase().includes('email') || 
    columnInfo[col]?.label?.toLowerCase().includes('email')
  );
  
  console.log(`\nAccount ID column index: ${accountIdColIndex}`);
  console.log(`Email column index: ${emailColIndex}`);
  
  // Show first few rows
  console.log('\nFirst 5 rows:');
  rows.slice(0, 5).forEach((row, rowIdx) => {
    console.log(`\nRow ${rowIdx}:`);
    row.dataCells.forEach((cell, i) => {
      const colKey = columns[i];
      const colLabel = columnInfo[colKey]?.label || colKey;
      console.log(`  ${colLabel}: ${cell.label || cell.value}`);
    });
  });
  
  // Extract email to account mapping
  if (emailColIndex >= 0) {
    const emailToAccount = {};
    rows.forEach(row => {
      const emailCell = row.dataCells[emailColIndex];
      const email = emailCell?.label || emailCell?.value;
      
      // Look for account ID in the row
      let accountId = null;
      let accountName = null;
      
      // Check each cell for account-related data
      row.dataCells.forEach((cell, i) => {
        const colKey = columns[i];
        const colLabel = columnInfo[colKey]?.label || '';
        
        if (colLabel.toLowerCase().includes('account') && colLabel.toLowerCase().includes('id')) {
          accountId = cell.value;
        }
        if (colLabel.toLowerCase() === 'account name' || colLabel.toLowerCase() === 'account') {
          accountName = cell.label || cell.value;
        }
      });
      
      if (email && accountId) {
        emailToAccount[email.toLowerCase()] = { sfdcAccountId: accountId, accountName };
      }
    });
    
    console.log(`\nExtracted ${Object.keys(emailToAccount).length} email-to-account mappings`);
    
    // Save mapping
    const fs = await import('fs');
    fs.writeFileSync('/tmp/ping_contact_account_mapping.json', JSON.stringify(emailToAccount, null, 2));
    console.log('Mapping saved to /tmp/ping_contact_account_mapping.json');
  }
}

main().catch(console.error);
