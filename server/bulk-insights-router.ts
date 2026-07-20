import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getAccountById, getContactsByAccountId, getGongCallsByAccountId } from "./db";
import { invokeLLM } from "./_core/llm";
import { withRCP } from "./ai-system-prompt";

export const bulkInsightsRouter = router({
  generateForTopLeads: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }))
    .mutation(async ({ input }) => {
      const { getDb } = await import("./db");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const { accounts } = await import("../drizzle/schema");
      const { desc, gte } = await import("drizzle-orm");

      // Get top N accounts by intent score (70+)
      const topAccounts = await db
        .select()
        .from(accounts)
        .where(gte(accounts.intentScore, 70))
        .orderBy(desc(accounts.intentScore))
        .limit(input.limit);

      const results = [];
      let processed = 0;
      let failed = 0;

      for (const account of topAccounts) {
        try {
          // Get contacts and calls for this account
          const contacts = await getContactsByAccountId(account.id);
          const calls = await getGongCallsByAccountId(account.id);

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
- If data is missing, state 'Data not available' - do NOT make up information`)
              },
              {
                role: "user",
                content: `Generate strategic insights using the standardized structure above. Use ONLY the real data provided below:\n\nACCOUNT DATA:\n${JSON.stringify(strategicContext, null, 2)}\n\nREAL CONTACTS (use these EXACT names):\n${contactList.map((c: any) => `- ${c.name} - ${c.title}`).join('\n')}`
              }
            ]
          });

          const recommendations = response.choices[0]?.message?.content;
          const recommendationsText = typeof recommendations === 'string' ? recommendations : 'Unable to generate insights';

          // Store in cache
          const { updateAccount } = await import("./db");
          await updateAccount(account.id, {
            aiInsightsCache: recommendationsText,
            aiCacheUpdatedAt: new Date()
          } as any);

          results.push({
            accountId: account.id,
            accountName: account.name,
            success: true,
            insights: recommendationsText
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

  getProgress: protectedProcedure
    .query(async () => {
      // This would track progress in a real implementation
      // For now, just return a placeholder
      return {
        total: 0,
        processed: 0,
        failed: 0,
        inProgress: false
      };
    })
});
