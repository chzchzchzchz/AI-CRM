import { invokeLLM } from "./_core/llm";
import { eq } from "drizzle-orm";
import { accounts, contacts, calls, intentScores } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * ACCOUNT-LEVEL AI SUMMARY GENERATOR
 * 
 * Generates comprehensive account briefs that include:
 * - Company overview and positioning
 * - Tech stack analysis and security posture
 * - Intent signals and buying signals
 * - Competitive landscape
 * - Key pain points and opportunities
 * - Recommended talking points
 * - Engagement strategy
 * 
 * This summary is used to deeply personalize email outreach and other communications.
 */

const ACCOUNT_SUMMARY_SYSTEM_PROMPT = `You are an elite Enterprise Account Executive and strategic advisor for the company, a passwordless MFA/Zero Trust security company.

CRITICAL FOCUS:
- PRIMARY COMPETITOR FILTER: Ping (PingOne, PingFederate, Ping Intelligent Cloud)
- SECONDARY FILTERS: Silverfort, Okta, Azure AD
- When prospects use Ping, emphasize modernization and passwordless adoption
- Reference Ping as the primary identity platform to replace or augment

Your task is to generate a comprehensive, data-driven account brief that will be used to personalize outreach communications.

REQUIREMENTS:
1. Be specific and data-backed - reference actual company data, tech stack, industry trends
2. Identify concrete pain points based on their tech stack and industry
3. Surface competitive threats and opportunities
4. Provide actionable talking points
5. Suggest the best engagement angle based on their profile
6. Keep language professional but human - avoid marketing speak
7. Focus on business value and outcomes, not features

OUTPUT FORMAT:
Provide a structured brief with these sections:
- COMPANY OVERVIEW: Size, industry, location, business focus
- TECH STACK ANALYSIS: Current technologies, security posture, gaps
- INTENT SIGNALS: Evidence of active evaluation or need
- BUYING SIGNALS: Indicators of decision-making timeline
- COMPETITIVE LANDSCAPE: Threats, opportunities, alternatives they might consider
- PAIN POINTS: Specific challenges based on their profile
- RECOMMENDED TALKING POINTS: 3-4 specific angles for outreach
- ENGAGEMENT STRATEGY: Best approach and timing`;

export async function generateAccountSummary(accountId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch account data
  const accountData = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId));

  if (accountData.length === 0) {
    throw new Error(`Account ${accountId} not found`);
  }

  const account = accountData[0];

  // Fetch related contacts
  const accountContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.accountId, accountId));

  // Fetch recent calls
  const recentCalls = await db
    .select()
    .from(calls)
    .where(eq(calls.accountId, accountId));

  // Fetch intent scores
  const intentData = await db
    .select()
    .from(intentScores)
    .where(eq(intentScores.accountId, accountId));

  // Build comprehensive account context
  let accountContext = `ACCOUNT DATA:
Name: ${account.name}
Industry: ${account.industry || "Unknown"}
Size: ${account.employeeCount ? `${account.employeeCount} employees` : "Unknown"}
Region: ${account.region || "Unknown"}
Website: ${account.website || "N/A"}
LinkedIn: ${account.linkedinUrl || "N/A"}`;

  // Tech stack analysis
  if (account.techStack) {
    try {
      const stack = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
      if (stack && typeof stack === 'object') {
        const techs = Object.values(stack).flat().filter(Boolean);
        if (techs.length > 0) {
          accountContext += `\n\nTECH STACK: ${techs.join(", ")}`;
        }
      }
    } catch (e) {}
  }

  // Security stack analysis
  if (account.securityStack) {
    try {
      const stack = typeof account.securityStack === 'string' ? JSON.parse(account.securityStack) : account.securityStack;
      if (stack && typeof stack === 'object') {
        const techs = Object.values(stack).flat().filter(Boolean);
        if (techs.length > 0) {
          accountContext += `\n\nSECURITY STACK: ${techs.join(", ")}`;
        }
      }
    } catch (e) {}
  }

  // Raw data insights
  let rawData: Record<string, any> = {};
  try {
    if (account.rawData) {
      rawData = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
    }
  } catch (e) {}

  if (Object.keys(rawData).length > 0) {
    accountContext += `\n\nCOMPANY DATA:`;
    Object.entries(rawData).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        accountContext += `\n- ${key}: ${String(value).slice(0, 200)}`;
      }
    });
  }

  // Intent signals
  if (intentData.length > 0) {
    const topIntent = intentData[0];
    accountContext += `\n\nINTENT SIGNALS:
Score: ${topIntent.score}/100
Category: ${topIntent.category || "General"}`;
    
    if (topIntent.keywords) {
      try {
        const keywords = typeof topIntent.keywords === 'string' ? JSON.parse(topIntent.keywords) : topIntent.keywords;
        if (Array.isArray(keywords) && keywords.length > 0) {
          accountContext += `\nKeywords: ${keywords.slice(0, 10).join(", ")}`;
        }
      } catch (e) {}
    }
  }

  // Contact information
  if (accountContacts.length > 0) {
    accountContext += `\n\nKEY CONTACTS (${accountContacts.length} total):`;
    accountContacts.slice(0, 5).forEach(contact => {
      accountContext += `\n- ${contact.name || "Unknown"} (${contact.title || "Unknown"}) - ${contact.email || "N/A"}`;
    });
  }

  // Recent engagement
  if (recentCalls.length > 0) {
    accountContext += `\n\nRECENT ENGAGEMENT:
- ${recentCalls.length} calls on record
- Last call: ${recentCalls[0]?.callDate ? new Date(recentCalls[0].callDate).toLocaleDateString() : "Unknown"}`;
  }

  // Relationship status
  accountContext += `\n\nRELATIONSHIP STATUS: ${account.relationship || "Prospect"}`;

  // Generate account summary
  const summaryPrompt = `Generate a comprehensive account brief for this prospect that will be used to personalize outreach communications:

${accountContext}

Focus on:
1. What makes this account unique and valuable
2. Specific pain points based on their tech stack and industry
3. Why they might need our passwordless MFA and Zero Trust solutions
4. Best angles for initial outreach
5. Recommended talking points for conversations

Be specific, data-driven, and actionable.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: ACCOUNT_SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: summaryPrompt },
    ],
  });

  const summary = response.choices[0]?.message?.content || "";
  return typeof summary === 'string' ? summary : JSON.stringify(summary);
}

/**
 * Generate summaries for multiple accounts (bulk operation)
 */
export async function generateAccountSummariesBulk(accountIds: number[]): Promise<Map<number, string>> {
  const summaries = new Map<number, string>();

  for (const accountId of accountIds) {
    try {
      const summary = await generateAccountSummary(accountId);
      summaries.set(accountId, summary);
    } catch (error) {
      console.error(`Failed to generate summary for account ${accountId}:`, error);
      summaries.set(accountId, "");
    }
  }

  return summaries;
}
