import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { eq, inArray } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";
import { generateAccountSummary } from "./account-summary";
import { generateContactSummary } from "./contact-summary";

// Clean email generation prompt - NO tracking, NO scoring, NO internal data mentions
const CLEAN_EMAIL_SYSTEM_PROMPT = `You are an elite Enterprise Account Executive for the company, a passwordless MFA/Zero Trust security company.

CRITICAL RULES FOR EMAILS:
1. NEVER mention "intent score", "6sense", "tracking", "we noticed you're researching", or any data that reveals surveillance
2. NEVER mention internal scoring, buying stages, or analytics
3. NEVER say things like "your 97 intent score" or "based on our data"
4. DO reference their tech stack, company size, industry - things that are publicly known
5. DO reference their likely pain points based on their tech stack (Okta/Duo = phishing risk, etc.)
6. BE HUMAN - write like a real person, not a marketing robot
7. BE SHORT - 3-5 sentences max
8. ONE CLEAR ASK at the end

CRITICAL: Reference Ping (PingOne, PingFederate) as the primary identity platform context
GOOD: "Given your Ping deployment, you've likely seen the complexity of managing passwordless at scale..."
GOOD: "Companies modernizing from Ping often struggle with..."
GOOD: "Your Silverfort integration with Ping shows you're thinking about unified identity fabric..."
BAD: "Your 97 intent score suggests you're actively evaluating identity solutions..."
BAD: "Based on our 6sense data, we can see you're in the purchase stage..."`;

export const outreachRouter = router({
  generateEmail: protectedProcedure
    .input(
      z.object({
        accountIds: z.array(z.number()),
        contactIds: z.array(z.number()).optional(),
        prompt: z.string().optional(),
        templateType: z.enum(["mfa", "sso", "zero-trust", "custom"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Fetch account data
      const accountData = await db
        .select()
        .from(accounts)
        .where(inArray(accounts.id, input.accountIds));

      if (accountData.length === 0) {
        throw new Error("No accounts found");
      }

      const account = accountData[0];

      // Fetch contact data if provided
      let contactData: any[] = [];
      if (input.contactIds && input.contactIds.length > 0) {
        contactData = await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, input.contactIds));
      }

      const contact = contactData[0];

      // ============================================
      // PHASE 1: Generate Account-Level Summary
      // ============================================
      let accountSummary = "";
      try {
        accountSummary = await generateAccountSummary(account.id);
      } catch (e) {
        console.error("Failed to generate account summary:", e);
      }

      // ============================================
      // PHASE 2: Generate Contact-Level Summary (if contact provided)
      // ============================================
      let contactSummary = "";
      if (contact) {
        try {
          contactSummary = await generateContactSummary(contact.id);
        } catch (e) {
          console.error("Failed to generate contact summary:", e);
        }
      }

      // Build CLEAN context - only publicly known info
      let accountContext = `Company: ${account.name}`;
      if (account.industry) accountContext += `\nIndustry: ${account.industry}`;
      if (account.employeeCount) accountContext += `\nSize: ${account.employeeCount} employees`;
      if (account.region) accountContext += `\nRegion: ${account.region}`;
      
      // Parse tech stack - this is public info
      if (account.techStack) {
        try {
          const stack = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
          if (stack && typeof stack === 'object') {
            const techs = Object.values(stack).flat().filter(Boolean);
            if (techs.length > 0) {
              accountContext += `\nTech Stack: ${techs.slice(0, 8).join(", ")}`;
            }
          }
        } catch (e) {}
      }

      // Parse security stack - this is public info
      if (account.securityStack) {
        try {
          const stack = typeof account.securityStack === 'string' ? JSON.parse(account.securityStack) : account.securityStack;
          if (stack && typeof stack === 'object') {
            const techs = Object.values(stack).flat().filter(Boolean);
            if (techs.length > 0) {
              accountContext += `\nSecurity Stack: ${techs.slice(0, 5).join(", ")}`;
            }
          }
        } catch (e) {}
      }

      // Parse rawData for SSO/MFA info (public)
      let rawData: Record<string, any> = {};
      try {
        if (account.rawData) {
          rawData = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
        }
      } catch (e) {}

      // Add ONLY publicly known info
      if (rawData['SSO Provider']) {
        accountContext += `\nCurrent SSO: ${rawData['SSO Provider']}`;
      }
      if (rawData['MFA Solution']) {
        accountContext += `\nCurrent MFA: ${rawData['MFA Solution']}`;
      }
      // Company description is public
      if (rawData['Company Description']) {
        accountContext += `\nAbout: ${rawData['Company Description'].slice(0, 300)}`;
      }

      // Contact context
      let contactContext = "";
      if (contact) {
        contactContext = `\n\nTarget Contact:
Name: ${contact.name}
Title: ${contact.title || "Unknown"}
Email: ${contact.email || "Unknown"}`;
      }

      const firstName = contact?.name?.split(' ')[0] || "there";

      // ============================================
      // PHASE 3: Generate Email Using Summaries
      // ============================================
      // Build comprehensive context from summaries
      let summaryContext = "";
      if (accountSummary) {
        summaryContext += `\n\n=== ACCOUNT INTELLIGENCE ===\n${accountSummary}`;
      }
      if (contactSummary) {
        summaryContext += `\n\n=== CONTACT INTELLIGENCE ===\n${contactSummary}`;
      }

      const emailPrompt = `Write a cold email for this prospect. Use the intelligence provided below to create a deeply personalized, highly relevant message.${summaryContext}

Write a cold email for this prospect.

${accountContext}${contactContext}

Additional context from rep: ${input.prompt || "Focus on passwordless MFA and Zero Trust security."}

REQUIREMENTS:
- Start with "${firstName},"
- 3-5 sentences MAXIMUM
- Reference their tech stack or industry situation naturally
- End with ONE clear ask (15-minute call)
- NO subject line, NO signature
- Sound like a human, not a marketing bot

OUTPUT ONLY THE EMAIL BODY. Nothing else.`;

      const emailResponse = await invokeLLM({
        messages: [
          { role: "system", content: CLEAN_EMAIL_SYSTEM_PROMPT },
          { role: "user", content: emailPrompt },
        ],
      });

      const emailContent = emailResponse.choices[0]?.message?.content || "";
      const email = typeof emailContent === 'string' ? emailContent : JSON.stringify(emailContent);

      // Return ONLY the email - no strategy, no reasoning
      return {
        content: email.trim(),
        accountCount: accountData.length,
      };
    }),

  // Refine an existing email based on feedback
  refineEmail: protectedProcedure
    .input(
      z.object({
        currentEmail: z.string(),
        feedback: z.string(),
        accountName: z.string().optional(),
        contactName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const refinePrompt = `Here is a cold email that needs refinement:

---
${input.currentEmail}
---

User feedback: "${input.feedback}"

Rewrite the email incorporating this feedback. Keep it:
- 3-5 sentences max
- Human and direct
- One clear ask at the end

OUTPUT ONLY THE REVISED EMAIL. Nothing else.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: CLEAN_EMAIL_SYSTEM_PROMPT },
          { role: "user", content: refinePrompt },
        ],
      });

      const content = response.choices[0]?.message?.content;
      const cleanContent = typeof content === 'string' ? content.trim() : (content ? JSON.stringify(content) : input.currentEmail);
      return {
        content: cleanContent,
      };
    }),
});
