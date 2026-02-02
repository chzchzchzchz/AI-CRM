// Using native fetch (Node.js 18+)

const SALESFORCE_INSTANCE_URL = process.env.SALESFORCE_INSTANCE_URL;
const SALESFORCE_CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const SALESFORCE_CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET;

async function getAccessToken() {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SALESFORCE_CLIENT_ID,
    client_secret: SALESFORCE_CLIENT_SECRET,
  });

  const response = await fetch(`${SALESFORCE_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getReportData(reportId, accessToken) {
  const response = await fetch(
    `${SALESFORCE_INSTANCE_URL}/services/data/v59.0/analytics/reports/${reportId}?includeDetails=true`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Report fetch failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  console.log('Getting Salesforce access token...');
  const accessToken = await getAccessToken();
  console.log('Access token obtained');

  // Query the Ping contacts report
  const reportId = '00OUI00000GUCQj2AP';
  console.log(`\nFetching report ${reportId}...`);
  const result = await getReportData(reportId, accessToken);

  // Check column info
  console.log('\n=== REPORT COLUMNS ===');
  const colInfo = result.reportExtendedMetadata?.detailColumnInfo || {};
  const colKeys = Object.keys(colInfo);
  colKeys.forEach((key, i) => {
    console.log(`${i}: ${key} => ${colInfo[key].label}`);
  });

  // Get first few rows to see the data
  console.log('\n=== SAMPLE ROW DATA ===');
  const rows = result.factMap?.['T!T']?.rows || [];
  console.log(`Total rows: ${rows.length}`);
  
  if (rows.length > 0) {
    // Map column keys to indices
    const detailColumns = result.reportMetadata?.detailColumns || [];
    console.log('\nDetail columns order:', detailColumns);
    
    // Show first 3 rows with all data
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`\n--- Row ${i + 1} ---`);
      const cells = rows[i].dataCells || [];
      cells.forEach((cell, j) => {
        const colKey = detailColumns[j];
        const colLabel = colInfo[colKey]?.label || colKey;
        console.log(`  ${colLabel}: ${cell.label || cell.value}`);
      });
    }
  }
}

main().catch(console.error);
