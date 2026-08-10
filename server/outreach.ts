import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } from "./_core/llm";
import { wrapUntrusted, INJECTION_GUARD } from "./_core/untrusted";
import { eq, inArray } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";

import { getCompanyConfig } from "./config";

// Clean email generation prompt - NO tracking, NO scoring, NO internal data mentions
function getCleanEmailSystemPrompt(): string {
  const config = getCompanyConfig();
  const competitorsList = config.competitors
    ? config.competitors.split(',').slice(0, 2).map(c => c.trim()).join('/')
    : 'traditional solutions';

  return `You are an elite Enterprise Account Executive for ${config.companyName}, a company specializing in ${config.industry}.

CRITICAL RULES FOR EMAILS:
1. NEVER mention "intent score", "6sense", "tracking", "we noticed you're researching", or any data that reveals surveillance
2. NEVER mention internal scoring, buying stages, or analytics
3. NEVER say things like "your 97 intent score" or "based on our data"
4. DO reference their tech stack, company size, industry - things that are publicly known
5. DO reference their likely pain points based on their tech stack (${competitorsList} = legacy solutions, integration pain, etc.)
6. BE HUMAN - write like a real person, not a marketing robot
7. BE SHORT - 3-5 sentences max
8. ONE CLEAR ASK at the end

GOOD: "Given your current tools, you've likely seen issues with scaling..."
BAD: "Your 97 intent score suggests you're actively evaluating solutions..."

GOOD: "Companies with your infrastructure often struggle with..."
BAD: "Based on our 6sense data, we can see you're in the purchase stage..."`;
}

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

      // The email is generated in a SINGLE grounded pass below. We deliberately do NOT
      // pre-generate separate account/contact "summaries" here: that added two more LLM
      // round-trips (minutes on a free model) and pulled in the fabricating summary prompts.
      // Everything the email needs is assembled from real columns in `accountContext` below.

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
      // SINGLE PASS: Generate Clean, Professional Email
      // ============================================
      // Built from the deployer's own company config — NOT a hardcoded vendor. The old
      // path asserted "this prospect uses Ping Identity" in every email regardless of the
      // prospect's real stack, which was both a fabrication and prior-employer content.
      const cfg = getCompanyConfig();
      const diffs = cfg.keyDifferentiators?.length
        ? cfg.keyDifferentiators.map((d) => `- ${d.trim()}`).join("\n")
        : "- (configure COMPANY_DIFFERENTIATORS)";
      const emailSystemPrompt = `You are an elite SDR writing on behalf of ${cfg.companyName} (${cfg.industry}).
We sell: ${cfg.productDescription}
Our differentiators:
${diffs}

Write cold outreach that a busy executive would actually reply to.
GROUNDING RULES:
- Use ONLY the prospect facts provided (tech stack, industry, size, signals). Do NOT invent
  the tools they use, their vendors, or their pain points — if a fact is not provided, do
  not assert it.
- Personalize from the real signals given, not from assumptions about their stack.
- Be specific and concise; no marketing filler, no fabricated statistics.` + "\n\n" + INJECTION_GUARD;

      const emailPrompt = `Write a cold email for this prospect.

${wrapUntrusted("prospect account and contact fields", accountContext + contactContext)}

Additional context from rep: ${input.prompt || "Focus on the prospect's likely pain points and our key differentiators."}

REQUIREMENTS:
- Start with "${firstName},"
- 3-5 sentences MAXIMUM
- Reference their tech stack or industry situation naturally
- End with ONE clear ask (15-minute call)
- NO subject line, NO signature
- Sound like a human, not a marketing bot
- Use the account and contact briefs above to deeply personalize the email

OUTPUT ONLY THE EMAIL BODY. Nothing else.`;

      const emailResponse = await invokeLLM({
        messages: [
          { role: "system", content: emailSystemPrompt },
          { role: "user", content: emailPrompt },
        ],
      });

      const { content: emailContent, available } = llmText(emailResponse);
      const email = available ? emailContent : LLM_UNAVAILABLE_NOTE;

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
      // Keep the prospect context in front of the model so a refinement doesn't drift off
      // the account/contact. These inputs were previously accepted but never used.
      const contextLine = [
        input.contactName ? `Recipient: ${input.contactName}` : null,
        input.accountName ? `Company: ${input.accountName}` : null,
      ].filter(Boolean).join(" · ");

      const refinePrompt = `Here is a cold email that needs refinement:
${contextLine ? `\n${contextLine}\n` : ""}
---
${input.currentEmail}
---

User feedback: "${input.feedback}"

Rewrite the email incorporating this feedback${input.contactName ? `, keeping it addressed to ${input.contactName}` : ""}. Keep it:
- 3-5 sentences max
- Human and direct
- One clear ask at the end

OUTPUT ONLY THE REVISED EMAIL. Nothing else.`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: getCleanEmailSystemPrompt() },
          { role: "user", content: refinePrompt },
        ],
      });

      // A failed refinement must not replace the rep's draft with an apology.
      const { content, available } = llmText(response);
      const cleanContent = available ? content.trim() : input.currentEmail;
      return {
        content: cleanContent,
      };
    }),
});
