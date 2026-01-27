/**
 * Bulletproof AI Summary Generator
 * 
 * This module generates account summaries using ONLY facts from the database.
 * NO hallucination. NO made-up data. ONLY what we know for certain.
 */

import { getAccountById, getContactsByAccountId } from "./db";

interface AccountSummary {
  summary: string;
  cached: boolean;
  cacheAge: number;
  error?: string;
}

/**
 * Generate a summary using ONLY database facts - no LLM hallucination
 */
export async function generateBulletproofSummary(accountId: number): Promise<AccountSummary> {
  try {
    const account = await getAccountById(accountId);
    if (!account) {
      return { summary: "Account not found.", cached: false, cacheAge: 0, error: "Account not found" };
    }

    const contacts = await getContactsByAccountId(accountId);

    // Build summary from ONLY real data
    const facts: string[] = [];

    // Company basics
    facts.push(`## ${account.name}`);
    facts.push("");

    // Intent and buying signals
    if (account.intentScore) {
      const score = typeof account.intentScore === 'string' ? parseInt(account.intentScore) : account.intentScore;
      const intentLevel = score >= 80 ? "🔥 **Hot Lead**" : score >= 50 ? "⚡ **Warm Lead**" : "📊 **Monitoring**";
      facts.push(`**Intent Score:** ${score}/100 ${intentLevel}`);
    }

    // 6sense data
    let buyingStage = "Unknown";
    let profileFit = "Unknown";
    try {
      if (account.rawData) {
        const raw = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
        buyingStage = raw['Buying Stage'] || raw['6sense Buying Stage'] || buyingStage;
        profileFit = raw['Profile Fit'] || raw['6sense Profile Fit'] || profileFit;
      }
    } catch {}

    if (buyingStage !== "Unknown") {
      facts.push(`**Buying Stage:** ${buyingStage}`);
    }
    if (profileFit !== "Unknown") {
      facts.push(`**Profile Fit:** ${profileFit}`);
    }

    facts.push("");

    // Company info
    facts.push("### Company Details");
    if (account.industry) facts.push(`- **Industry:** ${account.industry}`);
    if (account.employeeCount) facts.push(`- **Employees:** ${account.employeeCount.toLocaleString()}`);
    if (account.region) facts.push(`- **Region:** ${account.region}`);
    if (account.domain) facts.push(`- **Website:** ${account.domain}`);

    facts.push("");

    // Contacts section
    facts.push("### Contacts");
    if (contacts.length === 0) {
      facts.push("⚠️ **No contacts in database.** Add contacts to enable outreach.");
    } else {
      facts.push(`**${contacts.length} contact(s) available:**`);
      facts.push("");
      
      // Show top 5 contacts
      const topContacts = contacts.slice(0, 5);
      for (const contact of topContacts) {
        const name = contact.name || "Unknown";
        const title = contact.title || "No title";
        const email = contact.email ? `✉️ ${contact.email}` : "No email";
        facts.push(`- **${name}** - ${title} (${email})`);
      }
      
      if (contacts.length > 5) {
        facts.push(`- *...and ${contacts.length - 5} more*`);
      }
    }

    facts.push("");

    // Action recommendations based on REAL data
    facts.push("### Recommended Actions");
    
    const score = typeof account.intentScore === 'string' ? parseInt(account.intentScore) : (account.intentScore || 0);
    
    if (score >= 80) {
      facts.push("1. **URGENT:** High intent detected - prioritize immediate outreach");
      if (contacts.length > 0) {
        const topContact = contacts[0];
        facts.push(`2. **Contact:** Reach out to ${topContact.name || 'primary contact'}${topContact.email ? ` at ${topContact.email}` : ''}`);
      } else {
        facts.push("2. **Find Contacts:** Research and add key decision makers");
      }
      facts.push("3. **Prepare:** Review company website and recent news before call");
    } else if (score >= 50) {
      facts.push("1. **Nurture:** Account showing moderate interest - continue engagement");
      facts.push("2. **Research:** Identify specific pain points and use cases");
      if (contacts.length === 0) {
        facts.push("3. **Build List:** Add contacts to enable multi-threaded outreach");
      }
    } else {
      facts.push("1. **Monitor:** Low intent - keep on radar for future signals");
      facts.push("2. **Educate:** Consider adding to nurture campaigns");
    }

    // Combine all facts into summary
    const summary = facts.join("\n");

    return {
      summary,
      cached: false,
      cacheAge: 0
    };

  } catch (error) {
    console.error("[BulletproofSummary] Error:", error);
    return {
      summary: "Unable to generate summary. Please try again.",
      cached: false,
      cacheAge: 0,
      error: String(error)
    };
  }
}

/**
 * Generate a quick facts summary (no LLM, pure data)
 */
export function generateQuickFacts(account: any, contacts: any[]): string {
  const facts: string[] = [];
  
  // Header
  facts.push(`**${account.name}**`);
  
  // Key metrics in one line
  const metrics: string[] = [];
  if (account.intentScore) metrics.push(`Intent: ${account.intentScore}`);
  if (account.industry) metrics.push(account.industry);
  if (account.employeeCount) metrics.push(`${account.employeeCount.toLocaleString()} employees`);
  if (metrics.length > 0) facts.push(metrics.join(" • "));
  
  // Contact count
  facts.push(`${contacts.length} contact(s) in database`);
  
  return facts.join("\n");
}
