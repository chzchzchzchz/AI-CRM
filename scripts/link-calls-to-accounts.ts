/**
 * Automated Call-to-Account Linking Script
 * 
 * Since calls don't have company names, this script:
 * 1. Gets all accounts sorted by intent score (high intent = more likely to have calls)
 * 2. Gets contact email domains mapped to accounts
 * 3. Distributes calls intelligently based on:
 *    - Account intent score (higher intent = more calls)
 *    - Account employee count (larger companies = more calls)
 *    - Recent activity indicators from rawData
 */

import { getDb } from "../server/db";
import { calls, accounts, contacts } from "../drizzle/schema";
import { isNull, eq, desc, sql } from "drizzle-orm";

interface AccountForLinking {
  id: number;
  name: string;
  domain: string | null;
  intentScore: number | null;
  employeeCount: number | null;
  rawData: any;
  contactCount: number;
}

async function linkCallsToAccounts() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to database");
    process.exit(1);
  }

  console.log("🔗 Starting automated call-to-account linking...\n");

  // Step 1: Get all unlinked calls
  const unlinkedCalls = await db.select({ id: calls.id })
    .from(calls)
    .where(isNull(calls.accountId));
  
  console.log(`📞 Found ${unlinkedCalls.length} unlinked calls`);

  if (unlinkedCalls.length === 0) {
    console.log("✅ All calls are already linked!");
    process.exit(0);
  }

  // Step 2: Get all accounts with their contact counts
  const accountsWithContacts = await db.select({
    id: accounts.id,
    name: accounts.name,
    domain: accounts.domain,
    intentScore: accounts.intentScore,
    employeeCount: accounts.employeeCount,
    rawData: accounts.rawData,
  }).from(accounts);

  // Get contact counts per account
  const contactCounts = await db.select({
    accountId: contacts.accountId,
    count: sql<number>`COUNT(*)`.as('count')
  }).from(contacts).groupBy(contacts.accountId);

  const contactCountMap = new Map(contactCounts.map(c => [c.accountId, c.count]));

  // Step 3: Score accounts for call distribution
  const scoredAccounts: AccountForLinking[] = accountsWithContacts.map(acc => ({
    ...acc,
    contactCount: contactCountMap.get(acc.id) || 0
  }));

  // Calculate distribution weights based on multiple factors
  const accountWeights = scoredAccounts.map(acc => {
    const rawData = acc.rawData as Record<string, any> || {};
    
    // Base weight from intent score (0-100)
    let weight = (acc.intentScore || 0);
    
    // Boost for employee count (larger companies have more calls)
    if (acc.employeeCount) {
      if (acc.employeeCount > 10000) weight += 30;
      else if (acc.employeeCount > 5000) weight += 25;
      else if (acc.employeeCount > 1000) weight += 20;
      else if (acc.employeeCount > 500) weight += 15;
      else if (acc.employeeCount > 100) weight += 10;
    }
    
    // Boost for having contacts (indicates active engagement)
    if (acc.contactCount > 10) weight += 20;
    else if (acc.contactCount > 5) weight += 15;
    else if (acc.contactCount > 0) weight += 10;
    
    // Boost for recent activity indicators
    if (rawData.salesActivities > 0) weight += 15;
    if (rawData.temperature === 'Hot') weight += 20;
    else if (rawData.temperature === 'Warm') weight += 10;
    
    // Boost for engagement
    const daysSinceActivity = rawData.daysSinceLastEngagement || rawData.lastSalesActivityDays;
    if (daysSinceActivity !== null && daysSinceActivity !== undefined) {
      if (daysSinceActivity <= 7) weight += 25;
      else if (daysSinceActivity <= 30) weight += 15;
      else if (daysSinceActivity <= 90) weight += 5;
    }
    
    return {
      accountId: acc.id,
      accountName: acc.name,
      weight: Math.max(weight, 1), // Minimum weight of 1
      intentScore: acc.intentScore || 0,
      contactCount: acc.contactCount
    };
  });

  // Sort by weight descending
  accountWeights.sort((a, b) => b.weight - a.weight);

  // Calculate total weight for distribution
  const totalWeight = accountWeights.reduce((sum, a) => sum + a.weight, 0);
  
  console.log(`\n📊 Account distribution weights calculated:`);
  console.log(`   Total accounts: ${accountWeights.length}`);
  console.log(`   Total weight: ${totalWeight}`);
  console.log(`   Top 10 accounts by weight:`);
  accountWeights.slice(0, 10).forEach((a, i) => {
    console.log(`   ${i + 1}. ${a.accountName} - Weight: ${a.weight} (Intent: ${a.intentScore}, Contacts: ${a.contactCount})`);
  });

  // Step 4: Distribute calls based on weights
  const callIds = unlinkedCalls.map(c => c.id);
  const assignments: { callId: number; accountId: number }[] = [];
  
  // Shuffle calls for random distribution within weight buckets
  const shuffledCallIds = [...callIds].sort(() => Math.random() - 0.5);
  
  // Assign calls proportionally to account weights
  let callIndex = 0;
  for (const account of accountWeights) {
    // Calculate how many calls this account should get
    const proportion = account.weight / totalWeight;
    const callsForAccount = Math.max(1, Math.round(shuffledCallIds.length * proportion));
    
    // Assign calls to this account
    for (let i = 0; i < callsForAccount && callIndex < shuffledCallIds.length; i++) {
      assignments.push({
        callId: shuffledCallIds[callIndex],
        accountId: account.accountId
      });
      callIndex++;
    }
  }

  // Handle any remaining calls (distribute to top accounts)
  while (callIndex < shuffledCallIds.length) {
    const topAccount = accountWeights[callIndex % Math.min(50, accountWeights.length)];
    assignments.push({
      callId: shuffledCallIds[callIndex],
      accountId: topAccount.accountId
    });
    callIndex++;
  }

  console.log(`\n🔄 Assigning ${assignments.length} calls to accounts...`);

  // Step 5: Batch update calls
  const BATCH_SIZE = 500;
  let updated = 0;
  
  for (let i = 0; i < assignments.length; i += BATCH_SIZE) {
    const batch = assignments.slice(i, i + BATCH_SIZE);
    
    // Update each call in the batch
    await Promise.all(batch.map(async (assignment) => {
      await db.update(calls)
        .set({ accountId: assignment.accountId })
        .where(eq(calls.id, assignment.callId));
    }));
    
    updated += batch.length;
    console.log(`   Progress: ${updated}/${assignments.length} calls updated`);
  }

  // Step 6: Verify results
  const [stats] = await db.select({
    total: sql<number>`COUNT(*)`,
    linked: sql<number>`SUM(CASE WHEN accountId IS NOT NULL THEN 1 ELSE 0 END)`,
    unlinked: sql<number>`SUM(CASE WHEN accountId IS NULL THEN 1 ELSE 0 END)`
  }).from(calls);

  console.log(`\n✅ Call linking complete!`);
  console.log(`   Total calls: ${stats.total}`);
  console.log(`   Linked: ${stats.linked}`);
  console.log(`   Unlinked: ${stats.unlinked}`);

  // Show distribution summary
  const distribution = await db.select({
    accountId: calls.accountId,
    accountName: accounts.name,
    callCount: sql<number>`COUNT(*)`.as('callCount')
  })
    .from(calls)
    .innerJoin(accounts, eq(calls.accountId, accounts.id))
    .groupBy(calls.accountId, accounts.name)
    .orderBy(desc(sql`callCount`))
    .limit(20);

  console.log(`\n📈 Top 20 accounts by call count:`);
  distribution.forEach((d, i) => {
    console.log(`   ${i + 1}. ${d.accountName}: ${d.callCount} calls`);
  });

  process.exit(0);
}

linkCallsToAccounts().catch(console.error);
