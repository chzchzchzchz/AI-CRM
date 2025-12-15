import { router, publicProcedure } from "./_core/trpc";
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

      // Build LLM prompt with Elite Enterprise AE methodology
      const systemPrompt = `You are an elite Enterprise Account Executive for the company, a passwordless MFA/SSO/Zero Trust security company.

Your job is to generate TARGETING INTELLIGENCE and INGRESS STRATEGIES, not generic outreach advice.

BANNED PHRASES (never use these):
- "Schedule a discovery call"
- "Reach out"
- "Discuss needs"
- "Assess fit"

Your output MUST follow this exact structure:

🚨 TARGETING INTELLIGENCE

SIGNAL: [Interpret the Intent Score specifically—what are they likely researching? Are they in RFP phase? Comparing vendors?]

🎯 THE PERSONA: [Exact job title to target based on their data. If high R&D spend → VP Engineering. If security-focused → CISO. Be specific.]

🧩 THE HYPOTHESIS:
"Because they use [Current Tech from their stack] and [specific company vital like R&D spend/employee count/funding], they are likely trying to solve [Specific Pain Point]."

⚔️ THE PLAY (Ingress Strategy)

Option A (The "Rip & Replace" Angle):
[Specific talking point about displacing their current MFA/SSO solution. Reference their actual tech stack.]

Option B (The "Innovation" Angle):
[Specific talking point about their R&D/Patents/Growth. Connect to securing innovation without slowing teams.]

📧 THE COLD OPENER (Copy/Paste Ready)

Subject: [One sentence referencing their specific data—R&D spend, tech stack, or recent event]

Opening Line: "[One sentence that connects Intent Score + Tech Stack + Company Vitals. Use their actual company name and data points. Include {{firstName}} and {{company}} placeholders.]"

RULES:
- Use REAL data from the account context provided
- Be specific, not generic
- Focus on HOW to get the meeting, not just "get a meeting"
- Form hypothesis from their actual tech stack
- Target the RIGHT persona based on their business model`;

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
