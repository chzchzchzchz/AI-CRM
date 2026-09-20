import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getAccountById, getContactsByAccountId, getGongCallsByAccountId } from "./db";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } from "./_core/llm";
import { withRCP } from "./ai-system-prompt";
import { wrapUntrusted } from "./_core/untrusted";

export const bulkInsightsRouter = router({
  generateForTopLeads: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { accounts } = await import("../drizzle/schema");
      const { desc, gte } = await import("drizzle-orm");

      // Get top N accounts by intent score (70+)
      const topAccounts = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.orgId, ctx.orgId), gte(accounts.intentScore, 70)))
        .orderBy(desc(accounts.intentScore))
        .limit(input.limit);

      const results = [];
      let processed = 0;
      let failed = 0;

      for (const account of topAccounts) {
        try {
          // Get contacts and calls for this account
          const contacts = await getContactsByAccountId(ctx.orgId, account.id);
          const calls = await getGongCallsByAccountId(ctx.orgId, account.id);

          // Prepare contact list
          const contactList = contacts.slice(0, 10).map((c: any) => ({
            name: c.name,
            title: c.title,
            email: c.email,
            location: c.location
          }));

          const strategicContext = {
            account: {
              name: account.name,
              domain: account.domain,
              intentScore: account.intentScore,
              buyingStage: (account as any).sixsenseBuyingStage || 'Unknown',
              relationship: account.relationship,
              industry: account.industry,
              employeeCount: account.employeeCount,
              region: (account as any).region
            },
            contacts: contactList,
            engagement: {
              totalContacts: contacts.length,
              recentCalls: calls.length,
              lastActivity: calls[0]?.callDate || 'No recent activity'
            }
          };

          // Generate insights using standardized prompt
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: withRCP(`You are a B2B sales strategist. Generate insights using this EXACT structure:

## Executive Summary
[3 sentences: Current status, why now, recommended action]

## Key Stakeholders
| Name (EXACT) | Title (EXACT) | Priority | Role in Decision |
|---|---|---|---|
[Table with REAL contact names from data - NEVER use placeholders]

## Account Intelligence
- **Company Size:** [exact employee count]
- **Industry:** [exact industry]
- **Intent Score:** [exact score]/100
- **Buying Stage:** [stage]
- **Recent Activity:** [specific activity with dates]

## Talking Points
1. [Specific point based on real data]
2. [Specific point based on real data]
3. [Specific point based on real data]

## Next Best Actions
1. **[Action]** - [Specific person to contact] - [Timeline]
2. **[Action]** - [Specific person to contact] - [Timeline]
3. **[Action]** - [Specific person to contact] - [Timeline]

## Risks & Objections
- **[Risk]:** [How to address]
- **[Risk]:** [How to address]

CRITICAL RULES:
- Use EXACT contact names and titles from data (e.g., 'Sarah Chen - VP Sales')
- Use EXACT employee counts, intent scores, and metrics from data
- Reference REAL call transcripts if provided
- NEVER use placeholder names like 'Jennifer Smith' or 'John Doe'
- If data is missing, state 'Data not available' - do NOT make up information
- Timelines in "Next Best Actions" must be relative (e.g., "within 1 week", "by end of month")
  — NEVER invent a specific calendar date. There is no date in the data above, so any
  date you'd write would be fabricated, and it has been observed landing years in the past.
- Output ONLY the structure above, starting directly with "## Executive Summary". Do not
  include any reasoning, planning, chain-of-thought, or tags like <COGNITION_START> before
  or around it — this text is stored as the account's insight and shown to a sales rep, not
  a scratchpad.`)
              },
              {
                role: "user",
                content: `Generate strategic insights using the standardized structure above. Use ONLY the real data provided below:\n\n${wrapUntrusted(
                  "account data and contacts",
                  `ACCOUNT DATA:\n${JSON.stringify(strategicContext, null, 2)}\n\nREAL CONTACTS (use these EXACT names):\n${contactList.map((c: any) => `- ${c.name} - ${c.title}`).join('\n')}`
                )}`
              }
            ]
          });

          const { content: recommendations, available } = llmText(response);

          // If the model was unreachable, nothing was actually generated for this
          // account — caching the "unavailable" note and reporting success would show
          // a green checkmark for work that never happened. Count it as a failure with
          // the real reason instead, and leave any prior cached insight untouched.
          if (!available) {
            results.push({
              accountId: account.id,
              accountName: account.name,
              success: false,
              error: LLM_UNAVAILABLE_NOTE
            });
            failed++;
            continue;
          }

          // Defense in depth for the prompt rule above: some reasoning-style free-tier
          // models wrap the requested markdown in their own scratchpad (observed live:
          // <COGNITION_START>...<FINAL_RESPONSE>) despite being told not to. Strip
          // anything before the actual "## Executive Summary" heading so what gets
          // cached and shown to a rep is the insight, not the model's internal planning.
          const summaryIdx = recommendations.search(/##\s*Executive Summary/i);
          const cleanedRecommendations = summaryIdx > 0 ? recommendations.slice(summaryIdx) : recommendations;

          // Store in cache
          const { updateAccount } = await import("./db");
          await updateAccount(ctx.orgId, account.id, {
            aiInsightsCache: cleanedRecommendations,
            aiCacheUpdatedAt: new Date()
          } as any);

          results.push({
            accountId: account.id,
            accountName: account.name,
            success: true,
            insights: cleanedRecommendations
          });
          processed++;
        } catch (error: any) {
          results.push({
            accountId: account.id,
            accountName: account.name,
            success: false,
            error: error.message
          });
          failed++;
        }
      }

      return {
        total: topAccounts.length,
        processed,
        failed,
        results
      };
    }),
  // (Removed getProgress: it returned hardcoded zeros, tracked no real job, and had no
  // caller. Bulk generation is synchronous — the generate mutation returns the full result.)
});
