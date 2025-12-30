import mysql from 'mysql2/promise';

// Expanded industry mappings
const industryMappings = {
  // Professional Services
  'bdo': 'Professional Services',
  'axiom law': 'Legal Services',
  'thomson reuters': 'Professional Services',
  
  // Tech/Software
  'rubrik': 'Software',
  'quick base': 'Software',
  'alkami': 'Software',
  'verifone': 'Financial Technology',
  'upstart': 'Financial Technology',
  'planet': 'Software',
  'pros': 'Software',
  'sofi': 'Financial Technology',
  'alteryx': 'Software',
  'sas': 'Software',
  'quicken loans': 'Financial Services',
  'trans union': 'Financial Services',
  'waystar': 'Healthcare Technology',
  'lyft': 'Transportation',
  'applovin': 'Software',
  'freshworks': 'Software',
  'hubspot': 'Software',
  'infor': 'Software',
  'athene': 'Insurance',
  'coinbase': 'Financial Technology',
  'frontier airlines': 'Airlines',
  'verkada': 'Software',
  'plaid': 'Financial Technology',
  'lightspeed': 'Software',
  'guidewire': 'Software',
  'progress software': 'Software',
  'betterment': 'Financial Technology',
  'gong': 'Software',
  '7-eleven': 'Retail',
  'certinia': 'Software',
  'brex': 'Financial Technology',
  'blue prism': 'Software',
  'whirlpool': 'Manufacturing',
  'vf corporation': 'Retail/Apparel',
  'victoria\'s secret': 'Retail',
  'benchling': 'Software',
  'enverus': 'Software',
  'express': 'Retail',
  'insurity': 'Software',
  'square': 'Financial Technology',
  'auctane': 'Software',
  'jack henry': 'Software',
  'recurly': 'Software',
  'khoros': 'Software',
  'grammarly': 'Software',
  'klaviyo': 'Software',
  'hyland': 'Software',
  'aurea': 'Software',
  'freenome': 'Healthcare/Biotech',
  'aveva': 'Software',
  'ameritas': 'Insurance',
  'cargill': 'Agriculture',
  'launchdarkly': 'Software',
  'grubhub': 'Food Delivery',
  'sysco': 'Food Distribution',
  'apollo': 'Financial Services',
  'ansys': 'Software',
  'sigma computing': 'Software',
  'helmerich': 'Energy',
  'galaxy': 'Financial Services',
  'qualtrics': 'Software',
  'socure': 'Software',
  'epicor': 'Software',
  'tradeshift': 'Software',
  'floqast': 'Software',
  'langchain': 'Artificial Intelligence',
  'seamless.ai': 'Software',
  'postman': 'Software',
  'poppulo': 'Software',
  'cloudflare': 'Software',
  'valero': 'Energy',
  'algolia': 'Software',
  'isolved': 'Software',
  'tipalti': 'Software',
  'workato': 'Software',
  'lending tree': 'Financial Services',
  'jellyfish': 'Software',
  'xoxoday': 'Software',
  'astronomer': 'Software',
  'toro company': 'Manufacturing',
  'raising cane': 'Restaurant',
  'rithum': 'Software',
  'amedisys': 'Healthcare',
  'cision': 'Software',
  
  // Retail
  'h-e-b': 'Retail',
  'wendy\'s': 'Restaurant',
  'ulta beauty': 'Retail',
  'safelite': 'Automotive Services',
  'abc supply': 'Distribution',
  'bath & body': 'Retail',
  
  // Media
  'scripps': 'Media & Entertainment',
  
  // Transportation
  'schneider': 'Transportation/Logistics',
  'enterprise mobility': 'Transportation',
  'enterprise': 'Transportation',
  
  // Finance
  'wescom': 'Financial Services',
};

async function enrichIndustries() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    const [accounts] = await connection.execute(
      "SELECT id, name FROM accounts WHERE industry IS NULL OR industry = 'Unknown' OR industry = ''"
    );
    
    console.log(`Found ${accounts.length} accounts with Unknown industry`);
    
    let updated = 0;
    
    for (const account of accounts) {
      const nameLower = account.name.toLowerCase();
      
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
    
    const [remaining] = await connection.execute(
      "SELECT COUNT(*) as count FROM accounts WHERE industry IS NULL OR industry = 'Unknown' OR industry = ''"
    );
    console.log(`Remaining Unknown: ${remaining[0].count}`);
    
  } finally {
    await connection.end();
  }
}

enrichIndustries().catch(console.error);
