import { eq } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { getCompanyConfig } from "./config";

/**
 * ACCOUNT-LEVEL AI SUMMARY GENERATOR
 * 
 * Generates comprehensive account briefs that include:
 * - Company overview and business context
 * - Technology stack and security posture
 * - Intent signals and buying signals
 * - Competitive landscape and opportunities
 * - Pain points specific to their profile
 * - Recommended talking points
 * - Engagement strategy
 * 
 * This summary is used to deeply personalize email outreach and other communications.
 * The prompt is built from the deployer's own company config (see config.ts).
 */

export async function generateAccountSummary(
  accountId: number,
  _sequence: "default" = "default"
): Promise<string> {
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

  const companyName = getCompanyConfig().companyName;

  // Generic, config-driven system prompt (no vendor/prior-employer specifics).
  const systemPrompt = `You are an elite Enterprise Account Executive and strategic advisor for ${companyName}.

Your task is to generate a comprehensive, data-driven account brief for ${account.name || "this company"}.

ACCOUNT DETAILS:
- Company: ${account.name}
- Industry: ${account.industry || "Unknown"}
- Employees: ${account.employeeCount || "Unknown"}
- Tech Stack: ${account.techStack || "Unknown"}

Generate a structured brief with these sections:
- COMPANY OVERVIEW
- TECH STACK ANALYSIS
- INTENT SIGNALS
- BUYING SIGNALS
- COMPETITIVE LANDSCAPE
- PAIN POINTS
- RECOMMENDED TALKING POINTS
- ENGAGEMENT STRATEGY`;

  // Prepare context for LLM
  const userMessage = `Generate an account brief for ${account.name}. Include all relevant information about their business, technology, and how ${companyName} can help.`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }
    return "Unable to generate summary";
  } catch (error) {
    console.error(`Error generating account summary for ${accountId}:`, error);
    throw error;
  }
}
