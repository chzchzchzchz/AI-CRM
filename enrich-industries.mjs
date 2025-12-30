import mysql from 'mysql2/promise';

// Industry mappings based on company names
const industryMappings = {
  // Tech/Software
  'paypal': 'Financial Technology',
  'gitlab': 'Software',
  'epam': 'IT Services/Consulting',
  'atlassian': 'Software',
  'stripe': 'Financial Technology',
  'box': 'Software',
  'robinhood': 'Financial Technology',
  'clickup': 'Software',
  'cloudera': 'Software',
  'openai': 'Artificial Intelligence',
  'amplitude': 'Software',
  'procore': 'Software',
  'pendo': 'Software',
  'sprinklr': 'Software',
  'workiva': 'Software',
  'five9': 'Software',
  'kroger': 'Retail',
  'xerox': 'Technology',
  'stryker': 'Healthcare/Medical Devices',
  'gilead': 'Pharmaceuticals',
  'synopsys': 'Software/Semiconductors',
  'ally': 'Financial Services',
  'arrow': 'Technology Distribution',
  'thoughtspot': 'Software',
  'ball corporation': 'Manufacturing',
  'reveal': 'Software',
  'brunswick': 'Manufacturing',
  'brightedge': 'Software',
  'realpage': 'Software',
  'enova': 'Financial Services',
  'baker tilly': 'Professional Services',
  'sprout social': 'Software',
  'grainger': 'Industrial Distribution',
  'sherwin-williams': 'Manufacturing',
  'flextronics': 'Manufacturing',
  'verint': 'Software',
  'gallagher': 'Insurance',
  'cdk global': 'Software',
  'kwik trip': 'Retail',
  'bloomreach': 'Software',
  'calabrio': 'Software',
  'baxter planning': 'Software',
  'generac': 'Manufacturing',
  'sift': 'Software',
  'soundhound': 'Artificial Intelligence',
  'shamrock foods': 'Food Distribution',
  'bonterra': 'Software',
  'us foods': 'Food Distribution',
  'stater bros': 'Retail',
  'levi strauss': 'Retail/Apparel',
  'abbyy': 'Software',
  'keller williams': 'Real Estate',
  'cleveland clinic': 'Healthcare',
  'ultimate software': 'Software',
  'fiserv': 'Financial Technology',
  'waste management': 'Environmental Services',
  'rsm': 'Professional Services',
  'general motors financial': 'Financial Services',
  'western & southern': 'Insurance',
  'diebold': 'Technology',
  'rate': 'Financial Services',
  'kohl': 'Retail',
  'hsbc': 'Financial Services',
  'pegasystems': 'Software',
  'servicenow': 'Software',
  'docker': 'Software',
  'couchbase': 'Software',
  'pagerduty': 'Software',
};

async function enrichIndustries() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Get all accounts with Unknown industry
    const [accounts] = await connection.execute(
      "SELECT id, name FROM accounts WHERE industry IS NULL OR industry = 'Unknown' OR industry = ''"
    );
    
    console.log(`Found ${accounts.length} accounts with Unknown industry`);
    
    let updated = 0;
    
    for (const account of accounts) {
      const nameLower = account.name.toLowerCase();
      
      // Try to match against our mappings
      for (const [keyword, industry] of Object.entries(industryMappings)) {
        if (nameLower.includes(keyword)) {
          await connection.execute(
            'UPDATE accounts SET industry = ? WHERE id = ?',
            [industry, account.id]
          );
          console.log(`Updated ${account.name} -> ${industry}`);
          updated++;
          break;
        }
      }
    }
    
    console.log(`\nUpdated ${updated} accounts with inferred industries`);
    
    // Check remaining Unknown
    const [remaining] = await connection.execute(
      "SELECT COUNT(*) as count FROM accounts WHERE industry IS NULL OR industry = 'Unknown' OR industry = ''"
    );
    console.log(`Remaining Unknown: ${remaining[0].count}`);
    
  } finally {
    await connection.end();
  }
}

enrichIndustries().catch(console.error);
