import { eq } from "drizzle-orm";
import { intentScores as intentScoresTable } from "../../drizzle/schema";
import {
  getDb,
  getAccountById,
  getContactsByAccountId,
  getGongCallsByAccountId,
  getOpportunitiesByAccountId,
} from "../db";

/**
 * SIGNAL LAYER — deterministic, no LLM.
 *
 * Reads every account-related data point the system actually stores and folds it into
 * one standardized SignalPack. Everything here is computed in code, so the numbers are
 * always true; the LLM downstream only narrates what this layer produces.
 *
 * This is the single source of truth for "what do we know about this account".
 */

export type Seniority = "C-Suite" | "VP" | "Director" | "Manager" | "Individual" | "Unknown";
export type TrendDirection = "rising" | "falling" | "flat" | "unknown";

export type SignalPack = {
  account: {
    id: number;
    name: string;
    domain: string | null;
    website: string | null;
    linkedinUrl: string | null;
    industry: string | null;
    employeeCount: number | null;
    revenue: string | null;
    location: string | null;
    region: string | null;
    description: string | null;
    relationship: string | null;
    type: string | null;
    crmId: string | null;
  };
  intent: {
    score: number | null;
    buyingStage: string | null;
    profileFit: string | null;
    segments: string[];
    /** Chronological history from the intentScores table. */
    history: Array<{ score: number; category: string | null; source: string | null; at: string | null }>;
    trend: TrendDirection;
    /** Latest score minus the earliest score in the retained history. */
    delta: number | null;
    /** Largest single jump between consecutive readings — a spike is a buying signal. */
    largestJump: number | null;
    keywords: string[];
    lastSyncedAt: string | null;
  };
  technology: {
    techStack: string[];
    securityStack: string[];
  };
  triggers: string[];
  stakeholders: {
    total: number;
    withEmail: number;
    /** How many contacts sit at each seniority level, inferred from title. */
    bySeniority: Record<Seniority, number>;
    departments: string[];
    /** Most senior first — these are the real names the brief may cite. */
    people: Array<{
      id: number;
      name: string;
      title: string | null;
      seniority: Seniority;
      department: string | null;
      email: string | null;
      linkedinUrl: string | null;
    }>;
  };
  conversations: {
    total: number;
    lastCallDate: string | null;
    daysSinceLastCall: number | null;
    totalDurationMinutes: number;
    sentimentCounts: Record<string, number>;
    topics: string[];
    openActionItems: string[];
    recent: Array<{
      title: string | null;
      date: string | null;
      durationMinutes: number | null;
      sentiment: string | null;
      topics: string[];
      actionItems: string[];
    }>;
  };
  pipeline: {
    total: number;
    open: number;
    won: number;
    lost: number;
    totalValue: number;
    /** Sum of amount * probability — the honest forecast number. */
    weightedValue: number;
    stages: Record<string, number>;
    opportunities: Array<{
      name: string;
      stage: string;
      status: string;
      amount: number | null;
      probability: number | null;
      expectedCloseDate: string | null;
      aiSuccessScore: number | null;
    }>;
  };
  /** Which signal categories we actually hold data for — drives the honesty of the brief. */
  coverage: {
    present: string[];
    missing: string[];
    completeness: number; // 0..1
  };
  generatedAt: string;
};

/** Fields may arrive as a real array, a JSON string, or a comma-joined string. Normalize all three. */
function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      } catch {
        /* fall through to delimiter split */
      }
    }
    return trimmed.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Infer seniority from job title. The schema has no managementLevel column, so title is
 * the only real signal — inferring it here beats asking the LLM to guess.
 */
export function inferSeniority(title: string | null | undefined): Seniority {
  if (!title) return "Unknown";
  const t = title.toLowerCase();
  if (/\b(ceo|cto|cio|ciso|cfo|coo|cmo|cro|chief|founder|president|owner|partner)\b/.test(t)) return "C-Suite";
  if (/\b(vp|vice president|svp|evp|head of)\b/.test(t)) return "VP";
  if (/\b(director|dir\.)\b/.test(t)) return "Director";
  if (/\b(manager|mgr|lead|supervisor|principal)\b/.test(t)) return "Manager";
  return "Individual";
}

const SENIORITY_RANK: Record<Seniority, number> = {
  "C-Suite": 0,
  VP: 1,
  Director: 2,
  Manager: 3,
  Individual: 4,
  Unknown: 5,
};

/** Pull the intent-score time series. Isolated so a demo-shim quirk can't break the pack. */
async function fetchIntentHistory(accountId: number) {
  try {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(intentScoresTable)
      .where(eq(intentScoresTable.accountId, accountId));
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error(`[signals] intent history unavailable for account ${accountId}:`, error);
    return [];
  }
}

export async function gatherAccountSignals(accountId: number): Promise<SignalPack> {
  const account = await getAccountById(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);

  const [people, calls, opps, intentRows] = await Promise.all([
    getContactsByAccountId(accountId).catch(() => []),
    getGongCallsByAccountId(accountId).catch(() => []),
    getOpportunitiesByAccountId(accountId).catch(() => []),
    fetchIntentHistory(accountId),
  ]);

  const a = account as any;

  // ---- Intent: score + real trend from the time series -------------------------------
  const history = (intentRows as any[])
    .map((r) => ({
      score: toNumber(r.score) ?? 0,
      category: r.category ?? null,
      source: r.source ?? null,
      at: toIso(r.createdAt),
      keywords: toStringArray(r.keywords),
    }))
    .sort((x, y) => (x.at || "").localeCompare(y.at || ""));

  let trend: TrendDirection = "unknown";
  let delta: number | null = null;
  let largestJump: number | null = null;
  if (history.length >= 2) {
    delta = history[history.length - 1].score - history[0].score;
    trend = delta > 5 ? "rising" : delta < -5 ? "falling" : "flat";
    largestJump = history.reduce((max, cur, i) => {
      if (i === 0) return max;
      return Math.max(max, cur.score - history[i - 1].score);
    }, 0);
  } else if (history.length === 1) {
    trend = "flat";
  }

  const intentKeywords = Array.from(new Set(history.flatMap((h) => h.keywords)));

  // ---- Stakeholders: infer seniority, rank most-senior-first -------------------------
  const bySeniority: Record<Seniority, number> = {
    "C-Suite": 0, VP: 0, Director: 0, Manager: 0, Individual: 0, Unknown: 0,
  };
  const peopleList = (people as any[]).map((p) => {
    const seniority = inferSeniority(p.title);
    bySeniority[seniority] += 1;
    return {
      id: p.id,
      name: p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || "Unknown",
      title: p.title ?? null,
      seniority,
      department: p.department ?? null,
      email: p.email ?? null,
      linkedinUrl: p.linkedinUrl ?? null,
    };
  }).sort((x, y) => SENIORITY_RANK[x.seniority] - SENIORITY_RANK[y.seniority]);

  const departments = Array.from(
    new Set((people as any[]).map((p) => p.department).filter(Boolean) as string[])
  );

  // ---- Conversations: sentiment, topics, still-open action items ---------------------
  const sentimentCounts: Record<string, number> = {};
  const allTopics: string[] = [];
  const allActionItems: string[] = [];
  let totalDurationSeconds = 0;

  const callList = (calls as any[])
    .map((c) => {
      const topics = toStringArray(c.keyTopics);
      const actionItems = toStringArray(c.actionItems);
      const duration = toNumber(c.duration) ?? 0;
      totalDurationSeconds += duration;
      allTopics.push(...topics);
      allActionItems.push(...actionItems);
      if (c.sentiment) {
        const key = String(c.sentiment).toLowerCase();
        sentimentCounts[key] = (sentimentCounts[key] || 0) + 1;
      }
      return {
        title: c.title ?? null,
        date: toIso(c.callDate),
        durationMinutes: duration ? Math.round(duration / 60) : null,
        sentiment: c.sentiment ?? null,
        topics,
        actionItems,
      };
    })
    .sort((x, y) => (y.date || "").localeCompare(x.date || ""));

  const lastCallDate = callList[0]?.date ?? null;
  const daysSinceLastCall = lastCallDate
    ? Math.floor((Date.now() - new Date(lastCallDate).getTime()) / 86_400_000)
    : null;

  // ---- Pipeline: real totals and an honest weighted forecast -------------------------
  const stages: Record<string, number> = {};
  let totalValue = 0;
  let weightedValue = 0;
  let open = 0, won = 0, lost = 0;

  const oppList = (opps as any[]).map((o) => {
    const amount = toNumber(o.amount);
    const probability = toNumber(o.probability);
    const status = String(o.status || "Open");
    const stage = String(o.stage || "Unknown");
    stages[stage] = (stages[stage] || 0) + 1;
    if (status.toLowerCase() === "won") won += 1;
    else if (status.toLowerCase() === "lost") lost += 1;
    else open += 1;
    if (amount) {
      totalValue += amount;
      if (status.toLowerCase() === "open") weightedValue += amount * ((probability ?? 0) / 100);
    }
    return {
      name: o.name,
      stage,
      status,
      amount,
      probability,
      expectedCloseDate: toIso(o.expectedCloseDate),
      aiSuccessScore: toNumber(o.aiSuccessScore),
    };
  });

  const techStack = toStringArray(a.techStack);
  const securityStack = toStringArray(a.securityStack);
  const triggers = toStringArray(a.triggerEvents);
  const segments = toStringArray(a.sixsenseSegments);

  // ---- Coverage: be explicit about what we do and don't hold -------------------------
  const checks: Array<[string, boolean]> = [
    ["firmographics", Boolean(a.industry || a.employeeCount || a.revenue)],
    ["intent score", a.intentScore != null],
    ["intent history", history.length > 0],
    ["buying stage", Boolean(a.sixsenseBuyingStage)],
    ["tech stack", techStack.length > 0],
    ["security stack", securityStack.length > 0],
    ["trigger events", triggers.length > 0],
    ["stakeholders", peopleList.length > 0],
    ["call history", callList.length > 0],
    ["pipeline", oppList.length > 0],
  ];
  const present = checks.filter(([, ok]) => ok).map(([label]) => label);
  const missing = checks.filter(([, ok]) => !ok).map(([label]) => label);

  return {
    account: {
      id: a.id,
      name: a.name,
      domain: a.domain ?? null,
      website: a.website ?? null,
      linkedinUrl: a.linkedinUrl ?? null,
      industry: a.industry ?? null,
      employeeCount: toNumber(a.employeeCount),
      revenue: a.revenue ?? null,
      location: a.location ?? null,
      region: a.region ?? null,
      description: a.description ?? null,
      relationship: a.relationship ?? null,
      type: a.type ?? null,
      crmId: a.sfdcAccountId ?? null,
    },
    intent: {
      score: toNumber(a.intentScore),
      buyingStage: a.sixsenseBuyingStage ?? null,
      profileFit: a.sixsenseProfileFit ?? null,
      segments,
      history: history.map(({ keywords, ...rest }) => rest),
      trend,
      delta,
      largestJump,
      keywords: intentKeywords,
      lastSyncedAt: toIso(a.lastSixsenseSync),
    },
    technology: { techStack, securityStack },
    triggers,
    stakeholders: {
      total: peopleList.length,
      withEmail: peopleList.filter((p) => p.email).length,
      bySeniority,
      departments,
      people: peopleList,
    },
    conversations: {
      total: callList.length,
      lastCallDate,
      daysSinceLastCall,
      totalDurationMinutes: Math.round(totalDurationSeconds / 60),
      sentimentCounts,
      topics: Array.from(new Set(allTopics)),
      openActionItems: Array.from(new Set(allActionItems)),
      recent: callList.slice(0, 5),
    },
    pipeline: {
      total: oppList.length,
      open,
      won,
      lost,
      totalValue,
      weightedValue: Math.round(weightedValue),
      stages,
      opportunities: oppList,
    },
    coverage: {
      present,
      missing,
      completeness: Number((present.length / checks.length).toFixed(2)),
    },
    generatedAt: new Date().toISOString(),
  };
}
