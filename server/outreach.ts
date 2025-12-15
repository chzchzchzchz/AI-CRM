import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { eq, inArray } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";
import { REVENUE_ARCHITECT_CORE, OUTREACH_PROMPT } from "./revenueArchitect";

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

      // Fetch contact data if provided
      let contactData: any[] = [];
      if (input.contactIds && input.contactIds.length > 0) {
        contactData = await db
          .select()
          .from(contacts)
          .where(inArray(contacts.id, input.contactIds));
      }

      // Build context from account data
      const accountContext = accountData
        .map((acc) => {
          let context = `Company: ${acc.name}`;
          if (acc.industry) context += `\nIndustry: ${acc.industry}`;
          if (acc.employeeCount) context += `\nSize: ${acc.employeeCount} employees`;
          if (acc.region) context += `\nRegion: ${acc.region}`;
          
          // Parse tech stack
          if (acc.techStack) {
            try {
              const stack = typeof acc.techStack === 'string' ? JSON.parse(acc.techStack) : acc.techStack;
              if (stack && typeof stack === 'object') {
                const techs = Object.values(stack).flat().filter(Boolean);
                if (techs.length > 0) {
                  context += `\nTech Stack: ${techs.slice(0, 5).join(", ")}`;
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }

          // Research field doesn't exist in schema

          // Add intent score if available
          if (acc.intentScore) {
            const score = typeof acc.intentScore === 'string' ? parseInt(acc.intentScore) : acc.intentScore;
            if (!isNaN(score) && score >= 40) {
              const level = score >= 70 ? "High" : "Medium";
              context += `\nBuying Intent: ${level} (${score}/100)`;
            }
          }

          // Add raw data insights (6sense, buying stage, trigger events, etc.)
          if (acc.rawData) {
            try {
              const raw = typeof acc.rawData === 'string' ? JSON.parse(acc.rawData) : acc.rawData;
              if (raw && typeof raw === 'object') {
                if (raw['6sense Buying Stage']) {
                  context += `\nBuying Stage: ${raw['6sense Buying Stage']}`;
                }
                if (raw.keywords && Array.isArray(raw.keywords)) {
                  context += `\nKeywords: ${raw.keywords.slice(0, 3).join(", ")}`;
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }

          return context;
        })
        .join("\n\n");

      // Build contact context
      let contactContext = "";
      if (contactData.length > 0) {
        contactContext = "\n\nTarget Contacts:\n" + contactData
          .map((contact) => {
            let ctx = `- ${contact.name}`;
            if (contact.title) ctx += ` (${contact.title})`;
            if (contact.company) ctx += ` at ${contact.company}`;
            return ctx;
          })
          .join("\n");
      }

      // Build LLM prompt with Revenue Architect methodology
      const systemPrompt = OUTREACH_PROMPT;

      const userPrompt = `Generate TARGETING INTELLIGENCE for this account:

${accountContext}${contactContext}

Additional Context: ${input.prompt || "Focus on passwordless MFA and Zero Trust security."}

Remember:
- Interpret their Intent Score specifically
- Map to the RIGHT persona based on their business
- Form hypothesis from their ACTUAL tech stack
- Generate TWO ingress strategies (Rip & Replace + Innovation)
- Write a copy-paste ready cold opener with subject line
- Use their real data points, not generic templates`;

      // Call LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const generatedContent = response.choices[0]?.message?.content || "";

      return {
        content: generatedContent,
        accountCount: accountData.length,
      };
    }),
});
