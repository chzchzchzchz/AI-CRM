import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { eq, inArray } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";

export const outreachRouter = router({
  generateEmail: publicProcedure
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

      const account = accountData[0]; // Single account

      // Fetch contact data if provided
      let contactData: any[] = [];
      if (input.contactIds && input.contactIds.length > 0) {
        contactData = await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, input.contactIds));
      }

      const contact = contactData[0]; // Single contact (if any)

      // Build rich context from account data
      let accountContext = `Company: ${account.name}`;
      if (account.industry) accountContext += `\nIndustry: ${account.industry}`;
      if (account.employeeCount) accountContext += `\nSize: ${account.employeeCount} employees`;
      if (account.region) accountContext += `\nRegion: ${account.region}`;
      if (account.intentScore) {
        const score = typeof account.intentScore === 'string' ? parseInt(account.intentScore) : account.intentScore;
        accountContext += `\nIntent Score: ${score}/100`;
      }
      if (account.sixsenseBuyingStage) {
        accountContext += `\nBuying Stage: ${account.sixsenseBuyingStage}`;
      }
      
      // Parse tech stack
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

      // Parse security stack
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

      // Contact context
      let contactContext = "";
      if (contact) {
        contactContext = `\n\nTarget Contact:
Name: ${contact.name}
Title: ${contact.title || "Unknown"}
Email: ${contact.email || "Unknown"}`;
      }

      // ============================================
      // PASS 1: Generate Strategy & Notes (Internal)
      // ============================================
      const strategyPrompt = `You are an elite Enterprise Account Executive for the company (passwordless MFA/SSO/Zero Trust security).

Analyze this account and generate INTERNAL STRATEGY NOTES (not for sending to prospect):

${accountContext}${contactContext}

Additional context: ${input.prompt || "Focus on passwordless MFA and Zero Trust security."}

Generate brief internal notes covering:
1. WHY NOW - What signal/trigger makes this account timely?
2. HYPOTHESIS - What problem are they likely trying to solve based on their tech stack?
3. ANGLE - Should we lead with "rip & replace" (displacing Okta/Duo) or "innovation" (securing growth)?
4. OBJECTION PREP - What pushback might we get?

Keep it brief and tactical. These are YOUR notes, not for the prospect.`;

      const strategyResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You are a tactical sales strategist. Be brief and specific." },
          { role: "user", content: strategyPrompt },
        ],
      });

      const strategy = strategyResponse.choices[0]?.message?.content || "";

      // ============================================
      // PASS 2: Generate Actual Sendable Email
      // ============================================
      const firstName = contact?.name?.split(' ')[0] || "there";
      const companyName = account.name;

      const emailPrompt = `You are writing a REAL cold email that will be sent to a prospect. 

ACCOUNT CONTEXT:
${accountContext}${contactContext}

INTERNAL STRATEGY (use this to inform your email, but don't include it):
${strategy}

RULES FOR THE EMAIL:
1. SHORT - 3-5 sentences max. No one reads long cold emails.
2. SPECIFIC - Reference their actual company name, tech stack, or situation
3. ONE ASK - End with a single clear question or request
4. NO FLUFF - No "I hope this finds you well" or "I wanted to reach out"
5. HUMAN - Write like a real person, not a marketing robot

Write ONLY the email body. No subject line, no signature, no "Best regards".
Start directly with the opening line addressing ${firstName}.

Example tone (but use their real data):
"${firstName}, noticed ${companyName} is using Okta for SSO. We've helped similar ${account.industry || 'companies'} eliminate password-related breaches entirely with phishing-resistant MFA. Worth a 15-min call to see if it fits?"`;

      const emailResponse = await invokeLLM({
        messages: [
          { role: "system", content: "You write short, specific, human cold emails. No fluff. No corporate speak. Just direct, relevant outreach." },
          { role: "user", content: emailPrompt },
        ],
      });

      const email = emailResponse.choices[0]?.message?.content || "";

      // Return both strategy and email with separator
      const combinedOutput = `---STRATEGY---
${strategy}
---EMAIL---
${email}`;

      return {
        content: combinedOutput,
        accountCount: accountData.length,
      };
    }),
});
