import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  sixsenseBuyingStageMetrics,
  sixsenseEngagementMetrics,
  sixsenseKeywords,
  sixsense6QaPerformance,
} from "../drizzle/schema";

import { desc } from "drizzle-orm";

// Infer types from table schema
type SixsenseBuyingStageMetric = typeof sixsenseBuyingStageMetrics.$inferSelect;
type SixsenseEngagementMetric = typeof sixsenseEngagementMetrics.$inferSelect;
type SixsenseKeyword = typeof sixsenseKeywords.$inferSelect;
type Sixsense6QaPerformance = typeof sixsense6QaPerformance.$inferSelect;

export const sixsenseAnalyticsRouter = router({
  // Get buying stage funnel data
  getBuyingStages: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const data: SixsenseBuyingStageMetric[] = await db
      .select()
      .from(sixsenseBuyingStageMetrics)
      .orderBy(desc(sixsenseBuyingStageMetrics.id));

    // Get the most recent timeframe
    const latestTimeframe = data[0]?.timeframe;
    const latestData = data.filter((d: SixsenseBuyingStageMetric) => d.timeframe === latestTimeframe);
    const dataAsOf = data[0]?.dataAsOf;

    // Order by buying stage progression
    const stageOrder = ["Target", "Awareness", "Consideration", "Decision", "Purchase"];
    const orderedData = stageOrder.map((stage) => {
      const found = latestData.find((d: SixsenseBuyingStageMetric) => d.buyingStage === stage);
      return {
        stage,
        accounts: found?.numberOfAccounts || 0,
        newPipeline: found?.newPipelineUSD || "0",
        totalWon: found?.totalWonUSD || "0",
      };
    });

    return {
      timeframe: latestTimeframe,
      dataAsOf,
      stages: orderedData,
      totalAccounts: orderedData.reduce((sum: number, s) => sum + s.accounts, 0),
    };
  }),

  // Get engagement metrics
  getEngagement: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const data: SixsenseEngagementMetric[] = await db
      .select()
      .from(sixsenseEngagementMetrics)
      .orderBy(desc(sixsenseEngagementMetrics.id));

    // Get the most recent timeframe
    const latestTimeWindow = data[0]?.timeWindow;
    const latestData = data.filter((d: SixsenseEngagementMetric) => d.timeWindow === latestTimeWindow);
    const dataAsOf = data[0]?.dataAsOf;

    return {
      timeWindow: latestTimeWindow,
      dataAsOf,
      metrics: latestData.map((d: SixsenseEngagementMetric) => ({
        state: d.engagementState,
        accounts: d.accounts,
        amount: d.amountUsd,
      })),
    };
  }),

  // Get top keywords by category
  getKeywords: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
        limit: z.number().default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const data: SixsenseKeyword[] = await db
        .select()
        .from(sixsenseKeywords)
        .orderBy(desc(sixsenseKeywords.totalAccounts))
        .limit(input.limit);

      const dataAsOf = data[0]?.dataAsOf;

      // Filter by category if specified
      const filtered = input.category
        ? data.filter((d: SixsenseKeyword) => d.category === input.category)
        : data;

      // Group by category for summary
      const byCategory: Record<string, SixsenseKeyword[]> = {};
      for (const kw of data) {
        const cat = kw.category || "other";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(kw);
      }

      return {
        dataAsOf,
        keywords: filtered,
        byCategory,
        categories: Object.keys(byCategory),
      };
    }),

  // Get 6QA performance over time
  get6QAPerformance: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const data: Sixsense6QaPerformance[] = await db
      .select()
      .from(sixsense6QaPerformance)
      .orderBy(desc(sixsense6QaPerformance.day))
      .limit(30);

    const latest = data[0];
    const dataAsOf = latest?.dataAsOf;

    return {
      dataAsOf,
      latest: latest
        ? {
            day: latest.day,
            total6QAs: latest.total6QAs,
            new6QAs: latest.new6QAs,
            worked: latest.worked,
            unworked: latest.unworked,
            workedPercent: latest.total6QAs
              ? Math.round(((latest.worked || 0) / latest.total6QAs) * 100)
              : 0,
            avgSalesActivities: latest.avgSalesActivities,
            avgContactsReached: latest.avgContactsReached,
            avgDaysToFirstActivity: latest.avgDaysToFirstActivity,
            avgDaysSinceLastActivity: latest.avgDaysSinceLastActivity,
          }
        : null,
      trend: data.reverse().map((d: Sixsense6QaPerformance) => ({
        day: d.day,
        total6QAs: d.total6QAs,
        worked: d.worked,
        unworked: d.unworked,
      })),
    };
  }),

  // Get summary stats for dashboard
  getSummary: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get latest 6QA performance
    const performanceData: Sixsense6QaPerformance[] = await db
      .select()
      .from(sixsense6QaPerformance)
      .orderBy(desc(sixsense6QaPerformance.day))
      .limit(1);
    const performance = performanceData[0];

    // Get latest buying stages
    const buyingStages: SixsenseBuyingStageMetric[] = await db
      .select()
      .from(sixsenseBuyingStageMetrics)
      .orderBy(desc(sixsenseBuyingStageMetrics.id))
      .limit(5);

    const latestTimeframe = buyingStages[0]?.timeframe;
    const latestStages = buyingStages.filter((s: SixsenseBuyingStageMetric) => s.timeframe === latestTimeframe);

    // Get latest engagement
    const engagement: SixsenseEngagementMetric[] = await db
      .select()
      .from(sixsenseEngagementMetrics)
      .orderBy(desc(sixsenseEngagementMetrics.id))
      .limit(6);

    const latestTimeWindow = engagement[0]?.timeWindow;
    const latestEngagement = engagement.filter((e: SixsenseEngagementMetric) => e.timeWindow === latestTimeWindow);

    // Get top keywords count
    const keywords: SixsenseKeyword[] = await db.select().from(sixsenseKeywords);

    const dataAsOf = performance?.dataAsOf || buyingStages[0]?.dataAsOf;

    return {
      dataAsOf,
      sixQA: performance
        ? {
            total: performance.total6QAs,
            worked: performance.worked,
            unworked: performance.unworked,
            workedPercent: performance.total6QAs
              ? Math.round(((performance.worked || 0) / performance.total6QAs) * 100)
              : 0,
          }
        : null,
      buyingStages: {
        decision: latestStages.find((s: SixsenseBuyingStageMetric) => s.buyingStage === "Decision")?.numberOfAccounts || 0,
        purchase: latestStages.find((s: SixsenseBuyingStageMetric) => s.buyingStage === "Purchase")?.numberOfAccounts || 0,
        total: latestStages.reduce((sum: number, s: SixsenseBuyingStageMetric) => sum + (s.numberOfAccounts || 0), 0),
      },
      engagement: {
        intent: latestEngagement.find((e: SixsenseEngagementMetric) => e.engagementState === "Intent")?.accounts || 0,
        knownEngagement: latestEngagement.find((e: SixsenseEngagementMetric) => e.engagementState === "Known Engagement")?.accounts || 0,
        noEngagement: latestEngagement.find((e: SixsenseEngagementMetric) => e.engagementState === "No Engagement")?.accounts || 0,
      },
      keywords: {
        total: keywords.length,
        topByAccounts: keywords.slice(0, 5).map((k: SixsenseKeyword) => ({
          keyword: k.keyword,
          accounts: k.totalAccounts,
          category: k.category,
        })),
      },
    };
  }),
});
