import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export const appRouter = router({
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
    list: protectedProcedure.query(async () => {
      return await db.getAllAccounts();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getAccountById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        domain: z.string().optional(),
        industry: z.string().optional(),
        employeeCount: z.number().optional(),
        revenue: z.string().optional(),
        location: z.string().optional(),
        description: z.string().optional(),
        website: z.string().optional(),
        linkedinUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createAccount(input);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().optional(),
          domain: z.string().optional(),
          industry: z.string().optional(),
          employeeCount: z.number().optional(),
          revenue: z.string().optional(),
          location: z.string().optional(),
          description: z.string().optional(),
          website: z.string().optional(),
          linkedinUrl: z.string().optional(),
          securityStack: z.string().optional(),
          techStack: z.string().optional(),
          triggerEvents: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        await db.updateAccount(input.id, input.data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAccount(input.id);
        return { success: true };
      }),
  }),

  contacts: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllContacts();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getContactById(input.id);
      }),
    
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await db.getContactsByAccountId(input.accountId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        title: z.string().optional(),
        department: z.string().optional(),
        linkedinUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createContact(input);
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          email: z.string().optional(),
          phone: z.string().optional(),
          title: z.string().optional(),
          department: z.string().optional(),
          linkedinUrl: z.string().optional(),
          lastContactedAt: z.date().optional(),
          engagementScore: z.number().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        await db.updateContact(input.id, input.data);
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteContact(input.id);
        return { success: true };
      }),
  }),

  calls: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllCalls();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getCallById(input.id);
      }),
    
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await db.getCallsByAccountId(input.accountId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        accountId: z.number().optional(),
        contactId: z.number().optional(),
        title: z.string().optional(),
        duration: z.number().optional(),
        recordingUrl: z.string().optional(),
        transcriptUrl: z.string().optional(),
        gongCallId: z.string().optional(),
        sentiment: z.string().optional(),
        keyTopics: z.string().optional(),
        actionItems: z.string().optional(),
        callDate: z.date(),
      }))
      .mutation(async ({ input }) => {
        return await db.createCall(input);
      }),
  }),

  rfps: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllRFPs();
    }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getRFPById(input.id);
      }),
    
    create: protectedProcedure
      .input(z.object({
        accountId: z.number().optional(),
        title: z.string(),
        description: z.string().optional(),
        agency: z.string().optional(),
        solicitationNumber: z.string().optional(),
        postedDate: z.date().optional(),
        responseDeadline: z.date().optional(),
        awardAmount: z.string().optional(),
        samGovId: z.string().optional(),
        url: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createRFP(input);
      }),
  }),

  intentScores: router({
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await db.getIntentScoresByAccountId(input.accountId);
      }),
    
    create: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        score: z.number(),
        category: z.string().optional(),
        keywords: z.string().optional(),
        source: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return await db.createIntentScore(input);
      }),
  }),

  ai: router({
    generateAccountResearch: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        accountName: z.string(),
        industry: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const prompt = `Generate a comprehensive research summary for the account "${input.accountName}".
Industry: ${input.industry || 'Unknown'}
Description: ${input.description || 'No description available'}

Provide:
1. Key business insights
2. Potential pain points
3. Recommended talking points
4. Competitive landscape
5. Suggested outreach strategy`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a B2B sales intelligence assistant. Provide actionable insights for sales teams." },
            { role: "user", content: prompt },
          ],
        });

        const aiResponse = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : "";

        await db.createAIContext({
          accountId: input.accountId,
          contextType: "research",
          prompt,
          response: aiResponse,
          model: "gpt-4",
          createdBy: ctx.user.id,
        });

        return { research: aiResponse };
      }),
    
    generateOutreachRecommendation: protectedProcedure
      .input(z.object({
        accountId: z.number(),
        accountName: z.string(),
        contactName: z.string(),
        contactTitle: z.string().optional(),
        recentActivity: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const prompt = `Generate a personalized outreach recommendation for:
Contact: ${input.contactName}
Title: ${input.contactTitle || 'Unknown'}
Account: ${input.accountName}
Recent Activity: ${input.recentActivity || 'None'}

Provide:
1. Personalized email subject line
2. Email opening paragraph
3. Key value propositions to highlight
4. Call-to-action`;

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are a B2B sales outreach specialist. Create personalized, compelling outreach messages." },
            { role: "user", content: prompt },
          ],
        });

        const aiResponse = typeof response.choices[0]?.message?.content === 'string' 
          ? response.choices[0].message.content 
          : "";

        await db.createAIContext({
          accountId: input.accountId,
          contextType: "outreach",
          prompt,
          response: aiResponse,
          model: "gpt-4",
          createdBy: ctx.user.id,
        });

        return { recommendation: aiResponse };
      }),
    
    getContextByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await db.getAIContextByAccountId(input.accountId);
      }),
  }),

  documents: router({
    upload: protectedProcedure
      .input(z.object({
        accountId: z.number().optional(),
        contactId: z.number().optional(),
        callId: z.number().optional(),
        fileName: z.string(),
        fileContent: z.string(), // base64 encoded
        fileType: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        const buffer = Buffer.from(input.fileContent, 'base64');
        const fileKey = `documents/${input.accountId || 'general'}/${Date.now()}-${input.fileName}`;
        
        const { url } = await storagePut(fileKey, buffer, input.fileType);

        await db.createDocument({
          accountId: input.accountId,
          contactId: input.contactId,
          callId: input.callId,
          fileName: input.fileName,
          fileKey,
          fileUrl: url,
          fileType: input.fileType,
          fileSize: buffer.length,
          uploadedBy: ctx.user.id,
        });

        return { url, fileKey };
      }),
    
    getByAccountId: protectedProcedure
      .input(z.object({ accountId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDocumentsByAccountId(input.accountId);
      }),
    
    getByCallId: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .query(async ({ input }) => {
        return await db.getDocumentsByCallId(input.callId);
      }),
  }),

  clay: router({
    syncAccount: protectedProcedure
      .input(z.object({
        clayRecordId: z.string(),
        name: z.string(),
        domain: z.string().optional(),
        industry: z.string().optional(),
        employeeCount: z.number().optional(),
        revenue: z.string().optional(),
        location: z.string().optional(),
        description: z.string().optional(),
        website: z.string().optional(),
        linkedinUrl: z.string().optional(),
        securityStack: z.array(z.string()).optional(),
        techStack: z.array(z.string()).optional(),
        triggerEvents: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const existingAccounts = await db.getAllAccounts();
        const existing = existingAccounts.find(a => a.clayRecordId === input.clayRecordId);

        const accountData = {
          name: input.name,
          domain: input.domain,
          industry: input.industry,
          employeeCount: input.employeeCount,
          revenue: input.revenue,
          location: input.location,
          description: input.description,
          website: input.website,
          linkedinUrl: input.linkedinUrl,
          securityStack: input.securityStack ? JSON.stringify(input.securityStack) : undefined,
          techStack: input.techStack ? JSON.stringify(input.techStack) : undefined,
          triggerEvents: input.triggerEvents ? JSON.stringify(input.triggerEvents) : undefined,
          clayRecordId: input.clayRecordId,
          lastEnrichedAt: new Date(),
        };

        if (existing) {
          await db.updateAccount(existing.id, accountData);
          await db.createEnrichmentLog({
            entityType: "account",
            entityId: existing.id,
            source: "clay",
            status: "success",
            dataSnapshot: JSON.stringify(input),
          });
          return { success: true, accountId: existing.id, action: "updated" };
        } else {
          const result = await db.createAccount(accountData);
          return { success: true, action: "created" };
        }
      }),
  }),

  zapier: router({
    webhook: publicProcedure
      .input(z.object({
        event: z.string(),
        data: z.any(),
      }))
      .mutation(async ({ input }) => {
        console.log("[Zapier Webhook]", input.event, input.data);
        return { success: true, received: input.event };
      }),
  }),
});

export type AppRouter = typeof appRouter;
