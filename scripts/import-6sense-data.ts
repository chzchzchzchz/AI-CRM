// Example 6sense import script.
//
// This shows HOW to load 6sense intent/buying-stage/keyword/6QA metrics into the
// dashboard's tables. The rows below are SYNTHETIC examples — replace them with your
// own 6sense export (CSV → these arrays), then run:  npx tsx scripts/import-6sense-data.ts
//
// Nothing here is real data.
import { getDb } from "../server/_core/db.js";
import {
  sixsenseKeywords,
  sixsenseBuyingStageMetrics,
  sixsenseEngagementMetrics,
  sixsense6QAPerformance,
} from "../drizzle/schema.js";

const DATA_AS_OF = new Date("2025-01-15");

// Buying-stage counts per week (example)
const buyingStageData = [
  { timeframe: "Jan 6 - 12, 2025", buyingStage: "Target", numberOfAccounts: 120 },
  { timeframe: "Jan 6 - 12, 2025", buyingStage: "Awareness", numberOfAccounts: 90 },
  { timeframe: "Jan 6 - 12, 2025", buyingStage: "Consideration", numberOfAccounts: 60 },
  { timeframe: "Jan 6 - 12, 2025", buyingStage: "Decision", numberOfAccounts: 30 },
  { timeframe: "Jan 6 - 12, 2025", buyingStage: "Purchase", numberOfAccounts: 10 },
];

// Engagement states per week (example)
const engagementData = [
  { timeWindow: "Jan 6 - 12, 2025", engagementState: "No Engagement", accounts: 200 },
  { timeWindow: "Jan 6 - 12, 2025", engagementState: "Intent", accounts: 150 },
  { timeWindow: "Jan 6 - 12, 2025", engagementState: "Anonymous Website Visit", accounts: 50 },
  { timeWindow: "Jan 6 - 12, 2025", engagementState: "Known Engagement", accounts: 40 },
  { timeWindow: "Jan 6 - 12, 2025", engagementState: "Opps Created", accounts: 5 },
  { timeWindow: "Jan 6 - 12, 2025", engagementState: "Opps Won", accounts: 2 },
];

// Top intent keywords by account volume (example — swap in your own category & keywords)
const keywordsData = [
  { keyword: "example keyword one", totalAccounts: 500, accountsWithWebVisits: 300, accountsWith6QA: 350, accountsWithOpportunities: 12, accountsWithRelevantOpportunities: 10, category: "product" },
  { keyword: "example keyword two", totalAccounts: 420, accountsWithWebVisits: 250, accountsWith6QA: 300, accountsWithOpportunities: 9, accountsWithRelevantOpportunities: 8, category: "general" },
  { keyword: "example competitor", totalAccounts: 300, accountsWithWebVisits: 180, accountsWith6QA: 210, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 6, category: "competitor" },
  { keyword: "example compliance term", totalAccounts: 200, accountsWithWebVisits: 120, accountsWith6QA: 140, accountsWithOpportunities: 4, accountsWithRelevantOpportunities: 4, category: "compliance" },
];

// Daily 6QA performance (example)
const performanceData = [
  { day: "2025-01-14", total6QAs: 300, new6QAs: 8, worked: 90, unworked: 210, avgSalesActivities: 4.2, avgContactsReached: 1.6, avgDaysToFirstActivity: 12.0, avgDaysSinceLastActivity: 7.0 },
  { day: "2025-01-13", total6QAs: 295, new6QAs: 6, worked: 88, unworked: 207, avgSalesActivities: 4.1, avgContactsReached: 1.6, avgDaysToFirstActivity: 12.2, avgDaysSinceLastActivity: 7.2 },
];

async function importData() {
  const db = getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  console.log("Importing example 6sense data...");

  console.log("Importing buying stage metrics...");
  for (const row of buyingStageData) {
    await db.insert(sixsenseBuyingStageMetrics).values({ ...row, dataAsOf: DATA_AS_OF });
  }
  console.log(`Imported ${buyingStageData.length} buying stage records`);

  console.log("Importing engagement metrics...");
  for (const row of engagementData) {
    await db.insert(sixsenseEngagementMetrics).values({ ...row, dataAsOf: DATA_AS_OF });
  }
  console.log(`Imported ${engagementData.length} engagement records`);

  console.log("Importing keyword performance...");
  for (const row of keywordsData) {
    await db.insert(sixsenseKeywords).values({ ...row, dataAsOf: DATA_AS_OF });
  }
  console.log(`Imported ${keywordsData.length} keyword records`);

  console.log("Importing 6QA performance...");
  for (const row of performanceData) {
    await db.insert(sixsense6QAPerformance).values({
      day: new Date(row.day),
      total6QAs: row.total6QAs,
      new6QAs: row.new6QAs,
      worked: row.worked,
      unworked: row.unworked,
      avgSalesActivities: row.avgSalesActivities.toString(),
      avgContactsReached: row.avgContactsReached.toString(),
      avgDaysToFirstActivity: row.avgDaysToFirstActivity.toString(),
      avgDaysSinceLastActivity: row.avgDaysSinceLastActivity.toString(),
      dataAsOf: DATA_AS_OF,
    });
  }
  console.log(`Imported ${performanceData.length} 6QA performance records`);

  console.log("Done!");
}

importData().catch(console.error);
