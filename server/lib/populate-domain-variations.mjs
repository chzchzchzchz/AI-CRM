import Database from '../../node_modules/better-sqlite3/lib/index.js';

/**
 * Domain Matching Utilities (duplicated for .mjs file)
 */
function extractDomainFromUrl(url) {
  if (!url) return null;
  try {
    const cleaned = url.toLowerCase().trim();
    const withProtocol = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
    const urlObj = new URL(withProtocol);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    const match = url.toLowerCase().match(/(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z0-9.-]+)/i);
    return match ? match[1] : null;
  }
}

function normalizeDomain(domain) {
  if (!domain) return null;
  return domain.toLowerCase().trim().replace(/^www\./, '');
}

function getKnownCompanyVariations(companyName) {
  const name = companyName.toLowerCase();
  const variations = [];
  
  // UKG / Ultimate Software / Kronos
  if (name.includes('ultimate') || name.includes('ukg') || name.includes('kronos')) {
    variations.push('ultimatesoftware.com', 'ukg.com', 'kronos.com');
  }
  
  // Stryker
  if (name.includes('stryker')) {
    variations.push('stryker.com', 'stryker.co.uk', 'stryker.eu');
  }
  
  // HSBC
  if (name.includes('hsbc')) {
    variations.push('hsbc.com', 'hsbc.co.uk', 'hsbc.com.hk');
  }
  
  // Databricks
  if (name.includes('databricks')) {
    variations.push('databricks.com');
  }
  
  // JPMorgan Chase
  if (name.includes('jpmorgan') || name.includes('chase')) {
    variations.push('jpmorganchase.com', 'chase.com', 'jpmorgan.com');
  }
  
  // Bank of America
  if (name.includes('bank of america') || name.includes('bofa')) {
    variations.push('bankofamerica.com', 'bofa.com', 'baml.com');
  }
  
  // Wells Fargo
  if (name.includes('wells fargo')) {
    variations.push('wellsfargo.com', 'wf.com');
  }
  
  // Citigroup / Citibank
  if (name.includes('citi')) {
    variations.push('citigroup.com', 'citi.com', 'citibank.com');
  }
  
  // Goldman Sachs
  if (name.includes('goldman')) {
    variations.push('gs.com', 'goldmansachs.com');
  }
  
  // Morgan Stanley
  if (name.includes('morgan stanley')) {
    variations.push('morganstanley.com', 'ms.com');
  }
  
  // Salesforce
  if (name.includes('salesforce')) {
    variations.push('salesforce.com', 'force.com');
  }
  
  // Oracle
  if (name.includes('oracle')) {
    variations.push('oracle.com');
  }
  
  // SAP
  if (name.includes('sap')) {
    variations.push('sap.com');
  }
  
  // Workday
  if (name.includes('workday')) {
    variations.push('workday.com');
  }
  
  // ServiceNow
  if (name.includes('servicenow')) {
    variations.push('servicenow.com');
  }
  
  return variations;
}

function generateDomainVariations(primaryDomain, website, name) {
  const variations = new Set();
  
  // Add primary domain
  if (primaryDomain) {
    const normalized = normalizeDomain(primaryDomain);
    if (normalized) variations.add(normalized);
  }
  
  // Extract from website
  if (website) {
    const extracted = extractDomainFromUrl(website);
    if (extracted) variations.add(extracted);
  }
  
  // Generate from company name
  if (name) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
    
    if (slug && slug.length > 2) {
      variations.add(`${slug}.com`);
    }
    
    // Handle known company variations
    const knownVariations = getKnownCompanyVariations(name);
    knownVariations.forEach(v => variations.add(v));
  }
  
  return Array.from(variations).filter(Boolean);
}

/**
 * Main script to populate domain variations
 */
const db = new Database('local.db');

console.log('\n=== Populating Domain Variations ===\n');

// Get all accounts
const accounts = db.prepare(`
  SELECT id, name, domain, website, linkedinUrl
  FROM accounts
`).all();

console.log(`Found ${accounts.length} accounts to process\n`);

let updated = 0;
let skipped = 0;

const updateStmt = db.prepare(`
  UPDATE accounts
  SET domainVariations = ?
  WHERE id = ?
`);

for (const account of accounts) {
  const variations = generateDomainVariations(
    account.domain,
    account.website,
    account.name
  );
  
  if (variations.length > 0) {
    updateStmt.run(JSON.stringify(variations), account.id);
    updated++;
    
    if (updated <= 10) {
      console.log(`✓ Account ${account.id}: ${account.name}`);
      console.log(`  Domain: ${account.domain || 'N/A'}`);
      console.log(`  Variations: ${variations.join(', ')}`);
      console.log('');
    }
  } else {
    skipped++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Updated: ${updated} accounts`);
console.log(`Skipped: ${skipped} accounts (no domain data)`);

db.close();
