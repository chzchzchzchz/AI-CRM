/**
 * Integrations router — real endpoints for the integrations documented in INTEGRATIONS.md:
 *  - intentScores.create / .list  (6sense-style intent scores stored per account)
 *  - zapier.webhook               (inbound automation events)
 *  - clay.triggerEnrichment       (outbound push to a Clay table via CLAY_WEBHOOK_URL)
 */
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { intentScores } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  slackNotify, discordNotify, teamsNotify, hubspotUpsertContact,
  notionCreatePage, linearCreateIssue, intercomUpsertContact, sendWebhook,
  airtableCreateRecord, pipedriveCreateDeal, apolloEnrichPerson,
  googleChatNotify, twilioSendSms, segmentTrack, notifyAll,
} from "./integrations/connectors";

// ---- Native SaaS connectors (Slack, Discord, Teams, HubSpot, Notion, Linear, Intercom, webhooks) ----
export const integrationsRouter = router({
  // Which connectors are configured (by env) — shown in the app's Integrations settings.
  status: protectedProcedure.query(() => ({
    slack: !!process.env.SLACK_WEBHOOK_URL,
    discord: !!process.env.DISCORD_WEBHOOK_URL,
    teams: !!process.env.TEAMS_WEBHOOK_URL,
    hubspot: !!process.env.HUBSPOT_ACCESS_TOKEN,
    notion: !!(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID),
    linear: !!(process.env.LINEAR_API_KEY && process.env.LINEAR_TEAM_ID),
    intercom: !!process.env.INTERCOM_ACCESS_TOKEN,
    airtable: !!(process.env.AIRTABLE_TOKEN && process.env.AIRTABLE_BASE_ID && process.env.AIRTABLE_TABLE),
    pipedrive: !!(process.env.PIPEDRIVE_API_TOKEN && process.env.PIPEDRIVE_DOMAIN),
    apollo: !!process.env.APOLLO_API_KEY,
    googleChat: !!process.env.GOOGLE_CHAT_WEBHOOK_URL,
    twilio: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    segment: !!process.env.SEGMENT_WRITE_KEY,
  })),
  // One event → every configured chat tool (+ optional webhook). The native automation.
  notifyHotLead: protectedProcedure
    .input(z.object({ text: z.string(), webhookUrl: z.string().url().optional() }))
    .mutation(({ input }) => notifyAll(input.text, input.webhookUrl)),
  googleChatNotify: protectedProcedure
    .input(z.object({ text: z.string(), webhookUrl: z.string().url().optional() }))
    .mutation(({ input }) => googleChatNotify(input.text, input.webhookUrl)),
  twilioSendSms: protectedProcedure
    .input(z.object({ to: z.string(), body: z.string() }))
    .mutation(({ input }) => twilioSendSms(input.to, input.body)),
  segmentTrack: protectedProcedure
    .input(z.object({ event: z.string(), userId: z.string(), properties: z.record(z.string(), z.any()).optional() }))
    .mutation(({ input }) => segmentTrack(input.event, input.userId, input.properties)),
  slackNotify: protectedProcedure
    .input(z.object({ text: z.string(), webhookUrl: z.string().url().optional() }))
    .mutation(({ input }) => slackNotify(input.text, input.webhookUrl)),
  discordNotify: protectedProcedure
    .input(z.object({ content: z.string(), webhookUrl: z.string().url().optional() }))
    .mutation(({ input }) => discordNotify(input.content, input.webhookUrl)),
  teamsNotify: protectedProcedure
    .input(z.object({ text: z.string(), webhookUrl: z.string().url().optional() }))
    .mutation(({ input }) => teamsNotify(input.text, input.webhookUrl)),
  hubspotSyncContact: protectedProcedure
    .input(z.object({ email: z.string().email(), firstname: z.string().optional(), lastname: z.string().optional(), company: z.string().optional(), jobtitle: z.string().optional() }))
    .mutation(({ input }) => hubspotUpsertContact(input)),
  notionExportAccount: protectedProcedure
    .input(z.object({ name: z.string(), domain: z.string().optional(), industry: z.string().optional(), intentScore: z.number().optional() }))
    .mutation(({ input }) => notionCreatePage(input)),
  linearCreateTask: protectedProcedure
    .input(z.object({ title: z.string(), description: z.string().optional() }))
    .mutation(({ input }) => linearCreateIssue(input.title, input.description)),
  intercomSyncContact: protectedProcedure
    .input(z.object({ email: z.string().email(), name: z.string().optional() }))
    .mutation(({ input }) => intercomUpsertContact(input)),
  airtableCreateRecord: protectedProcedure
    .input(z.object({ fields: z.record(z.string(), z.any()) }))
    .mutation(({ input }) => airtableCreateRecord(input.fields)),
  pipedriveCreateDeal: protectedProcedure
    .input(z.object({ title: z.string(), value: z.number().optional() }))
    .mutation(({ input }) => pipedriveCreateDeal(input.title, input.value)),
  apolloEnrichPerson: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(({ input }) => apolloEnrichPerson(input.email)),
  sendWebhook: protectedProcedure
    .input(z.object({ url: z.string().url(), payload: z.record(z.string(), z.any()) }))
    .mutation(({ input }) => sendWebhook(input.url, input.payload)),
});

// ---- 6sense intent scores ----
export const intentScoresRouter = router({
  create: protectedProcedure
    .input(z.object({
      accountId: z.number(),
      score: z.number().min(0).max(100),
      category: z.string().optional(),
      keywords: z.array(z.string()).optional(),
      source: z.string().default("6sense"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      await db.insert(intentScores).values({
        accountId: input.accountId,
        score: input.score,
        category: input.category ?? null,
        keywords: input.keywords ? JSON.stringify(input.keywords) : null,
        source: input.source,
      });
      return { success: true };
    }),
  list: protectedProcedure
    .input(z.object({ accountId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(intentScores)
        .where(eq(intentScores.accountId, input.accountId))
        .orderBy(desc(intentScores.createdAt));
    }),
});

// ---- Zapier inbound webhook (automation events) ----
const ZAPIER_WEBHOOK_SECRET = process.env.ZAPIER_WEBHOOK_SECRET || "";
export const zapierRouter = router({
  webhook: publicProcedure
    .input(z.object({
      webhook_secret: z.string().optional(),
      event: z.string(),
      data: z.record(z.string(), z.any()).optional(),
    }).passthrough())
    .mutation(async ({ input }) => {
      // Fail closed outside demo mode when a secret is configured/expected.
      if (ZAPIER_WEBHOOK_SECRET) {
        if (input.webhook_secret !== ZAPIER_WEBHOOK_SECRET) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid webhook secret" });
        }
      } else if (process.env.DEMO_MODE !== "true") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Zapier webhook not configured (set ZAPIER_WEBHOOK_SECRET)" });
      }
      console.log(`[Zapier] event=${input.event}`, input.data ?? {});
      return { received: true, event: input.event };
    }),
});

// ---- Clay outbound: trigger enrichment by pushing a row to a Clay table ----
export const clayPullRouter = router({
  triggerEnrichment: protectedProcedure
    .input(z.object({ domain: z.string(), name: z.string().optional() }))
    .mutation(async ({ input }) => {
      const url = process.env.CLAY_WEBHOOK_URL;
      if (!url) {
        return { success: false, error: "CLAY_WEBHOOK_URL not configured" };
      }
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: input.domain, name: input.name }),
        });
        return { success: res.ok, status: res.status };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "request failed" };
      }
    }),
});
