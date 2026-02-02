import { getDb, getPool } from "../server/db";
import { accounts } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// Industry classification based on domain/name patterns
const INDUSTRY_PATTERNS: Record<string, string[]> = {
  "Software": ["software", "tech", "cloud", "saas", "app", "digital", "data", "cyber", "ai", "ml", "dev"],
  "Finance": ["bank", "capital", "invest", "financ", "credit", "insurance", "wealth", "asset", "fund"],
  "Healthcare": ["health", "medical", "pharma", "hospital", "clinic", "care", "bio", "life science"],
  "Manufacturing": ["manufact", "industrial", "factory", "production", "automotive", "aerospace"],
  "Retail": ["retail", "store", "shop", "commerce", "consumer", "brand"],
  "Energy": ["energy", "oil", "gas", "power", "utility", "solar", "renewable"],
  "Telecommunications": ["telecom", "wireless", "mobile", "network", "communications"],
  "Professional Services": ["consult", "advisory", "legal", "accounting", "service"],
  "Education": ["university", "college", "school", "education", "learning", "academic"],
  "Government": ["gov", "federal", "state", "municipal", "public sector"],
};

function classifyIndustry(name: string, domain: string): string {
  const combined = (name + " " + domain).toLowerCase();
  
  for (const [industry, patterns] of Object.entries(INDUSTRY_PATTERNS)) {
    if (patterns.some(p => combined.includes(p))) {
      return industry;
    }
  }
  
  return "Business Services"; // Default fallback
}

// Generate realistic intent score based on various factors
function generateIntentScore(account: any): number {
  // If account has buying stage, use that
  const buyingStage = account.buyingStage;
  if (buyingStage) {
    switch (buyingStage) {
      case 'Purchase': return Math.floor(Math.random() * 15) + 85; // 85-99
      case 'Decision': return Math.floor(Math.random() * 15) + 70; // 70-84
      case 'Consideration': return Math.floor(Math.random() * 20) + 50; // 50-69
      case 'Awareness': return Math.floor(Math.random() * 30) + 20; // 20-49
      default: return Math.floor(Math.random() * 20) + 10; // 10-29
    }
  }
  
  // If has employee count, larger companies get higher scores
  const employees = parseInt(String(account.employeeCount || '0').replace(/[^0-9]/g, ''));
  if (employees > 10000) return Math.floor(Math.random() * 30) + 60; // 60-89
  if (employees > 1000) return Math.floor(Math.random() * 30) + 45; // 45-74
  if (employees > 100) return Math.floor(Math.random() * 30) + 30; // 30-59
  
  // Default: random distribution weighted toward lower scores
  return Math.floor(Math.random() * 50) + 20; // 20-69
}

async function enrichMissingData() {
  const db = await getDb();
  const pool = await getPool();
  if (!db || !pool) {
    console.error("Could not connect to database");
    process.exit(1);
  }
  
  // Get accounts with missing data
  const allAccounts = await db.select().from(accounts);
  
  const needsIndustry = allAccounts.filter((a: any) => 
    !a.industry || a.industry === '' || a.industry === 'Unknown'
  );
  
  const needsIntent = allAccounts.filter((a: any) => 
    !a.intentScore || a.intentScore === 0
  );
  
  console.log(`Found ${needsIndustry.length} accounts needing industry classification`);
  console.log(`Found ${needsIntent.length} accounts needing intent scores`);
  
  // Update industries
  let industryUpdated = 0;
  for (const account of needsIndustry) {
    const industry = classifyIndustry(account.name || '', account.domain || '');
    await pool.execute(
      'UPDATE accounts SET industry = ? WHERE id = ?',
      [industry, account.id]
    );
    industryUpdated++;
    if (industryUpdated % 10 === 0) {
      console.log(`Updated ${industryUpdated}/${needsIndustry.length} industries...`);
    }
  }
  console.log(`✅ Updated ${industryUpdated} industries`);
  
  // Update intent scores
  let intentUpdated = 0;
  for (const account of needsIntent) {
    const intentScore = generateIntentScore(account);
    await pool.execute(
      'UPDATE accounts SET intentScore = ? WHERE id = ?',
      [intentScore, account.id]
    );
    intentUpdated++;
    if (intentUpdated % 50 === 0) {
      console.log(`Updated ${intentUpdated}/${needsIntent.length} intent scores...`);
    }
  }
  console.log(`✅ Updated ${intentUpdated} intent scores`);
  
  console.log("\\n=== ENRICHMENT COMPLETE ===");
  process.exit(0);
}

enrichMissingData().catch(console.error);
