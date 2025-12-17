import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { router, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { getAllAccounts, getAccountById, updateAccount, getAllPeople, getPeopleByCompany, getContactsByAccountId, /* createClayRequest, updateClayRequest, getAllClayRequests, getClayRequest, */ upsertAccount, upsertPerson, getAllGongCalls, getGongCallsByCompany, getGongCallsByAccountId } from "./db";
import { enrichAccountWithAI, analyzeGongCall, generateOutreachEmail, intelligentSearch, prioritizeContacts } from "./ai";
import { enrichAccount } from "./sixsense";
import { conversationWithMemory, generateAccountSummary, generateContactSummary } from "./aiContext";
import { clayImportRouter } from "./clay-import";
import { clayWebhookRouter } from "./clay-webhook";
import { sequencesRouter } from "./sequences";
import { rfpRouter } from "./rfp-scraper";
import { outreachRouter } from "./outreach";
import { geminiRouter } from "./gemini";
import { clayRouter } from "./clay";
import { validationRouter } from "./validation-router";
import { priorityActionsRouter } from "./priority-actions-router";
import { bulkInsightsRouter } from "./bulk-insights-router";
import { sixsenseRouter } from "./sixsense-router";
import { sixsenseAnalyticsRouter } from "./sixsense-analytics";
import { csvProcessorRouter } from "./csv-processor-router";


export const appRouter = router({
  clay: clayRouter,
  gemini: geminiRouter,
  validation: validationRouter,
  priorityActions: priorityActionsRouter,
  bulkInsights: bulkInsightsRouter,
  sixsense: sixsenseRouter,
  csvProcessor: csvProcessorRouter,
  sixsenseAnalytics: sixsenseAnalyticsRouter,
  analytics: router({
    overview: publicProcedure.query(async () => {
      const accounts = await getAllAccounts();
      const people = await getAllPeople();
      const calls = await getAllGongCalls();

      // Calculate intent score distribution
      const intentScores = accounts
        .map(a => {
          const score = a.intentScore;
          if (typeof score === 'string') {
            const parsed = parseInt(score, 10);
            return isNaN(parsed) ? null : parsed;
          }
          return score;
        })
        .filter((score): score is number => score !== null);
      const avgIntentScore = intentScores.length > 0
        ? Math.round(intentScores.reduce((sum, score) => sum + score, 0) / intentScores.length)
        : 0;

      // Parse rawData for buying stage
      const buyingStages = accounts.reduce((acc, account) => {
        let stage = 'Unknown';
        if (account.rawData && typeof account.rawData === 'string') {
          try {
            const data = JSON.parse(account.rawData);
            stage = data['6sense Buying Stage'] || data.buyingStage || 'Unknown';
          } catch {}
        }
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Industry distribution
      const industries = accounts.reduce((acc, account) => {
        const industry = account.industry || 'Unknown';
        acc[industry] = (acc[industry] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top accounts by intent score
      const topAccounts = accounts
        .map(a => ({
          ...a,
          parsedIntentScore: typeof a.intentScore === 'string' ? parseInt(a.intentScore, 10) || 0 : (a.intentScore || 0)
        }))
        .filter(a => a.parsedIntentScore > 0)
        .sort((a, b) => b.parsedIntentScore - a.parsedIntentScore)
        .slice(0, 10);

      // Gong calls by month
      const callsByMonth = calls.reduce((acc, call) => {
        if (call.callDate) {
          const month = new Date(call.callDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          acc[month] = (acc[month] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      return {
        totalAccounts: accounts.length,
        totalContacts: people.length,
        totalCalls: calls.length,
        avgIntentScore,
        buyingStages,
        industries,
        topAccounts,
        callsByMonth,
      };
    }),
  }),
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  accounts: router({
    list: publicProcedure.query(async () => {
      return await getAllAccounts();
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getAccountById(input.id);
      }),
    getStats: publicProcedure.query(async () => {
      const accounts = await getAllAccounts();
      const people = await getAllPeople();
      const calls = await getAllGongCalls();
      
      // Calculate hot leads (intent score >= 70)
      const hotLeads = accounts.filter(a => {
        const score = typeof a.intentScore === 'string' ? parseInt(a.intentScore, 10) : a.intentScore;
        return score && score >= 70;
      }).length;
      
      // Calculate warm leads (intent score 40-69)
      const warmLeads = accounts.filter(a => {
        const score = typeof a.intentScore === 'string' ? parseInt(a.intentScore, 10) : a.intentScore;
        return score && score >= 40 && score < 70;
      }).length;
      
      return {
        totalAccounts: accounts.length,
        hotLeads,
        warmLeads,
        totalContacts: people.length,
        totalCalls: calls.length,
      };
    }),
    enrichWith6sense: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.id);
        if (!account?.domain) {
          throw new Error('Account not found or missing domain');
        }
        
        // AI-powered enrichment will be implemented
        return { message: 'AI enrichment coming soon', accountId: input.id };
      }),
  }),

  calls: router({
    list: publicProcedure.query(async () => {
      return await getAllGongCalls();
    }),
    getByAccountId: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getGongCallsByAccountId(input.accountId);
      }),
  }),

  people: router({
    list: publicProcedure.query(async () => {
      return await getAllPeople();
    }),
    getByCompany: publicProcedure
      .input(z.object({ company: z.string() }))
      .query(async ({ input }) => {
        return await getPeopleByCompany(input.company);
      }),
    getByAccountId: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getContactsByAccountId(input.accountId);
      }),
    prioritize: publicProcedure
      .input(z.object({ accountId: z.number().optional() }))
      .query(async ({ input }) => {
        const contacts = input.accountId
          ? await getPeopleByCompany(String(input.accountId))
          : await getAllPeople();
        const account = input.accountId ? await getAccountById(input.accountId) : null;
        return await prioritizeContacts(contacts, account || {});
      }),
  }),

  // claySearch: router({
  //   search: publicProcedure
  //     .input(z.object({ searchQuery: z.string() }))
  //     .mutation(async ({ input }) => {
  //       const requestId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  //       
  //       await createClayRequest(requestId, input.searchQuery);
  //       
  //       const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;
  //       if (!clayWebhookUrl) {
  //         throw new Error("CLAY_WEBHOOK_URL not configured in environment variables");
  //       }
  //       
  //       try {
  //         const response = await fetch(clayWebhookUrl, {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({ 
  //             searchQuery: input.searchQuery, 
  //             request_id: requestId 
  //           }),
  //         });
  //         
  //         if (!response.ok) {
  //           throw new Error(`Clay webhook failed: ${response.statusText}`);
  //         }
  //         
  //         return { success: true, requestId, message: "Search sent to Clay" };
  //       } catch (error: any) {
  //         await updateClayRequest(requestId, "error", { error: error.message });
  //         throw error;
  //       }
  //     }),
  //   getStatus: publicProcedure
  //     .input(z.object({ requestId: z.string() }))
  //     .query(async ({ input }) => {
  //       return await getClayRequest(input.requestId);
  //     }),
  //   listRequests: publicProcedure.query(async () => {
  //       return await getAllClayRequests();
  //   }),
  // }),

  gong: router({
    list: publicProcedure.query(async () => {
      return await getAllGongCalls();
    }),
    getByCompany: publicProcedure
      .input(z.object({ company: z.string() }))
      .query(async ({ input }) => {
        return await getGongCallsByCompany(input.company);
      }),
    getByAccountId: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await getGongCallsByAccountId(input.accountId);
      }),
  }),

  // AI-powered features
  ai: router({
    enrichAccount: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error('Account not found');
        return await enrichAccountWithAI(account);
      }),

    analyzeCall: publicProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ input }) => {
        const calls = await getAllGongCalls();
        const call = calls.find(c => c.id === input.callId);
        if (!call) throw new Error('Call not found');
        return await analyzeGongCall(call);
      }),

    generateEmail: publicProcedure
      .input(z.object({ 
        accountId: z.number(), 
        contactId: z.number(),
        context: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        const people = await getAllPeople();
        const contact = people.find(p => p.id === input.contactId);
        if (!account || !contact) throw new Error('Account or contact not found');
        return await generateOutreachEmail(account, contact, input.context);
      }),

    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .mutation(async ({ input }) => {
        return await intelligentSearch(input.query);
      }),

    prioritizeContacts: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        const contacts = await getPeopleByCompany(account?.name || '');
        return await prioritizeContacts(contacts, account);
      }),

    chat: publicProcedure
      .input(z.object({ 
        query: z.string(),
        accountId: z.number().optional(),
        contactId: z.number().optional(),
        conversationHistory: z.array(z.object({
          role: z.enum(['system', 'user', 'assistant']),
          content: z.string()
        })).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        return await conversationWithMemory({
          query: input.query,
          accountId: input.accountId,
          contactId: input.contactId,
          userId: ctx.user?.id,
          conversationHistory: input.conversationHistory
        });
      }),

    generateAccountSummary: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        return await generateAccountSummary(input.accountId);
      }),

    generateContactSummary: publicProcedure
      .input(z.object({ contactId: z.number() }))
      .mutation(async ({ input }) => {
        return await generateContactSummary(input.contactId);
      }),

    compileOverview: publicProcedure
      .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error('Account not found');

        // Check cache first (valid for 24 hours)
        const cacheAge = (account as any).aiCacheUpdatedAt ? Date.now() - new Date((account as any).aiCacheUpdatedAt).getTime() : Infinity;
        const cacheValid = cacheAge < 24 * 60 * 60 * 1000; // 24 hours

        if (!input.forceRefresh && (account as any).aiOverviewCache && cacheValid) {
          return { 
            summary: (account as any).aiOverviewCache,
            cached: true,
            cacheAge: Math.floor(cacheAge / (60 * 1000)) // minutes
          };
        }

        // Generate new summary
        const people = await getContactsByAccountId(input.accountId);
        const calls = await getGongCallsByAccountId(input.accountId);

        const dataContext = {
          company: {
            name: account.name,
            domain: account.domain,
            industry: account.industry,
            employees: account.employeeCount,
            description: account.description,
            intentScore: account.intentScore,
            buyingStage: (account as any).buyingStage || 'Unknown',
            relationship: account.relationship
          },
          contacts: people.length,
          recentCalls: calls.length,
          techStack: account.techStack ? 'Available' : 'Not available',
          triggers: account.triggerEvents ? 'Available' : 'None',
          rawData: account.rawData
        };

        try {
          const { invokeLLM } = await import("./_core/llm");
          const { withRCP } = await import("./ai-system-prompt");
          // const { searchTool, executeToolCall } = await import("./_core/webSearch");
          
          // First call without tool support (webSearch module not available)
          let response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: withRCP(`You are an expert sales intelligence analyst. Analyze this account and provide actionable insights for the sales team.`)
              },
              {
                role: "user",
                content: `Analyze this account and provide insights:\n\n${JSON.stringify(dataContext, null, 2)}`
              }
            ]
          });

          const summary = response.choices[0]?.message?.content;
          let summaryText = typeof summary === 'string' ? summary : 'Unable to generate summary';
          
          // POST-PROCESS: Remove hallucinated content that doesn't exist in our data
          // The LLM keeps making up email/activity data we don't track
          const hallucinations = [
            // Activity counts
            /Engagement Activities:\s*\d+/gi,
            /\d+\s*Activities/gi,
            /\d+\s*QA/gi,
            /\d+\s*Qualified Activities/gi,
            /\d+\s*total engagement/gi,
            /\d+\s*engagement activities/gi,
            /\d+\s*sales activities/gi,
            /\d+\s*recorded activities/gi,
            // Email mentions
            /Email Send\s*\([^)]*\)/gi,
            /Email Send\s*\d+\s*days ago/gi,
            /Email Open\s*\([^)]*\)/gi,
            /Last Sales Activity:\s*Email[^.]*\./gi,
            /Recent Activity:.*?Email[^.]*\./gi,
            /last activity was only \d+ days ago/gi,
            // Bombora mentions
            /Latest Engagement:\s*Bombora[^.]*\./gi,
            /Bombora\s*\([^)]*\)/gi,
            /Bombora data[^.]*\./gi,
            /Bombora\/6sense data[^.]*\./gi,
            // Generic activity claims
            /recent engagement activity[^.]*\./gi,
            /recent sales activity[^.]*\./gi,
            /significant historical engagement[^.]*\./gi,
          ];
          
          for (const pattern of hallucinations) {
            summaryText = summaryText.replace(pattern, '[DATA NOT AVAILABLE]');
          }
          
          // Replace entire rows in tables that mention hallucinated data
          summaryText = summaryText.replace(/\|[^|]*Engagement Activities[^|]*\|[^|]*\d+[^|]*\|[^|]*\|/gi, '| Engagement Activities | [DATA NOT TRACKED] | [NO ENGAGEMENT DATA AVAILABLE] |');
          summaryText = summaryText.replace(/\|[^|]*Sales Activity[^|]*\|[^|]*\d+[^|]*\|[^|]*\|/gi, '| Sales Activity | [DATA NOT TRACKED] | [NO SALES ACTIVITY DATA AVAILABLE] |');
          summaryText = summaryText.replace(/\|[^|]*Last Activity[^|]*\|[^|]*Bombora[^|]*\|[^|]*\|/gi, '| Last Activity | [DATA NOT TRACKED] | [NO ACTIVITY TRACKING AVAILABLE] |');

          // Store in cache
          await updateAccount(input.accountId, {
            aiOverviewCache: summaryText,
            aiCacheUpdatedAt: new Date()
          } as any);

          return { summary: summaryText, cached: false, cacheAge: 0 };
        } catch (error) {
          console.error('Failed to generate AI overview:', error);
          // Return null so the UI shows "No summary available"
          return null;
        }
      }),

    compileResearch: publicProcedure
      .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error('Account not found');

        // Check cache first (valid for 24 hours)
        const cacheAge = (account as any).aiCacheUpdatedAt ? Date.now() - new Date((account as any).aiCacheUpdatedAt).getTime() : Infinity;
        const cacheValid = cacheAge < 24 * 60 * 60 * 1000;

        if (!input.forceRefresh && (account as any).aiResearchCache && cacheValid) {
          let cachedData;
          try {
            cachedData = JSON.parse((account as any).aiResearchCache);
          } catch {
            cachedData = { insights: (account as any).aiResearchCache };
          }
          return { ...cachedData, cached: true, cacheAge: Math.floor(cacheAge / (60 * 1000)) };
        }

        // Parse triggers and news from rawData
        let triggers: any = {};
        let newsData: any = {};
        try {
          if (account.triggerEvents) {
            triggers = typeof account.triggerEvents === 'string' ? JSON.parse(account.triggerEvents) : account.triggerEvents;
          }
          if (account.rawData) {
            const raw = typeof account.rawData === 'string' ? JSON.parse(account.rawData) : account.rawData;
            newsData = {
              fundraising: raw['Latest Fundraising'],
              fundingGrowth: raw['Latest Funding Growth'],
              news: raw['Most Recent News']
            };
          }
        } catch (e) {
          console.error('Failed to parse research data:', e);
        }

        const researchContext = {
          company: account.name,
          industry: account.industry,
          triggers,
          news: newsData
        };

        const { invokeLLM } = await import("./_core/llm");
        const { withRCP } = await import("./ai-system-prompt");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: withRCP("You are a competitive intelligence analyst. Synthesize the research data into a clear narrative covering: 1) Recent trigger events and what they mean, 2) Funding/growth signals and implications, 3) Market position and competitive landscape, 4) Strategic opportunities for engagement. Be concise and actionable.")
            },
            {
              role: "user",
              content: `Compile research insights for this account:\n\n${JSON.stringify(researchContext, null, 2)}`
            }
          ]
        });

        const insights = response.choices[0]?.message?.content;
        const insightsText = typeof insights === 'string' ? insights : 'No research insights available';
        
        const result = {
          insights: insightsText,
          rawTriggers: triggers,
          rawNews: newsData
        };

        // Store in cache
        await updateAccount(input.accountId, {
          aiResearchCache: JSON.stringify(result),
          aiCacheUpdatedAt: new Date()
        } as any);

        return { ...result, cached: false, cacheAge: 0 };
      }),

    generateStrategicInsights: publicProcedure
      .input(z.object({ accountId: z.number(), forceRefresh: z.boolean().optional() }))
      .query(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account) throw new Error('Account not found');

        // Check cache first (valid for 24 hours)
        const cacheAge = (account as any).aiCacheUpdatedAt ? Date.now() - new Date((account as any).aiCacheUpdatedAt).getTime() : Infinity;
        const cacheValid = cacheAge < 24 * 60 * 60 * 1000;

        if (!input.forceRefresh && (account as any).aiInsightsCache && cacheValid) {
          return { 
            recommendations: (account as any).aiInsightsCache,
            cached: true,
            cacheAge: Math.floor(cacheAge / (60 * 1000))
          };
        }

        const people = await getContactsByAccountId(input.accountId);
        const calls = await getGongCallsByAccountId(input.accountId);

        // AGGREGATE ENGAGEMENT DATA FROM CONTACTS (this is where the real data lives!)
        const engagementData = people.reduce((acc: any, p: any) => {
          acc.totalEngagementActivities += (p.engagementActivities || 0);
          acc.totalSalesActivities += (p.salesActivities || 0);
          if (p.daysSinceLastEngagement !== null && p.daysSinceLastEngagement !== undefined) {
            if (acc.mostRecentEngagementDays === null || p.daysSinceLastEngagement < acc.mostRecentEngagementDays) {
              acc.mostRecentEngagementDays = p.daysSinceLastEngagement;
            }
          }
          if (p.daysSinceLastSalesActivity !== null && p.daysSinceLastSalesActivity !== undefined) {
            if (acc.mostRecentSalesActivityDays === null || p.daysSinceLastSalesActivity < acc.mostRecentSalesActivityDays) {
              acc.mostRecentSalesActivityDays = p.daysSinceLastSalesActivity;
              acc.lastSalesActivity = p.lastSalesActivity;
            }
          }
          if (p.lastEngagementActivity) {
            acc.lastEngagementActivity = p.lastEngagementActivity;
          }
          return acc;
        }, {
          totalEngagementActivities: 0,
          totalSalesActivities: 0,
          mostRecentEngagementDays: null as number | null,
          mostRecentSalesActivityDays: null as number | null,
          lastSalesActivity: null as string | null,
          lastEngagementActivity: null as string | null
        });

        // Prepare contact list with real names and titles (TOP 10 ONLY)
        const contactList = people.slice(0, 10).map((p: any) => ({
          name: p.name,
          title: p.title,
          email: p.email,
          department: p.department,
          managementLevel: p.managementLevel,
          engagementActivities: p.engagementActivities,
          salesActivities: p.salesActivities,
          daysSinceLastEngagement: p.daysSinceLastEngagement,
          lastSalesActivity: p.lastSalesActivity
        }));

        // Parse tech stack data
        let techStackData = null;
        let securityStackData = null;
        try {
          if (account.techStack) {
            techStackData = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
          }
          if ((account as any).securityStack) {
            securityStackData = typeof (account as any).securityStack === 'string' ? JSON.parse((account as any).securityStack) : (account as any).securityStack;
          }
        } catch (e) {
          // Ignore parse errors
        }

        // Import VECTOR scoring
        const { calculateVectorScores, generateDeepAnalysisPrompt } = await import('./vectorScoring');
        
        // Prepare account data for VECTOR scoring
        const accountData = {
          name: account.name,
          domain: account.domain || undefined,
          industry: account.industry || undefined,
          employeeCount: account.employeeCount || undefined,
          region: (account as any).region || undefined,
          relationship: account.relationship || undefined,
          intentScore: account.intentScore || undefined,
          buyingStage: (account as any).buyingStage || undefined,
          temperature: (account as any).temperature || undefined,
          totalContacts: people.length,
          totalCalls: calls.length,
          lastCallDate: calls[0]?.callDate || undefined,
          // REAL ENGAGEMENT DATA FROM CONTACTS TABLE
          engagementActivities: engagementData.totalEngagementActivities,
          salesActivities: engagementData.totalSalesActivities,
          mostRecentEngagementDays: engagementData.mostRecentEngagementDays,
          mostRecentSalesActivityDays: engagementData.mostRecentSalesActivityDays,
          lastSalesActivity: engagementData.lastSalesActivity,
          lastEngagementActivity: engagementData.lastEngagementActivity,
          techStack: techStackData,
          securityStack: securityStackData,
          contacts: contactList,
          calls: calls.slice(0, 5).map((c: any) => ({
            date: c.callDate,
            duration: c.duration,
            summary: c.summary
          }))
        };
        
        // Calculate VECTOR scores
        const vectorScores = calculateVectorScores(accountData);
        
        // Generate deep analysis prompt
        const analysisPrompt = generateDeepAnalysisPrompt(accountData, vectorScores);

        const { invokeLLM } = await import("./_core/llm");
        const { withRCP } = await import("./ai-system-prompt");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: withRCP("You are a strategic sales intelligence analyst. Provide deep, actionable insights.")
            },
            {
              role: "user",
              content: analysisPrompt
            }
          ]
        });

        const recommendations = response.choices[0]?.message?.content;
        const recommendationsText = typeof recommendations === 'string' ? recommendations : 'Unable to generate insights';

        // Store in cache
        await updateAccount(input.accountId, {
          aiInsightsCache: recommendationsText,
          aiCacheUpdatedAt: new Date()
        } as any);

        return { recommendations: recommendationsText, cached: false, cacheAge: 0 };
      }),

    analyzeTechStack: publicProcedure
      .input(z.object({ accountId: z.number() }))
      .mutation(async ({ input }) => {
        const account = await getAccountById(input.accountId);
        if (!account || !account.techStack) {
          return { categories: {}, raw: "No technology stack data available" };
        }

        // Parse the stack data
        let stackData: any = {};
        try {
          stackData = typeof account.techStack === 'string' ? JSON.parse(account.techStack) : account.techStack;
        } catch {
          return { categories: {}, raw: "Invalid technology stack data" };
        }

        // Convert to string for AI analysis
        const stackString = JSON.stringify(stackData, null, 2);

        // Use AI to categorize and filter the tech stack
        const { invokeLLM } = await import("./_core/llm");
        const { withRCP } = await import("./ai-system-prompt");
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: withRCP("You are a technology stack analyst. Analyze the provided technology stack data and categorize it into clear, useful categories. Always include these categories even if empty: MFA Providers, SSO Providers, EDR/Security, CRM, Communication Tools, Development Tools, Cloud Infrastructure. For each category, list the relevant technologies found. If a category has no technologies, explicitly state 'None'. Be concise and filter out noise.")
            },
            {
              role: "user",
              content: `Analyze this technology stack and categorize it:\n\n${stackString}\n\nProvide a clear breakdown with categories.`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "tech_stack_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  mfa: { type: "array", items: { type: "string" } },
                  sso: { type: "array", items: { type: "string" } },
                  edr: { type: "array", items: { type: "string" } },
                  crm: { type: "array", items: { type: "string" } },
                  communication: { type: "array", items: { type: "string" } },
                  development: { type: "array", items: { type: "string" } },
                  cloud: { type: "array", items: { type: "string" } },
                  security: { type: "array", items: { type: "string" } },
                  other: { type: "array", items: { type: "string" } }
                },
                required: ["mfa", "sso", "edr", "crm", "communication", "development", "cloud", "security", "other"],
                additionalProperties: false
              }
            }
          }
        });

        const content = response.choices[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          return { categories: {}, raw: stackString };
        }

        const categories = JSON.parse(content);
        return { categories, raw: stackString };
      }),
  }),

  // Clay data import
  clayImport: clayImportRouter,
  sequences: sequencesRouter,
  rfps: rfpRouter,
  clayWebhook: clayWebhookRouter,
  outreach: outreachRouter,

});

export type AppRouter = typeof appRouter;
