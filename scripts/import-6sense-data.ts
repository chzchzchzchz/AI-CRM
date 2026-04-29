import { getDb } from "../server/_core/db.js";
import {
  sixsense6QA,
  sixsenseKeywords,
  sixsenseBuyingStageMetrics,
  sixsenseEngagementMetrics,
  sixsense6QAPerformance,
} from "../drizzle/schema.js";

const DATA_AS_OF = new Date("2025-12-15");

// Buying Stage data from CSV
const buyingStageData = [
  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Target", numberOfAccounts: 147 },
  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Awareness", numberOfAccounts: 117 },
  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Consideration", numberOfAccounts: 659 },
  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Decision", numberOfAccounts: 475 },
  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Purchase", numberOfAccounts: 180 },
  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Target", numberOfAccounts: 151 },
  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Awareness", numberOfAccounts: 116 },
  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Consideration", numberOfAccounts: 627 },
  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Decision", numberOfAccounts: 476 },
  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Purchase", numberOfAccounts: 208 },
];

// Engagement data from CSV
const engagementData = [
  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "No Engagement", accounts: 259 },
  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Intent", accounts: 1315 },
  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Anonymous Website Visit", accounts: 60 },
  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Known Engagement", accounts: 101 },
  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Opps Created", accounts: 0 },
  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Opps Won", accounts: 0 },
  { timeWindow: "Nov 23 - 29, 2025", engagementState: "No Engagement", accounts: 231 },
  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Intent", accounts: 1345 },
  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Anonymous Website Visit", accounts: 48 },
  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Known Engagement", accounts: 20 },
  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Opps Created", accounts: 0 },
  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Opps Won", accounts: 0 },
];

// Top keywords from CSV (top 50 by account volume)
const keywordsData = [
  { keyword: "Ransomware", totalAccounts: 1313, accountsWithWebVisits: 774, accountsWith6QA: 882, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "threat" },
  { keyword: "Phishing", totalAccounts: 1302, accountsWithWebVisits: 755, accountsWith6QA: 865, accountsWithOpportunities: 15, accountsWithRelevantOpportunities: 14, category: "threat" },
  { keyword: "[redacted-event]", totalAccounts: 1213, accountsWithWebVisits: 434, accountsWith6QA: 653, accountsWithOpportunities: 9, accountsWithRelevantOpportunities: 9, category: "event" },
  { keyword: "NIST", totalAccounts: 1179, accountsWithWebVisits: 556, accountsWith6QA: 709, accountsWithOpportunities: 11, accountsWithRelevantOpportunities: 10, category: "compliance" },
  { keyword: "security first", totalAccounts: 1174, accountsWithWebVisits: 538, accountsWith6QA: 712, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "general" },
  { keyword: "secure authentication", totalAccounts: 1140, accountsWithWebVisits: 624, accountsWith6QA: 749, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "product" },
  { keyword: "two factor authentication", totalAccounts: 1123, accountsWithWebVisits: 692, accountsWith6QA: 775, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "product" },
  { keyword: "Security Training", totalAccounts: 1080, accountsWithWebVisits: 688, accountsWith6QA: 778, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "general" },
  { keyword: "device security", totalAccounts: 1063, accountsWithWebVisits: 665, accountsWith6QA: 764, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
  { keyword: "Secure access", totalAccounts: 1037, accountsWithWebVisits: 637, accountsWith6QA: 728, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
  { keyword: "MFA", totalAccounts: 1029, accountsWithWebVisits: 601, accountsWith6QA: 712, accountsWithOpportunities: 15, accountsWithRelevantOpportunities: 14, category: "product" },
  { keyword: "passkey", totalAccounts: 1029, accountsWithWebVisits: 657, accountsWith6QA: 752, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "product" },
  { keyword: "authenticator", totalAccounts: 1028, accountsWithWebVisits: 641, accountsWith6QA: 736, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
  { keyword: "tpm", totalAccounts: 1001, accountsWithWebVisits: 418, accountsWith6QA: 606, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "product" },
  { keyword: "auth0", totalAccounts: 981, accountsWithWebVisits: 498, accountsWith6QA: 655, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "competitor" },
  { keyword: "access management", totalAccounts: 922, accountsWithWebVisits: 564, accountsWith6QA: 649, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
  { keyword: "identity security", totalAccounts: 907, accountsWithWebVisits: 502, accountsWith6QA: 621, accountsWithOpportunities: 12, accountsWithRelevantOpportunities: 11, category: "product" },
  { keyword: "FIDO", totalAccounts: 884, accountsWithWebVisits: 506, accountsWith6QA: 579, accountsWithOpportunities: 11, accountsWithRelevantOpportunities: 10, category: "product" },
  { keyword: "Zscaler", totalAccounts: 854, accountsWithWebVisits: 480, accountsWith6QA: 581, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "competitor" },
  { keyword: "2FA", totalAccounts: 832, accountsWithWebVisits: 350, accountsWith6QA: 533, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
  { keyword: "[redacted-threat]", totalAccounts: 776, accountsWithWebVisits: 409, accountsWith6QA: 563, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "threat" },
  { keyword: "Passwordless", totalAccounts: 751, accountsWithWebVisits: 510, accountsWith6QA: 584, accountsWithOpportunities: 12, accountsWithRelevantOpportunities: 11, category: "product" },
  { keyword: "service identity", totalAccounts: 739, accountsWithWebVisits: 366, accountsWith6QA: 448, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
  { keyword: "Identity Management", totalAccounts: 731, accountsWithWebVisits: 460, accountsWith6QA: 530, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
  { keyword: "[redacted-threat]", totalAccounts: 713, accountsWithWebVisits: 378, accountsWith6QA: 479, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "threat" },
  { keyword: "NHI", totalAccounts: 612, accountsWithWebVisits: 346, accountsWith6QA: 414, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "product" },
  { keyword: "ai security", totalAccounts: 587, accountsWithWebVisits: 55, accountsWith6QA: 44, accountsWithOpportunities: 0, accountsWithRelevantOpportunities: 0, category: "general" },
  { keyword: "Intune", totalAccounts: 551, accountsWithWebVisits: 241, accountsWith6QA: 327, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "competitor" },
  { keyword: "Account Takeover", totalAccounts: 549, accountsWithWebVisits: 333, accountsWith6QA: 385, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "threat" },
  { keyword: "zero trust security", totalAccounts: 540, accountsWithWebVisits: 307, accountsWith6QA: 345, accountsWithOpportunities: 11, accountsWithRelevantOpportunities: 11, category: "product" },
  { keyword: "man in the middle", totalAccounts: 535, accountsWithWebVisits: 310, accountsWith6QA: 389, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "threat" },
  { keyword: "secure login", totalAccounts: 535, accountsWithWebVisits: 334, accountsWith6QA: 386, accountsWithOpportunities: 9, accountsWithRelevantOpportunities: 9, category: "product" },
  { keyword: "device key", totalAccounts: 552, accountsWithWebVisits: 307, accountsWith6QA: 347, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "product" },
  { keyword: "identity risk", totalAccounts: 497, accountsWithWebVisits: 247, accountsWith6QA: 319, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "product" },
  { keyword: "CMMC", totalAccounts: 476, accountsWithWebVisits: 190, accountsWith6QA: 260, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "compliance" },
  { keyword: "Multifactor authentication", totalAccounts: 457, accountsWithWebVisits: 311, accountsWith6QA: 347, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 7, category: "product" },
  { keyword: "Entra ID", totalAccounts: 444, accountsWithWebVisits: 246, accountsWith6QA: 311, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "competitor" },
  { keyword: "process identity", totalAccounts: 429, accountsWithWebVisits: 211, accountsWith6QA: 271, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "product" },
  { keyword: "Secure Work", totalAccounts: 417, accountsWithWebVisits: 231, accountsWith6QA: 294, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
  { keyword: "Cyber Risk Management", totalAccounts: 401, accountsWithWebVisits: 290, accountsWith6QA: 301, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 6, category: "general" },
  { keyword: "Microsoft Entra ID", totalAccounts: 400, accountsWithWebVisits: 225, accountsWith6QA: 282, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "competitor" },
  { keyword: "Credential Stuffing", totalAccounts: 383, accountsWithWebVisits: 241, accountsWith6QA: 281, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "threat" },
  { keyword: "access identity management", totalAccounts: 383, accountsWithWebVisits: 201, accountsWith6QA: 237, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "product" },
  { keyword: "passwordless authentication", totalAccounts: 367, accountsWithWebVisits: 265, accountsWith6QA: 291, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
  { keyword: "{COMPANY_NAME}", totalAccounts: 349, accountsWithWebVisits: 244, accountsWith6QA: 267, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "brand" },
  { keyword: "endpoint protection", totalAccounts: 336, accountsWithWebVisits: 207, accountsWith6QA: 231, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "product" },
  { keyword: "identity platform", totalAccounts: 331, accountsWithWebVisits: 197, accountsWith6QA: 219, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
  { keyword: "Cyber Liability Insurance", totalAccounts: 328, accountsWithWebVisits: 198, accountsWith6QA: 237, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "compliance" },
  { keyword: "trusted platform module", totalAccounts: 307, accountsWithWebVisits: 166, accountsWith6QA: 205, accountsWithOpportunities: 3, accountsWithRelevantOpportunities: 3, category: "product" },
  { keyword: "strong authentication", totalAccounts: 293, accountsWithWebVisits: 177, accountsWith6QA: 193, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "product" },
];

// 6QA Performance data (daily metrics)
const performanceData = [
  { day: "2025-12-14", total6QAs: 668, new6QAs: 12, worked: 101, unworked: 567, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.8, avgDaysSinceLastActivity: 9.9 },
  { day: "2025-12-13", total6QAs: 669, new6QAs: 5, worked: 104, unworked: 565, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.6, avgDaysSinceLastActivity: 9.6 },
  { day: "2025-12-12", total6QAs: 670, new6QAs: 6, worked: 105, unworked: 565, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.6, avgDaysSinceLastActivity: 8.6 },
  { day: "2025-12-11", total6QAs: 677, new6QAs: 12, worked: 106, unworked: 571, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.6, avgDaysSinceLastActivity: 7.9 },
  { day: "2025-12-10", total6QAs: 679, new6QAs: 4, worked: 112, unworked: 567, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 16.2, avgDaysSinceLastActivity: 7.3 },
  { day: "2025-12-09", total6QAs: 681, new6QAs: 6, worked: 109, unworked: 572, avgSalesActivities: 5.3, avgContactsReached: 1.8, avgDaysToFirstActivity: 15.7, avgDaysSinceLastActivity: 6.7 },
  { day: "2025-12-08", total6QAs: 682, new6QAs: 5, worked: 92, unworked: 590, avgSalesActivities: 5.4, avgContactsReached: 1.7, avgDaysToFirstActivity: 13.2, avgDaysSinceLastActivity: 9.2 },
  { day: "2025-12-07", total6QAs: 684, new6QAs: 6, worked: 76, unworked: 608, avgSalesActivities: 6.0, avgContactsReached: 1.8, avgDaysToFirstActivity: 10.3, avgDaysSinceLastActivity: 13.3 },
  { day: "2025-12-06", total6QAs: 686, new6QAs: 13, worked: 76, unworked: 610, avgSalesActivities: 6.0, avgContactsReached: 1.8, avgDaysToFirstActivity: 10.3, avgDaysSinceLastActivity: 12.3 },
  { day: "2025-12-05", total6QAs: 692, new6QAs: 8, worked: 80, unworked: 612, avgSalesActivities: 5.9, avgContactsReached: 1.8, avgDaysToFirstActivity: 9.9, avgDaysSinceLastActivity: 12.9 },
];

async function importData() {
  const db = getDb();
  if (!db) {
    console.error("Database not available");
    return;
  }

  console.log("Importing 6sense data (as of Dec 15, 2025)...");

  // Import buying stage metrics
  console.log("Importing buying stage metrics...");
  for (const row of buyingStageData) {
    await db.insert(sixsenseBuyingStageMetrics).values({
      ...row,
      dataAsOf: DATA_AS_OF,
    });
  }
  console.log(`Imported ${buyingStageData.length} buying stage records`);

  // Import engagement metrics
  console.log("Importing engagement metrics...");
  for (const row of engagementData) {
    await db.insert(sixsenseEngagementMetrics).values({
      ...row,
      dataAsOf: DATA_AS_OF,
    });
  }
  console.log(`Imported ${engagementData.length} engagement records`);

  // Import keywords
  console.log("Importing keyword performance...");
  for (const row of keywordsData) {
    await db.insert(sixsenseKeywords).values({
      ...row,
      dataAsOf: DATA_AS_OF,
    });
  }
  console.log(`Imported ${keywordsData.length} keyword records`);

  // Import 6QA performance
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
