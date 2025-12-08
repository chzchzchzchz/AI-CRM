import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAccountById } from "./db";
import { queryGemini } from "./gemini-automation";

export const geminiRouter = router({
  /**
   * Research an account using Gemini gem
   */
  researchAccount: protectedProcedure
    .input(
      z.object({
        accountId: z.number(),
        customPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const account = await getAccountById(input.accountId);
      
      if (!account) {
        throw new Error("Account not found");
      }

      // Build context from account data
      let context = `Company: ${account.name}\n`;
      
      if (account.industry) {
        context += `Industry: ${account.industry}\n`;
      }
      if (account.employeeCount) {
        context += `Employees: ${account.employeeCount}\n`;
      }
      
      if (account.region) {
        context += `Region: ${account.region}\n`;
      }
      
      if (account.domain) {
        context += `Website: ${account.domain}\n`;
      }

      // Parse tech stack
      if (account.techStack) {
        try {
          const stack = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
          if (stack && typeof stack === 'object') {
            const techs = Object.values(stack).flat().filter(Boolean);
            if (techs.length > 0) {
              context += `\nTech Stack:\n${techs.slice(0, 10).map(t => `- ${t}`).join('\n')}\n`;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Research insights field doesn't exist in schema
      // Removed to fix type errors

      // Build the Gemini prompt
      const defaultPrompt = `You are an expert B2B sales researcher for the company, a company that provides passwordless MFA and modern SSO solutions.

Analyze this target account and provide:
1. **Key Decision Makers** - Who would be involved in security/auth purchasing decisions?
2. **Pain Points** - What authentication/security challenges might they face?
3. **Buying Signals** - Any indicators they're in-market for MFA/SSO solutions?
4. **Competitive Landscape** - What auth solutions might they currently use?
5. **Recommended Approach** - How should we position the company to them?

Keep your analysis concise, actionable, and focused on sales intelligence.

${context}`;

      const prompt = input.customPrompt || defaultPrompt;

      // Query Gemini
      try {
        const geminiResponse = await queryGemini(prompt);
        
        return {
          success: true,
          research: geminiResponse,
          accountName: account.name,
        };
      } catch (error) {
        console.error('[Gemini Research] Error:', error);
        
        // Return helpful error message
        if (error instanceof Error && error.message.includes('authentication')) {
          return {
            success: false,
            error: 'Gemini authentication required. Please contact admin to set up Google login.',
            accountName: account.name,
            research: undefined,
          };
        }
        
        throw error;
      }
    }),
});
