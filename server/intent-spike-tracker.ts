import { getDb } from "./db";
import { accounts } from "../drizzle/schema";
import { eq, sql, and, gte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

interface IntentSpike {
  accountId: number;
  accountName: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  detectedAt: Date;
}

/**
 * Check for intent score spikes (20+ point increases in 24 hours)
 * and notify the owner
 */
export async function detectAndNotifyIntentSpikes(): Promise<IntentSpike[]> {
  const db = await getDb();
  
  // Get all accounts with their current intent scores
  const allAccounts = await db.select().from(accounts);
  
  const spikes: IntentSpike[] = [];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  for (const account of allAccounts) {
    // Parse current intent score
    const currentScore = typeof account.intentScore === 'string' 
      ? parseInt(account.intentScore, 10) 
      : (account.intentScore || 0);
    
    // Check if we have historical data in rawData
    if (account.rawData && typeof account.rawData === 'string') {
      try {
        const data = JSON.parse(account.rawData);
        const previousScore = data.previousIntentScore || data.intent_score_24h_ago;
        
        if (previousScore && typeof previousScore === 'number') {
          const scoreDelta = currentScore - previousScore;
          
          // Detect spike: 20+ point increase
          if (scoreDelta >= 20) {
            spikes.push({
              accountId: account.id,
              accountName: account.name,
              previousScore,
              currentScore,
              scoreDelta,
              detectedAt: new Date(),
            });
          }
        }
      } catch (error) {
        console.error(`Failed to parse rawData for account ${account.id}:`, error);
      }
    }
  }
  
  // Notify owner if spikes detected
  if (spikes.length > 0) {
    const message = formatIntentSpikeNotification(spikes);
    await notifyOwner({
      title: `🚨 ${spikes.length} Intent Spike${spikes.length > 1 ? 's' : ''} Detected!`,
      content: message,
    });
  }
  
  return spikes;
}

/**
 * Format intent spike notification message
 */
function formatIntentSpikeNotification(spikes: IntentSpike[]): string {
  let message = `${spikes.length} account${spikes.length > 1 ? 's have' : ' has'} shown significant intent increases (20+ points) in the last 24 hours:\n\n`;
  
  spikes
    .sort((a, b) => b.scoreDelta - a.scoreDelta) // Sort by largest spike first
    .forEach((spike, index) => {
      message += `${index + 1}. **${spike.accountName}**\n`;
      message += `   - Previous Score: ${spike.previousScore}\n`;
      message += `   - Current Score: ${spike.currentScore}\n`;
      message += `   - Increase: +${spike.scoreDelta} points\n`;
      message += `   - Detected: ${spike.detectedAt.toLocaleString()}\n\n`;
    });
  
  message += `\n**Action Required:** Review these accounts immediately and prioritize outreach.`;
  
  return message;
}

/**
 * Store historical intent score for spike detection
 * Call this before updating an account's intent score
 */
export async function storeHistoricalIntentScore(accountId: number, currentScore: number): Promise<void> {
  const db = await getDb();
  
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  
  if (account.length === 0) return;
  
  const existingData = account[0].rawData && typeof account[0].rawData === 'string'
    ? JSON.parse(account[0].rawData)
    : {};
  
  // Store current score as previous score for next comparison
  existingData.previousIntentScore = currentScore;
  existingData.intent_score_updated_at = new Date().toISOString();
  
  await db.update(accounts)
    .set({ rawData: JSON.stringify(existingData) })
    .where(eq(accounts.id, accountId));
}

/**
 * Get recent intent spikes for AI assistant queries
 */
export async function getRecentIntentSpikes(limit: number = 10): Promise<IntentSpike[]> {
  const db = await getDb();
  const allAccounts = await db.select().from(accounts);
  
  const spikes: IntentSpike[] = [];
  
  for (const account of allAccounts) {
    const currentScore = typeof account.intentScore === 'string' 
      ? parseInt(account.intentScore, 10) 
      : (account.intentScore || 0);
    
    if (account.rawData && typeof account.rawData === 'string') {
      try {
        const data = JSON.parse(account.rawData);
        const previousScore = data.previousIntentScore;
        
        if (previousScore && typeof previousScore === 'number') {
          const scoreDelta = currentScore - previousScore;
          
          if (scoreDelta >= 20) {
            spikes.push({
              accountId: account.id,
              accountName: account.name,
              previousScore,
              currentScore,
              scoreDelta,
              detectedAt: new Date(data.intent_score_updated_at || Date.now()),
            });
          }
        }
      } catch (error) {
        // Skip accounts with invalid rawData
      }
    }
  }
  
  // Sort by score delta (largest spikes first) and limit
  return spikes
    .sort((a, b) => b.scoreDelta - a.scoreDelta)
    .slice(0, limit);
}
