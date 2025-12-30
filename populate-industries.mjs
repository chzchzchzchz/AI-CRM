import mysql from 'mysql2/promise';
import fs from 'fs';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Read the CSV file
  const csvPath = '/home/ubuntu/target-account-dashboard/SFDC-Final-Target-Accounts-Default-view-export-1764061853259.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');
  
  // Parse CSV - industry is in column 4 (index 3)
  const industryByDomain = new Map();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing - handle quoted fields
    const fields = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    
    // Fields: [0]=name, [1]=domain, [2]=region, [3]=industry
    const domain = fields[1]?.toLowerCase().replace(/"/g, '');
    const industry = fields[3]?.replace(/"/g, '');
    
    if (domain && industry && industry !== 'Unknown' && industry.length > 0) {
      industryByDomain.set(domain, industry);
    }
  }
  
  console.log(`Found ${industryByDomain.size} industries from CSV`);
  
  // Get accounts with Unknown industry
  const [unknownAccounts] = await conn.execute(
    'SELECT id, domain FROM accounts WHERE industry = "Unknown" OR industry IS NULL'
  );
  
  console.log(`Found ${unknownAccounts.length} accounts with Unknown industry`);
  
  let updated = 0;
  for (const account of unknownAccounts) {
    const domain = account.domain?.toLowerCase();
    if (domain && industryByDomain.has(domain)) {
      const industry = industryByDomain.get(domain);
      await conn.execute(
        'UPDATE accounts SET industry = ? WHERE id = ?',
        [industry, account.id]
      );
      updated++;
    }
  }
  
  console.log(`Updated ${updated} accounts with industry data`);
  
  // Also try to infer industry from company name for well-known companies
  const knownIndustries = {
    'nvidia': 'Technology',
    'microsoft': 'Technology',
    'google': 'Technology',
    'amazon': 'Technology',
    'apple': 'Technology',
    'meta': 'Technology',
    'facebook': 'Technology',
    'salesforce': 'Technology',
    'oracle': 'Technology',
    'ibm': 'Technology',
    'cisco': 'Technology',
    'intel': 'Technology',
    'amd': 'Technology',
    'dell': 'Technology',
    'hp': 'Technology',
    'vmware': 'Technology',
    'servicenow': 'Technology',
    'workday': 'Technology',
    'splunk': 'Technology',
    'crowdstrike': 'Cybersecurity',
    'palo alto': 'Cybersecurity',
    'fortinet': 'Cybersecurity',
    'okta': 'Cybersecurity',
    'zscaler': 'Cybersecurity',
    'bank': 'Financial Services',
    'capital': 'Financial Services',
    'insurance': 'Insurance',
    'healthcare': 'Healthcare',
    'hospital': 'Healthcare',
    'pharma': 'Healthcare',
    'energy': 'Energy',
    'oil': 'Energy',
    'gas': 'Energy',
    'retail': 'Retail',
    'manufacturing': 'Manufacturing',
    'automotive': 'Automotive',
    'aerospace': 'Aerospace & Defense',
    'defense': 'Aerospace & Defense',
    'telecom': 'Telecommunications',
    'media': 'Media & Entertainment',
    'entertainment': 'Media & Entertainment',
    'education': 'Education',
    'university': 'Education',
    'government': 'Government',
    'consulting': 'Professional Services',
    'accenture': 'Professional Services',
    'deloitte': 'Professional Services',
    'kpmg': 'Professional Services',
    'pwc': 'Professional Services',
    'ey': 'Professional Services',
    'ernst': 'Professional Services',
  };
  
  const [stillUnknown] = await conn.execute(
    'SELECT id, name FROM accounts WHERE industry = "Unknown" OR industry IS NULL'
  );
  
  let inferredCount = 0;
  for (const account of stillUnknown) {
    const nameLower = account.name?.toLowerCase() || '';
    for (const [keyword, industry] of Object.entries(knownIndustries)) {
      if (nameLower.includes(keyword)) {
        await conn.execute(
          'UPDATE accounts SET industry = ? WHERE id = ?',
          [industry, account.id]
        );
        inferredCount++;
        break;
      }
    }
  }
  
  console.log(`Inferred ${inferredCount} industries from company names`);
  
  await conn.end();
}

main().catch(console.error);
