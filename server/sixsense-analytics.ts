import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb, getAllAccounts, getAllOpportunities, getAllPeople, getAllGongCalls } from "./db";
import { intentScores as intentScoresTable } from "../drizzle/schema";

/**
 * 6SENSE-STYLE ANALYTICS — derived from real data.
 *
 * These procedures used to read four tables (sixsenseBuyingStageMetrics,
 * sixsenseEngagementMetrics, sixsenseKeywords, sixsense6QAPerformance) that NO code ever
 * writes to and that aren't in the demo seed — so every dashboard rendered zeros/empty.
 *
 * They now compute the same shapes from data the app actually holds: account buying stage,
 * the intentScores time series (with keywords), opportunities, contacts and calls. The
 * return shapes are unchanged, so the Insights / SixsenseAnalytics / Home pages keep working.
 */

// An account counts as a "6sense Qualified Account" at/above this intent score.
const SIX_QA_THRESHOLD = 70;
const STAGE_ORDER = ["Target", "Awareness", "Consideration", "Decision", "Purchase"];

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function parseKeywords(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[")) {
      try {
        const p = JSON.parse(t);
        if (Array.isArray(p)) return p.map((x) => String(x).trim()).filter(Boolean);
      } catch { /* fall through */ }
    }
    return t.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

type RealData = {
  accounts: any[];
  opportunities: any[];
  contacts: any[];
  calls: any[];
  intent: any[];
  now: Date;
  // per-account rollups
  contactsByAccount: Map<number, number>;
  callsByAccount: Map<number, number>;
  openOppValueByAccount: Map<number, number>;
  wonOppValueByAccount: Map<number, number>;
  hasOpenOpp: Set<number>;
  hasWonOpp: Set<number>;
};

async function loadReal(): Promise<RealData> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // The demo query builder is awaitable but has no `.catch`, so read intent scores in its
  // own guarded step rather than chaining .catch on the builder.
  const fetchIntent = async () => {
    try {
      return (await db.select().from(intentScoresTable)) as any[];
    } catch {
      return [] as any[];
    }
  };
  const [accounts, opportunities, contacts, calls, intent] = await Promise.all([
    getAllAccounts().catch(() => []),
    getAllOpportunities().catch(() => []),
    getAllPeople().catch(() => []),
    getAllGongCalls().catch(() => []),
    fetchIntent(),
  ]);

  const contactsByAccount = new Map<number, number>();
  for (const c of contacts as any[]) {
    if (c.accountId != null) contactsByAccount.set(c.accountId, (contactsByAccount.get(c.accountId) || 0) + 1);
  }
  const callsByAccount = new Map<number, number>();
  for (const c of calls as any[]) {
    if (c.accountId != null) callsByAccount.set(c.accountId, (callsByAccount.get(c.accountId) || 0) + 1);
  }
  const openOppValueByAccount = new Map<number, number>();
  const wonOppValueByAccount = new Map<number, number>();
  const hasOpenOpp = new Set<number>();
  const hasWonOpp = new Set<number>();
  for (const o of opportunities as any[]) {
    const id = o.accountId;
    if (id == null) continue;
    const amt = toNum(o.amount);
    const status = String(o.status || "Open").toLowerCase();
    if (status === "won") {
      wonOppValueByAccount.set(id, (wonOppValueByAccount.get(id) || 0) + amt);
      hasWonOpp.add(id);
    } else if (status !== "lost") {
      openOppValueByAccount.set(id, (openOppValueByAccount.get(id) || 0) + amt);
      hasOpenOpp.add(id);
    }
  }

  return {
    accounts: accounts as any[],
    opportunities: opportunities as any[],
    contacts: contacts as any[],
    calls: calls as any[],
    intent: (intent as any[]) || [],
    now: new Date(),
    contactsByAccount,
    callsByAccount,
    openOppValueByAccount,
    wonOppValueByAccount,
    hasOpenOpp,
    hasWonOpp,
  };
}

/** Buying-stage funnel: real account counts per stage + pipeline sourced from opportunities. */
function computeBuyingStages(d: RealData) {
  const stages = STAGE_ORDER.map((stage) => {
    const accts = d.accounts.filter((a) => (a.sixsenseBuyingStage || "") === stage);
    const ids = accts.map((a) => a.id);
    const newPipeline = ids.reduce((s, id) => s + (d.openOppValueByAccount.get(id) || 0), 0);
    const totalWon = ids.reduce((s, id) => s + (d.wonOppValueByAccount.get(id) || 0), 0);
    return {
      stage,
      accounts: accts.length,
      newPipeline: String(newPipeline),
      totalWon: String(totalWon),
    };
  });
  return {
    timeframe: "Current",
    dataAsOf: d.now,
    stages,
    totalAccounts: stages.reduce((s, x) => s + x.accounts, 0),
  };
}

/** Engagement funnel derived from real signals per account. Each account lands in one state. */
function computeEngagement(d: RealData) {
  const states = {
    "No Engagement": { accounts: 0, amount: 0 },
    Intent: { accounts: 0, amount: 0 },
    "Known Engagement": { accounts: 0, amount: 0 },
    "Opps Created": { accounts: 0, amount: 0 },
    "Opps Won": { accounts: 0, amount: 0 },
  } as Record<string, { accounts: number; amount: number }>;

  for (const a of d.accounts) {
    const id = a.id;
    const intent = toNum(a.intentScore);
    const engaged = (d.contactsByAccount.get(id) || 0) > 0 || (d.callsByAccount.get(id) || 0) > 0;
    if (d.hasWonOpp.has(id)) {
      states["Opps Won"].accounts++;
      states["Opps Won"].amount += d.wonOppValueByAccount.get(id) || 0;
    } else if (d.hasOpenOpp.has(id)) {
      states["Opps Created"].accounts++;
      states["Opps Created"].amount += d.openOppValueByAccount.get(id) || 0;
    } else if (engaged) {
      states["Known Engagement"].accounts++;
    } else if (intent >= 40) {
      states["Intent"].accounts++;
    } else {
      states["No Engagement"].accounts++;
    }
  }

  return {
    timeWindow: "Current",
    dataAsOf: d.now,
    metrics: Object.entries(states).map(([state, v]) => ({
      state,
      accounts: v.accounts,
      amount: String(v.amount),
    })),
  };
}

/** Keyword performance aggregated from the intentScores time series across accounts. */
function computeKeywords(d: RealData) {
  // keyword -> set of accountIds, plus the category it appeared under
  const byKeyword = new Map<string, { accounts: Set<number>; category: string }>();
  for (const row of d.intent) {
    const accountId = row.accountId;
    const category = row.category || "other";
    for (const kw of parseKeywords(row.keywords)) {
      const entry = byKeyword.get(kw) || { accounts: new Set<number>(), category };
      if (accountId != null) entry.accounts.add(accountId);
      byKeyword.set(kw, entry);
    }
  }

  const dataAsOf = d.now;
  const keywords = Array.from(byKeyword.entries())
    .map(([keyword, e]) => {
      const ids = Array.from(e.accounts);
      const with6QA = ids.filter((id) => {
        const a = d.accounts.find((x) => x.id === id);
        return a && toNum(a.intentScore) >= SIX_QA_THRESHOLD;
      }).length;
      const withOpps = ids.filter((id) => d.hasOpenOpp.has(id) || d.hasWonOpp.has(id)).length;
      return {
        keyword,
        totalAccounts: ids.length,
        accountsWithWebVisits: ids.filter((id) => (d.callsByAccount.get(id) || 0) > 0 || (d.contactsByAccount.get(id) || 0) > 0).length,
        accountsWith6QA: with6QA,
        accountsWithOpportunities: withOpps,
        accountsWithRelevantOpportunities: withOpps,
        category: e.category,
        dataAsOf,
      };
    })
    .sort((a, b) => b.totalAccounts - a.totalAccounts);

  return { keywords, dataAsOf };
}

/** 6QA snapshot + a real trend from the intentScores reading dates. */
function compute6QA(d: RealData) {
  const qaAccounts = d.accounts.filter((a) => toNum(a.intentScore) >= SIX_QA_THRESHOLD);
  const total6QAs = qaAccounts.length;
  const worked = qaAccounts.filter(
    (a) => (d.contactsByAccount.get(a.id) || 0) > 0 || (d.callsByAccount.get(a.id) || 0) > 0 || d.hasOpenOpp.has(a.id) || d.hasWonOpp.has(a.id)
  ).length;
  const unworked = total6QAs - worked;
  const totalCalls = qaAccounts.reduce((s, a) => s + (d.callsByAccount.get(a.id) || 0), 0);
  const totalContacts = qaAccounts.reduce((s, a) => s + (d.contactsByAccount.get(a.id) || 0), 0);

  // Trend: for each distinct intent-reading date, how many accounts were >= threshold.
  const byDate = new Map<string, Set<number>>();
  for (const row of d.intent) {
    if (toNum(row.score) < SIX_QA_THRESHOLD) continue;
    const day = row.createdAt ? new Date(String(row.createdAt)).toISOString().slice(0, 10) : null;
    if (!day) continue;
    if (!byDate.has(day)) byDate.set(day, new Set());
    if (row.accountId != null) byDate.get(day)!.add(row.accountId);
  }
  const trend = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, ids]) => ({ day, total6QAs: ids.size, worked: null as number | null, unworked: null as number | null }));

  const latestDay = trend.length ? trend[trend.length - 1].day : d.now.toISOString().slice(0, 10);

  return {
    total6QAs,
    worked,
    unworked,
    workedPercent: total6QAs ? Math.round((worked / total6QAs) * 100) : 0,
    avgSalesActivities: total6QAs ? Math.round((totalCalls / total6QAs) * 10) / 10 : 0,
    avgContactsReached: total6QAs ? Math.round((totalContacts / total6QAs) * 10) / 10 : 0,
    latestDay,
    trend,
  };
}

export const sixsenseAnalyticsRouter = router({
  getBuyingStages: protectedProcedure.query(async () => {
    return computeBuyingStages(await loadReal());
  }),

  getEngagement: protectedProcedure.query(async () => {
    return computeEngagement(await loadReal());
  }),

  getKeywords: protectedProcedure
    .input(z.object({ category: z.string().optional(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const d = await loadReal();
      const { keywords, dataAsOf } = computeKeywords(d);
      const limited = keywords.slice(0, input.limit);
      const filtered = input.category ? limited.filter((k) => k.category === input.category) : limited;

      const byCategory: Record<string, typeof keywords> = {};
      for (const kw of limited) {
        const cat = kw.category || "other";
        (byCategory[cat] ||= []).push(kw);
      }

      return { dataAsOf, keywords: filtered, byCategory, categories: Object.keys(byCategory) };
    }),

  get6QAPerformance: protectedProcedure.query(async () => {
    const d = await loadReal();
    const q = compute6QA(d);
    return {
      dataAsOf: d.now,
      latest: {
        day: q.latestDay,
        total6QAs: q.total6QAs,
        new6QAs: q.trend.length >= 2 ? Math.max(0, q.total6QAs - q.trend[q.trend.length - 2].total6QAs) : q.total6QAs,
        worked: q.worked,
        unworked: q.unworked,
        workedPercent: q.workedPercent,
        avgSalesActivities: q.avgSalesActivities,
        avgContactsReached: q.avgContactsReached,
        avgDaysToFirstActivity: null,
        avgDaysSinceLastActivity: null,
      },
      trend: q.trend,
    };
  }),

  getSummary: protectedProcedure.query(async () => {
    const d = await loadReal();
    const stages = computeBuyingStages(d);
    const engagement = computeEngagement(d);
    const q = compute6QA(d);
    const { keywords } = computeKeywords(d);

    const stageCount = (name: string) => stages.stages.find((s) => s.stage === name)?.accounts || 0;
    const engCount = (name: string) => Number(engagement.metrics.find((m) => m.state === name)?.accounts || 0);

    return {
      dataAsOf: d.now,
      sixQA: {
        total: q.total6QAs,
        worked: q.worked,
        unworked: q.unworked,
        workedPercent: q.workedPercent,
      },
      buyingStages: {
        decision: stageCount("Decision"),
        purchase: stageCount("Purchase"),
        total: stages.totalAccounts,
      },
      engagement: {
        intent: engCount("Intent"),
        knownEngagement: engCount("Known Engagement"),
        noEngagement: engCount("No Engagement"),
      },
      keywords: {
        total: keywords.length,
        topByAccounts: keywords.slice(0, 5).map((k) => ({
          keyword: k.keyword,
          accounts: k.totalAccounts,
          category: k.category,
        })),
      },
    };
  }),
});
