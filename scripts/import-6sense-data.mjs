     1|import { createConnection } from 'mysql2/promise';
     2|
     3|const DATABASE_URL = process.env.DATABASE_URL;
     4|const DATA_AS_OF = '2025-12-15 00:00:00';
     5|
     6|// Buying Stage data from CSV
     7|const buyingStageData = [
     8|  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Target", numberOfAccounts: 147 },
     9|  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Awareness", numberOfAccounts: 117 },
    10|  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Consideration", numberOfAccounts: 659 },
    11|  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Decision", numberOfAccounts: 475 },
    12|  { timeframe: "Nov 30 - Dec 6, 2025", buyingStage: "Purchase", numberOfAccounts: 180 },
    13|  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Target", numberOfAccounts: 151 },
    14|  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Awareness", numberOfAccounts: 116 },
    15|  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Consideration", numberOfAccounts: 627 },
    16|  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Decision", numberOfAccounts: 476 },
    17|  { timeframe: "Nov 23 - 29, 2025", buyingStage: "Purchase", numberOfAccounts: 208 },
    18|];
    19|
    20|// Engagement data from CSV
    21|const engagementData = [
    22|  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "No Engagement", accounts: 259 },
    23|  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Intent", accounts: 1315 },
    24|  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Anonymous Website Visit", accounts: 60 },
    25|  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Known Engagement", accounts: 101 },
    26|  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Opps Created", accounts: 0 },
    27|  { timeWindow: "Nov 30 - Dec 6, 2025", engagementState: "Opps Won", accounts: 0 },
    28|  { timeWindow: "Nov 23 - 29, 2025", engagementState: "No Engagement", accounts: 231 },
    29|  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Intent", accounts: 1345 },
    30|  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Anonymous Website Visit", accounts: 48 },
    31|  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Known Engagement", accounts: 20 },
    32|  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Opps Created", accounts: 0 },
    33|  { timeWindow: "Nov 23 - 29, 2025", engagementState: "Opps Won", accounts: 0 },
    34|];
    35|
    36|// Top keywords from CSV (top 50 by account volume)
    37|const keywordsData = [
    38|  { keyword: "Ransomware", totalAccounts: 1313, accountsWithWebVisits: 774, accountsWith6QA: 882, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "threat" },
    39|  { keyword: "Phishing", totalAccounts: 1302, accountsWithWebVisits: 755, accountsWith6QA: 865, accountsWithOpportunities: 15, accountsWithRelevantOpportunities: 14, category: "threat" },
    40|  { keyword: "[redacted-event]", totalAccounts: 1213, accountsWithWebVisits: 434, accountsWith6QA: 653, accountsWithOpportunities: 9, accountsWithRelevantOpportunities: 9, category: "event" },
    41|  { keyword: "NIST", totalAccounts: 1179, accountsWithWebVisits: 556, accountsWith6QA: 709, accountsWithOpportunities: 11, accountsWithRelevantOpportunities: 10, category: "compliance" },
    42|  { keyword: "security first", totalAccounts: 1174, accountsWithWebVisits: 538, accountsWith6QA: 712, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "general" },
    43|  { keyword: "secure authentication", totalAccounts: 1140, accountsWithWebVisits: 624, accountsWith6QA: 749, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "product" },
    44|  { keyword: "two factor authentication", totalAccounts: 1123, accountsWithWebVisits: 692, accountsWith6QA: 775, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "product" },
    45|  { keyword: "Security Training", totalAccounts: 1080, accountsWithWebVisits: 688, accountsWith6QA: 778, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "general" },
    46|  { keyword: "device security", totalAccounts: 1063, accountsWithWebVisits: 665, accountsWith6QA: 764, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
    47|  { keyword: "Secure access", totalAccounts: 1037, accountsWithWebVisits: 637, accountsWith6QA: 728, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
    48|  { keyword: "MFA", totalAccounts: 1029, accountsWithWebVisits: 601, accountsWith6QA: 712, accountsWithOpportunities: 15, accountsWithRelevantOpportunities: 14, category: "product" },
    49|  { keyword: "passkey", totalAccounts: 1029, accountsWithWebVisits: 657, accountsWith6QA: 752, accountsWithOpportunities: 14, accountsWithRelevantOpportunities: 13, category: "product" },
    50|  { keyword: "authenticator", totalAccounts: 1028, accountsWithWebVisits: 641, accountsWith6QA: 736, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
    51|  { keyword: "tpm", totalAccounts: 1001, accountsWithWebVisits: 418, accountsWith6QA: 606, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "product" },
    52|  { keyword: "auth0", totalAccounts: 981, accountsWithWebVisits: 498, accountsWith6QA: 655, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "competitor" },
    53|  { keyword: "access management", totalAccounts: 922, accountsWithWebVisits: 564, accountsWith6QA: 649, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
    54|  { keyword: "identity security", totalAccounts: 907, accountsWithWebVisits: 502, accountsWith6QA: 621, accountsWithOpportunities: 12, accountsWithRelevantOpportunities: 11, category: "product" },
    55|  { keyword: "FIDO", totalAccounts: 884, accountsWithWebVisits: 506, accountsWith6QA: 579, accountsWithOpportunities: 11, accountsWithRelevantOpportunities: 10, category: "product" },
    56|  { keyword: "Zscaler", totalAccounts: 854, accountsWithWebVisits: 480, accountsWith6QA: 581, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "competitor" },
    57|  { keyword: "2FA", totalAccounts: 832, accountsWithWebVisits: 350, accountsWith6QA: 533, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
    58|  { keyword: "[redacted-threat]", totalAccounts: 776, accountsWithWebVisits: 409, accountsWith6QA: 563, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "threat" },
    59|  { keyword: "Passwordless", totalAccounts: 751, accountsWithWebVisits: 510, accountsWith6QA: 584, accountsWithOpportunities: 12, accountsWithRelevantOpportunities: 11, category: "product" },
    60|  { keyword: "service identity", totalAccounts: 739, accountsWithWebVisits: 366, accountsWith6QA: 448, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
    61|  { keyword: "Identity Management", totalAccounts: 731, accountsWithWebVisits: 460, accountsWith6QA: 530, accountsWithOpportunities: 13, accountsWithRelevantOpportunities: 12, category: "product" },
    62|  { keyword: "[redacted-threat]", totalAccounts: 713, accountsWithWebVisits: 378, accountsWith6QA: 479, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "threat" },
    63|  { keyword: "NHI", totalAccounts: 612, accountsWithWebVisits: 346, accountsWith6QA: 414, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "product" },
    64|  { keyword: "ai security", totalAccounts: 587, accountsWithWebVisits: 55, accountsWith6QA: 44, accountsWithOpportunities: 0, accountsWithRelevantOpportunities: 0, category: "general" },
    65|  { keyword: "Intune", totalAccounts: 551, accountsWithWebVisits: 241, accountsWith6QA: 327, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "competitor" },
    66|  { keyword: "Account Takeover", totalAccounts: 549, accountsWithWebVisits: 333, accountsWith6QA: 385, accountsWithOpportunities: 10, accountsWithRelevantOpportunities: 10, category: "threat" },
    67|  { keyword: "zero trust security", totalAccounts: 540, accountsWithWebVisits: 307, accountsWith6QA: 345, accountsWithOpportunities: 11, accountsWithRelevantOpportunities: 11, category: "product" },
    68|  { keyword: "man in the middle", totalAccounts: 535, accountsWithWebVisits: 310, accountsWith6QA: 389, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "threat" },
    69|  { keyword: "secure login", totalAccounts: 535, accountsWithWebVisits: 334, accountsWith6QA: 386, accountsWithOpportunities: 9, accountsWithRelevantOpportunities: 9, category: "product" },
    70|  { keyword: "device key", totalAccounts: 552, accountsWithWebVisits: 307, accountsWith6QA: 347, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 8, category: "product" },
    71|  { keyword: "identity risk", totalAccounts: 497, accountsWithWebVisits: 247, accountsWith6QA: 319, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "product" },
    72|  { keyword: "CMMC", totalAccounts: 476, accountsWithWebVisits: 190, accountsWith6QA: 260, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "compliance" },
    73|  { keyword: "Multifactor authentication", totalAccounts: 457, accountsWithWebVisits: 311, accountsWith6QA: 347, accountsWithOpportunities: 8, accountsWithRelevantOpportunities: 7, category: "product" },
    74|  { keyword: "Entra ID", totalAccounts: 444, accountsWithWebVisits: 246, accountsWith6QA: 311, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "competitor" },
    75|  { keyword: "process identity", totalAccounts: 429, accountsWithWebVisits: 211, accountsWith6QA: 271, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "product" },
    76|  { keyword: "Secure Work", totalAccounts: 417, accountsWithWebVisits: 231, accountsWith6QA: 294, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
    77|  { keyword: "Cyber Risk Management", totalAccounts: 401, accountsWithWebVisits: 290, accountsWith6QA: 301, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 6, category: "general" },
    78|  { keyword: "Microsoft Entra ID", totalAccounts: 400, accountsWithWebVisits: 225, accountsWith6QA: 282, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "competitor" },
    79|  { keyword: "Credential Stuffing", totalAccounts: 383, accountsWithWebVisits: 241, accountsWith6QA: 281, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "threat" },
    80|  { keyword: "access identity management", totalAccounts: 383, accountsWithWebVisits: 201, accountsWith6QA: 237, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "product" },
    81|  { keyword: "passwordless authentication", totalAccounts: 367, accountsWithWebVisits: 265, accountsWith6QA: 291, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
    83|  { keyword: "endpoint protection", totalAccounts: 336, accountsWithWebVisits: 207, accountsWith6QA: 231, accountsWithOpportunities: 6, accountsWithRelevantOpportunities: 6, category: "product" },
    84|  { keyword: "identity platform", totalAccounts: 331, accountsWithWebVisits: 197, accountsWith6QA: 219, accountsWithOpportunities: 7, accountsWithRelevantOpportunities: 7, category: "product" },
    85|  { keyword: "Cyber Liability Insurance", totalAccounts: 328, accountsWithWebVisits: 198, accountsWith6QA: 237, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "compliance" },
    86|  { keyword: "trusted platform module", totalAccounts: 307, accountsWithWebVisits: 166, accountsWith6QA: 205, accountsWithOpportunities: 3, accountsWithRelevantOpportunities: 3, category: "product" },
    87|  { keyword: "strong authentication", totalAccounts: 293, accountsWithWebVisits: 177, accountsWith6QA: 193, accountsWithOpportunities: 5, accountsWithRelevantOpportunities: 5, category: "product" },
    88|];
    89|
    90|// 6QA Performance data (daily metrics)
    91|const performanceData = [
    92|  { day: "2025-12-14", total6QAs: 668, new6QAs: 12, worked: 101, unworked: 567, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.8, avgDaysSinceLastActivity: 9.9 },
    93|  { day: "2025-12-13", total6QAs: 669, new6QAs: 5, worked: 104, unworked: 565, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.6, avgDaysSinceLastActivity: 9.6 },
    94|  { day: "2025-12-12", total6QAs: 670, new6QAs: 6, worked: 105, unworked: 565, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.6, avgDaysSinceLastActivity: 8.6 },
    95|  { day: "2025-12-11", total6QAs: 677, new6QAs: 12, worked: 106, unworked: 571, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 15.6, avgDaysSinceLastActivity: 7.9 },
    96|  { day: "2025-12-10", total6QAs: 679, new6QAs: 4, worked: 112, unworked: 567, avgSalesActivities: 5.3, avgContactsReached: 1.9, avgDaysToFirstActivity: 16.2, avgDaysSinceLastActivity: 7.3 },
    97|  { day: "2025-12-09", total6QAs: 681, new6QAs: 6, worked: 109, unworked: 572, avgSalesActivities: 5.3, avgContactsReached: 1.8, avgDaysToFirstActivity: 15.7, avgDaysSinceLastActivity: 6.7 },
    98|  { day: "2025-12-08", total6QAs: 682, new6QAs: 5, worked: 92, unworked: 590, avgSalesActivities: 5.4, avgContactsReached: 1.7, avgDaysToFirstActivity: 13.2, avgDaysSinceLastActivity: 9.2 },
    99|  { day: "2025-12-07", total6QAs: 684, new6QAs: 6, worked: 76, unworked: 608, avgSalesActivities: 6.0, avgContactsReached: 1.8, avgDaysToFirstActivity: 10.3, avgDaysSinceLastActivity: 13.3 },
   100|  { day: "2025-12-06", total6QAs: 686, new6QAs: 13, worked: 76, unworked: 610, avgSalesActivities: 6.0, avgContactsReached: 1.8, avgDaysToFirstActivity: 10.3, avgDaysSinceLastActivity: 12.3 },
   101|  { day: "2025-12-05", total6QAs: 692, new6QAs: 8, worked: 80, unworked: 612, avgSalesActivities: 5.9, avgContactsReached: 1.8, avgDaysToFirstActivity: 9.9, avgDaysSinceLastActivity: 12.9 },
   102|];
   103|
   104|async function importData() {
   105|  const conn = await createConnection(DATABASE_URL);
   106|  
   107|  try {
   108|    console.log("Importing 6sense data (as of Dec 15, 2025)...\n");
   109|
   110|    // Import buying stage metrics
   111|    console.log("Importing buying stage metrics...");
   112|    for (const row of buyingStageData) {
   113|      await conn.execute(
   114|        `INSERT INTO sixsenseBuyingStageMetrics (timeframe, buyingStage, numberOfAccounts, dataAsOf) VALUES (?, ?, ?, ?)`,
   115|        [row.timeframe, row.buyingStage, row.numberOfAccounts, DATA_AS_OF]
   116|      );
   117|    }
   118|    console.log(`✅ Imported ${buyingStageData.length} buying stage records`);
   119|
   120|    // Import engagement metrics
   121|    console.log("\nImporting engagement metrics...");
   122|    for (const row of engagementData) {
   123|      await conn.execute(
   124|        `INSERT INTO sixsenseEngagementMetrics (timeWindow, engagementState, accounts, dataAsOf) VALUES (?, ?, ?, ?)`,
   125|        [row.timeWindow, row.engagementState, row.accounts, DATA_AS_OF]
   126|      );
   127|    }
   128|    console.log(`✅ Imported ${engagementData.length} engagement records`);
   129|
   130|    // Import keywords
   131|    console.log("\nImporting keyword performance...");
   132|    for (const row of keywordsData) {
   133|      await conn.execute(
   134|        `INSERT INTO sixsenseKeywords (keyword, totalAccounts, accountsWithWebVisits, accountsWith6QA, accountsWithOpportunities, accountsWithRelevantOpportunities, category, dataAsOf) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
   135|        [row.keyword, row.totalAccounts, row.accountsWithWebVisits, row.accountsWith6QA, row.accountsWithOpportunities, row.accountsWithRelevantOpportunities, row.category, DATA_AS_OF]
   136|      );
   137|    }
   138|    console.log(`✅ Imported ${keywordsData.length} keyword records`);
   139|
   140|    // Import 6QA performance
   141|    console.log("\nImporting 6QA performance...");
   142|    for (const row of performanceData) {
   143|      await conn.execute(
   144|        `INSERT INTO sixsense6QAPerformance (day, total6QAs, new6QAs, worked, unworked, avgSalesActivities, avgContactsReached, avgDaysToFirstActivity, avgDaysSinceLastActivity, dataAsOf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
   145|        [row.day, row.total6QAs, row.new6QAs, row.worked, row.unworked, row.avgSalesActivities, row.avgContactsReached, row.avgDaysToFirstActivity, row.avgDaysSinceLastActivity, DATA_AS_OF]
   146|      );
   147|    }
   148|    console.log(`✅ Imported ${performanceData.length} 6QA performance records`);
   149|
   150|    console.log("\n🎉 Done! All 6sense data imported successfully.");
   151|  } finally {
   152|    await conn.end();
   153|  }
   154|}
   155|
   156|importData().catch(console.error);
   157|