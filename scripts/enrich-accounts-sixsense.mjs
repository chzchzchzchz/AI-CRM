import mysql from 'mysql2/promise';

const SIXSENSE_API_KEY = process.env.SIXSENSE_API_KEY;
const SIXSENSE_API_URL = "https://epsilon.6sense.com/v3/company/details";

async function getCompanyByDomain(domain) {
  if (!SIXSENSE_API_KEY) {
    console.warn("[6sense] API key not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${SIXSENSE_API_URL}?domain=${encodeURIComponent(domain)}`,
      {
        headers: {
          Authorization: `Token ${SIXSENSE_API_KEY}`,
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error(`[6sense] API error for ${domain}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[6sense] Failed for ${domain}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("Starting 6sense enrichment for Ping accounts...");
  
  if (!SIXSENSE_API_KEY) {
    console.error("SIXSENSE_API_KEY not set!");
    process.exit(1);
  }
  
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  // Get all accounts needing enrichment
  const [accounts] = await conn.execute(`
    SELECT id, name, domain 
    FROM accounts 
    WHERE domain IS NOT NULL AND domain != ''
    AND (intentScore IS NULL OR intentScore = 0)
    ORDER BY id
  `);
  
  console.log(`Found ${accounts.length} accounts to enrich`);
  
  let enriched = 0;
  let failed = 0;
  let noMatch = 0;
  
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    
    // Rate limiting - 6sense allows ~100 requests/minute
    if (i > 0 && i % 50 === 0) {
      console.log(`Progress: ${i}/${accounts.length} (enriched: ${enriched}, no match: ${noMatch}, failed: ${failed})`);
      await new Promise(r => setTimeout(r, 1000)); // Brief pause every 50 requests
    }
    
    try {
      const data = await getCompanyByDomain(account.domain);
      
      if (!data || !data.company) {
        noMatch++;
        continue;
      }
      
      // Update account with 6sense data
      await conn.execute(`
        UPDATE accounts SET
          intentScore = ?,
          sixsenseBuyingStage = ?,
          sixsenseProfileFit = ?,
          sixsenseSegments = ?,
          sixsenseId = ?,
          industry = COALESCE(industry, ?),
          employeeCount = COALESCE(employeeCount, ?),
          location = COALESCE(location, ?),
          lastSixsenseSync = NOW()
        WHERE id = ?
      `, [
        data.intent_score || 0,
        data.buying_stage || null,
        data.profile_fit || null,
        data.segments ? JSON.stringify(data.segments) : null,
        data.company.companyId || null,
        data.company.industry || null,
        data.company.employee_count || null,
        data.company.city && data.company.state ? `${data.company.city}, ${data.company.state}` : null,
        account.id
      ]);
      
      enriched++;
      
      if (data.intent_score > 70) {
        console.log(`  ✓ ${account.name}: Intent ${data.intent_score}, Stage: ${data.buying_stage}`);
      }
    } catch (error) {
      console.error(`  ✗ ${account.name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\\n=== Enrichment Complete ===`);
  console.log(`Total accounts: ${accounts.length}`);
  console.log(`Enriched: ${enriched}`);
  console.log(`No match: ${noMatch}`);
  console.log(`Failed: ${failed}`);
  
  // Show top accounts by intent score
  const [topAccounts] = await conn.execute(`
    SELECT name, domain, intentScore, sixsenseBuyingStage 
    FROM accounts 
    WHERE intentScore > 0 
    ORDER BY intentScore DESC 
    LIMIT 10
  `);
  
  console.log(`\\n=== Top 10 Accounts by Intent Score ===`);
  topAccounts.forEach((a, i) => {
    console.log(`${i + 1}. ${a.name} (${a.domain}): ${a.intentScore} - ${a.sixsenseBuyingStage}`);
  });
  
  await conn.end();
}

main().catch(console.error);
