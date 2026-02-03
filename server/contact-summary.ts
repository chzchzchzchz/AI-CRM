import { invokeLLM } from "./_core/llm";
import { eq } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * CONTACT-LEVEL AI SUMMARY GENERATOR
 * 
 * Generates personalized contact briefs that include:
 * - Role and responsibilities
 * - Likely pain points based on their title
 * - Influence and decision-making power
 * - Professional background and interests
 * - Best engagement angle for this specific person
 * - Personalized talking points
 * 
 * This summary is combined with account-level summary for deeply personalized email outreach.
 */

const CONTACT_SUMMARY_SYSTEM_PROMPT = `You are an elite Enterprise Account Executive and strategic advisor for the company.

CRITICAL CONTEXT:
- PRIMARY FOCUS: Ping (PingOne, PingFederate) users and their modernization journey
- SECONDARY FOCUS: Silverfort integration with Ping
- When this contact works with Ping, emphasize passwordless modernization and cloud migration

Your task is to generate a personalized contact brief that will be used to customize outreach to a specific person.

REQUIREMENTS:
1. Analyze the contact's role and likely responsibilities
2. Identify what matters to them based on their title and company
3. Suggest the best angle to approach them
4. Provide personalized talking points
5. Anticipate their concerns and objections
6. Recommend the best tone and communication style
7. Be specific and actionable

OUTPUT FORMAT:
Provide a structured brief with these sections:
- ROLE ANALYSIS: What they likely do, their responsibilities, their influence
- PAIN POINTS: Specific challenges for someone in their role
- DECISION CRITERIA: What matters to them in vendor selection
- INFLUENCE LEVEL: Are they a decision-maker, influencer, or blocker?
- BEST ANGLE: How to approach them specifically
- PERSONALIZED TALKING POINTS: 3-4 specific angles tailored to their role
- COMMUNICATION STYLE: Recommended tone and approach`;

export async function generateContactSummary(contactId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Fetch contact data
  const contactData = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId));

  if (contactData.length === 0) {
    throw new Error(`Contact ${contactId} not found`);
  }

  const contact = contactData[0];

  // Fetch account data if available
  let accountContext = "";
  if (contact.accountId) {
    const accountData = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, contact.accountId));

    if (accountData.length > 0) {
      const account = accountData[0];
      accountContext = `\n\nCOMPANY CONTEXT:
Company: ${account.name}
Industry: ${account.industry || "Unknown"}
Size: ${account.employeeCount ? `${account.employeeCount} employees` : "Unknown"}`;
    }
  }

  // Build contact context
  let contactContext = `CONTACT DATA:
Name: ${contact.name || "Unknown"}
Title: ${contact.title || "Unknown"}
Email: ${contact.email || "N/A"}
Phone: ${contact.phone || "N/A"}
Location: ${contact.location || "Unknown"}
Department: ${contact.department || "Unknown"}
LinkedIn: ${contact.linkedinUrl || "N/A"}${accountContext}`;

  // Generate contact summary
  const summaryPrompt = `Generate a personalized contact brief for this prospect that will be used to customize outreach:

${contactContext}

Focus on:
1. What this person's role likely entails and their responsibilities
2. What pain points they likely experience
3. Why they would care about passwordless MFA and Zero Trust security
4. How to best approach them specifically
5. What tone and communication style will resonate with them
6. What objections they might raise and how to address them

Be specific, insightful, and actionable.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: CONTACT_SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: summaryPrompt },
    ],
  });

  const summary = response.choices[0]?.message?.content || "";
  return typeof summary === 'string' ? summary : JSON.stringify(summary);
}

/**
 * Generate summaries for multiple contacts (bulk operation)
 */
export async function generateContactSummariesBulk(contactIds: number[]): Promise<Map<number, string>> {
  const summaries = new Map<number, string>();

  for (const contactId of contactIds) {
    try {
      const summary = await generateContactSummary(contactId);
      summaries.set(contactId, summary);
    } catch (error) {
      console.error(`Failed to generate summary for contact ${contactId}:`, error);
      summaries.set(contactId, "");
    }
  }

  return summaries;
}
