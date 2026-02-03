import { eq } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";
import { getPingContactSummaryPrompt } from "./sequences/ping-context";
import { invokeLLM } from "./_core/llm";

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
 * Supports multiple sequences (Ping, Silverfort, AI, SDO, etc.)
 */

export async function generateContactSummary(
  contactId: number,
  sequence: "ping" | "silverfort" | "ai" | "sdo" | "default" = "default"
): Promise<string> {
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
  let accountName = "Unknown";
  if (contact.accountId) {
    const accountData = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, contact.accountId));
    if (accountData.length > 0) {
      accountName = accountData[0].name || "Unknown";
    }
  }

  // Get sequence-specific system prompt
  let systemPrompt: string;

  if (sequence === "ping") {
    systemPrompt = getPingContactSummaryPrompt({
      name: contact.name || "Unknown",
      title: contact.title || undefined,
      company: accountName,
    });
  } else {
    // Default prompt for other sequences (to be implemented)
    systemPrompt = `You are an elite Enterprise Account Executive and strategic advisor for the company.

Your task is to generate a personalized contact brief for ${contact.name || "this person"}.

CONTACT DETAILS:
- Name: ${contact.name}
- Title: ${contact.title || "Unknown"}
- Company: ${accountName}
- Email: ${contact.email || "Unknown"}

Generate a structured brief with these sections:
- ROLE ANALYSIS
- PAIN POINTS
- DECISION CRITERIA
- INFLUENCE LEVEL
- BEST ANGLE
- PERSONALIZED TALKING POINTS
- COMMUNICATION STYLE`;
  }

  // Prepare context for LLM
  const userMessage = `Generate a contact brief for ${contact.name} at ${accountName}. Include information about their role, influence, and the best way to approach them.`;

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
    console.error(`Error generating contact summary for ${contactId}:`, error);
    throw error;
  }
}
