import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { eq, inArray } from "drizzle-orm";
import { contacts, accounts } from "../drizzle/schema";
import { getDb } from "./db";
import { REVENUE_ARCHITECT_CORE } from "./revenueArchitect";

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

      const account = accountData[0];
      const contact = contactData[0];

      // Parse security stack
      let securityStack: string[] = [];
      try {
        if (account.securityStack) {
          securityStack = typeof account.securityStack === 'string' 
            ? JSON.parse(account.securityStack) 
            : account.securityStack;
        }
      } catch {}

      // Build the actual email generation prompt
      const systemPrompt = `You are writing a REAL EMAIL that will be sent to a prospect. 
This is NOT internal strategy notes - this is the actual email the prospect will receive.

RULES:
1. Write ONLY the email body - no headers, no "Subject:", no internal notes
2. Keep it SHORT - 3-5 sentences max
3. First line must hook them with something SPECIFIC to their situation
4. NO "Hope this finds you well" or "I'd love to learn more"
5. ONE clear ask at the end (usually a meeting)
6. Sound like a human, not a sales robot
7. Reference their actual company/role/situation

TONE: Direct, confident, peer-to-peer. You're an expert talking to an expert.`;

      const userPrompt = `Write a cold email to send to this prospect:

RECIPIENT:
- Name: ${contact?.name || 'Unknown'}
- Title: ${contact?.title || 'Unknown'}
- Company: ${account.name}
- Industry: ${account.industry || 'Unknown'}
- Company Size: ${account.employeeCount || 'Unknown'} employees

CONTEXT:
- Intent Score: ${account.intentScore || 'Unknown'}/100 (higher = more actively researching solutions)
- Security Stack: ${securityStack.length > 0 ? securityStack.join(', ') : 'Unknown'}
${input.prompt ? `- Additional context: ${input.prompt}` : ''}

WHAT WE SELL: the company - Passwordless MFA that eliminates phishing risk. Competes with Okta, Duo, Ping Identity.

${securityStack.some(s => ['Okta', 'Duo', 'Ping', 'Microsoft Entra', 'Azure AD'].some(c => s.toLowerCase().includes(c.toLowerCase()))) 
  ? 'ANGLE: They have a competitor product - use displacement angle (their current MFA is still phishable)' 
  : 'ANGLE: Lead with value prop - passwordless = zero phishing risk'}

Write the email body only. No subject line. No signature. Just the message.`;

      // Call LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const generatedContent = response.choices[0]?.message?.content || "";

      // Generate a subject line separately
      const subjectResponse = await invokeLLM({
        messages: [
          { role: "system", content: "Generate a SHORT email subject line (under 50 chars). No quotes. No emojis. Make it specific to the recipient's company or role. Sound human, not salesy." },
          { role: "user", content: `Company: ${account.name}\nRecipient: ${contact?.name || 'Prospect'} (${contact?.title || 'Security Leader'})\nTopic: Passwordless MFA / eliminating phishing\n\nWrite just the subject line, nothing else.` },
        ],
      });

      const subjectContent = subjectResponse.choices[0]?.message?.content;
const subjectLine = (typeof subjectContent === 'string' ? subjectContent.trim() : `Security at ${account.name}`);

      return {
        content: generatedContent,
        subject: subjectLine,
        accountCount: accountData.length,
      };
    }),
});
