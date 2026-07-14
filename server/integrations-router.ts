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
