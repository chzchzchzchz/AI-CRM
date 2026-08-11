import { wrapUntrusted, INJECTION_GUARD } from "../_core/untrusted";
import crypto from "crypto";
import { invokeLLM } from "../_core/llm";
import { getCompanyConfig } from "../config";
import { storeContext, getContext } from "../aiContext";
import {
  getAllAccounts,
  getAllPeople,
  getAllGongCalls,
  getAllOpportunities,
} from "../db";

/**
 * COMPANY BRAIN — continuous, incremental organizational learning.
 *
 * The brain crawls everything the workspace knows (accounts, contacts, calls,
 * opportunities, intent history), condenses it into a deterministic snapshot, and lets the
 * model STUDY THE DELTA between cycles — carrying forward its own accumulated lessons so
 * context genuinely grows over time instead of being recomputed from scratch.
 *
 * Honesty contract (same as the brief engine):
 *   - Every NUMBER in the snapshot is computed by code. Always true.
 *   - The model contributes only lessons/patterns, each tied to the evidence it saw.
 *   - No model available → the deterministic snapshot still serves; lessons just pause.
 *
 * Speed contract:
 *   - Reads (getBrainDigest) are served from memory: 0 LLM calls, sub-millisecond.
 *   - Learning runs in the background (fire-and-forget or cron), never on a request path.
 */

const BRAIN_TYPE = "company_brain";
const BRAIN_KEY = "global";
const MAX_LESSONS = 40; // hard cap so the digest stays small, fast, and current
const LEARN_MIN_INTERVAL_MS = 5 * 60 * 1000; // don't relearn more than every 5 min

export type BrainSnapshot = {
  hash: string;
  generatedAt: string;
  totals: {
    accounts: number;
    contacts: number;
    calls: number;
    opportunities: number;
    openPipeline: number;
    weightedPipeline: number;
    hotAccounts: number;
  };
  segments: Array<{ industry: string; accounts: number; avgIntent: number; pipeline: number }>;
  movers: Array<{ account: string; from: number; to: number; delta: number }>;
  risks: string[];   // deterministic risk facts (stale hot accounts, unworked 6QAs...)
  coverage: { contactsPerAccount: number; accountsWithoutContacts: number; accountsWithoutCalls: number };
};

export type BrainLesson = {
  lesson: string;
  evidence: string;
  learnedAt: string;
  cycle: number;
};

export type BrainDigest = {
  snapshot: BrainSnapshot;
  lessons: BrainLesson[];
  cycles: number;
  lastLearnedAt: string | null;
  learning: boolean;
};

// ---------------------------------------------------------------------------
// In-memory state: reads never touch the DB or the model.
// ---------------------------------------------------------------------------
let cached: BrainDigest | null = null;
let learning = false;
let lastLearnStarted = 0;

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Deterministic full-workspace crawl. Pure code — every figure is real. */
export async function crawlSnapshot(): Promise<BrainSnapshot> {
  const [accounts, people, calls, opps] = await Promise.all([
    getAllAccounts().catch(() => []),
    getAllPeople().catch(() => []),
    getAllGongCalls().catch(() => []),
    getAllOpportunities().catch(() => []),
  ]);

  const contactsByAccount = new Map<number, number>();
  for (const p of people as any[]) if (p.accountId != null) contactsByAccount.set(p.accountId, (contactsByAccount.get(p.accountId) || 0) + 1);
  const callsByAccount = new Map<number, number>();
  for (const cl of calls as any[]) if (cl.accountId != null) callsByAccount.set(cl.accountId, (callsByAccount.get(cl.accountId) || 0) + 1);

  let openPipeline = 0, weightedPipeline = 0;
  const oppsByAccount = new Map<number, number>();
  for (const o of opps as any[]) {
    const amt = num(o.amount);
    if (String(o.status || "Open").toLowerCase() === "open") {
      openPipeline += amt;
      weightedPipeline += amt * (num(o.probability) / 100);
    }
    if (o.accountId != null) oppsByAccount.set(o.accountId, (oppsByAccount.get(o.accountId) || 0) + 1);
  }

  // Segments by industry
  const seg = new Map<string, { accounts: number; intentSum: number; pipeline: number }>();
  for (const a of accounts as any[]) {
    const key = a.industry || "Unknown";
    const s = seg.get(key) || { accounts: 0, intentSum: 0, pipeline: 0 };
    s.accounts++; s.intentSum += num(a.intentScore);
    seg.set(key, s);
  }
  for (const o of opps as any[]) {
    const acc = (accounts as any[]).find((a) => a.id === o.accountId);
    if (acc && String(o.status || "Open").toLowerCase() === "open") {
      const s = seg.get(acc.industry || "Unknown");
      if (s) s.pipeline += num(o.amount);
    }
  }
  const segments = Array.from(seg.entries())
    .map(([industry, s]) => ({ industry, accounts: s.accounts, avgIntent: Math.round(s.intentSum / Math.max(1, s.accounts)), pipeline: s.pipeline }))
    .sort((a, b) => b.pipeline - a.pipeline || b.avgIntent - a.avgIntent)
    .slice(0, 8);

  // Movers from intent history via the spike detector's data source (reuse: cheap read)
  let movers: BrainSnapshot["movers"] = [];
  try {
    const { detectIntentSpikes } = await import("./spikes");
    movers = (await detectIntentSpikes({ minDelta: 8, limit: 5 })).map((s) => ({
      account: s.accountName, from: s.previousScore, to: s.currentScore, delta: s.scoreDelta,
    }));
  } catch { /* spikes unavailable → empty movers */ }

  // Deterministic risk facts
  const risks: string[] = [];
  const hot = (accounts as any[]).filter((a) => num(a.intentScore) >= 70);
  const hotNoOpp = hot.filter((a) => !oppsByAccount.has(a.id));
  if (hotNoOpp.length) risks.push(`${hotNoOpp.length} hot account(s) (intent 70+) have no opportunity yet: ${hotNoOpp.slice(0, 3).map((a) => a.name).join(", ")}${hotNoOpp.length > 3 ? "…" : ""}`);
  const hotNoContact = hot.filter((a) => !contactsByAccount.has(a.id));
  if (hotNoContact.length) risks.push(`${hotNoContact.length} hot account(s) have no contacts on file.`);
  const noCalls = (accounts as any[]).filter((a) => !callsByAccount.has(a.id)).length;

  const snapshotBody = {
    totals: {
      accounts: (accounts as any[]).length,
      contacts: (people as any[]).length,
      calls: (calls as any[]).length,
      opportunities: (opps as any[]).length,
      openPipeline: Math.round(openPipeline),
      weightedPipeline: Math.round(weightedPipeline),
      hotAccounts: hot.length,
    },
    segments,
    movers,
    risks,
    coverage: {
      contactsPerAccount: Number(((people as any[]).length / Math.max(1, (accounts as any[]).length)).toFixed(1)),
      accountsWithoutContacts: (accounts as any[]).filter((a) => !contactsByAccount.has(a.id)).length,
      accountsWithoutCalls: noCalls,
    },
  };

  return {
    ...snapshotBody,
    hash: crypto.createHash("sha256").update(JSON.stringify(snapshotBody)).digest("hex").slice(0, 24),
    generatedAt: new Date().toISOString(),
  };
}

async function loadPersisted(): Promise<{ lessons: BrainLesson[]; cycles: number; lastLearnedAt: string | null; lastHash: string | null }> {
  try {
    const rows = await getContext(BRAIN_TYPE, BRAIN_KEY);
    const latest = (rows || [])
      .map((r: any) => r.metadata)
      .filter((m: any) => m && Array.isArray(m.lessons))
      .sort((a: any, b: any) => (b.lastLearnedAt || "").localeCompare(a.lastLearnedAt || ""))[0];
    if (latest) return { lessons: latest.lessons.slice(0, MAX_LESSONS), cycles: latest.cycles || 0, lastLearnedAt: latest.lastLearnedAt || null, lastHash: latest.lastHash || null };
  } catch { /* fresh brain */ }
  return { lessons: [], cycles: 0, lastLearnedAt: null, lastHash: null };
}

/**
 * One learning cycle: crawl → diff vs prior hash → let the model study the snapshot WITH
 * its own prior lessons → persist the merged, deduped lesson set. Grows across cycles.
 */
export async function learnCycle(force = false): Promise<BrainDigest> {
  const persisted = await loadPersisted();
  const snapshot = await crawlSnapshot();

  // Nothing changed and not forced → refresh the cache, skip the model entirely.
  if (!force && persisted.lastHash === snapshot.hash && persisted.lessons.length) {
    cached = { snapshot, lessons: persisted.lessons, cycles: persisted.cycles, lastLearnedAt: persisted.lastLearnedAt, learning: false };
    return cached;
  }

  let lessons = persisted.lessons;
  const cycle = persisted.cycles + 1;
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: INJECTION_GUARD + "\n\n" + `You are the continuously-learning memory of a ${getCompanyConfig().companyName} sales workspace.
Each cycle you receive (a) the current verified data snapshot and (b) the lessons you yourself
recorded in prior cycles. Update your understanding:
- KEEP prior lessons that the new data still supports (you may tighten their wording).
- REVISE or DROP lessons the new data contradicts.
- ADD new lessons only for real patterns in this snapshot (segment strengths, pipeline
  concentration, coverage gaps, momentum shifts). Cite the exact figures as evidence.
- Never invent data. Numbers you cite must appear in the snapshot.
Return ONLY JSON: {"lessons":[{"lesson":"...","evidence":"..."}]} with at most ${MAX_LESSONS} items, most important first.`,
        },
        {
          role: "user",
          // Both halves are untrusted, for different reasons. The snapshot aggregates
          // account text from external systems; the prior lessons were themselves written
          // by a model reading earlier snapshots, so an instruction that ever landed in one
          // would otherwise be re-fed to every future cycle — injection with a memory.
          content: `${wrapUntrusted(
            `prior lessons (cycle ${persisted.cycles})`,
            persisted.lessons.map(({ lesson, evidence }) => ({ lesson, evidence }))
          )}\n\n${wrapUntrusted("current workspace snapshot", snapshot)}`,
        },
      ],
      response_format: { type: "json_object" },
    });
    const raw = response.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : JSON.stringify(raw);
    const start = text.indexOf("{");
    const parsed = start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) : null;
    if (parsed?.lessons?.length && !("available" in parsed)) {
      const now = new Date().toISOString();
      const seen = new Set<string>();
      lessons = (parsed.lessons as any[])
        .filter((l) => l?.lesson && typeof l.lesson === "string")
        .filter((l) => { const k = l.lesson.toLowerCase().slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, MAX_LESSONS)
        .map((l) => ({ lesson: l.lesson, evidence: String(l.evidence || ""), learnedAt: now, cycle }));
    }
  } catch (err) {
    console.warn("[brain] learn cycle degraded (model unavailable); keeping prior lessons.", (err as Error)?.message);
  }

  const lastLearnedAt = new Date().toISOString();
  try {
    await storeContext({
      type: BRAIN_TYPE,
      key: BRAIN_KEY,
      value: `Brain cycle ${cycle}: ${lessons.length} lessons`,
      metadata: { lessons, cycles: cycle, lastLearnedAt, lastHash: snapshot.hash },
    });
  } catch (err) {
    console.warn("[brain] could not persist lessons:", (err as Error)?.message);
  }

  cached = { snapshot, lessons, cycles: cycle, lastLearnedAt, learning: false };
  return cached;
}

/** Kick a background learning cycle if data changed and one isn't already running. */
export function scheduleLearning(): void {
  const now = Date.now();
  if (learning || now - lastLearnStarted < LEARN_MIN_INTERVAL_MS) return;
  learning = true; lastLearnStarted = now;
  learnCycle()
    .catch((e) => console.warn("[brain] background learn failed:", e?.message))
    .finally(() => { learning = false; });
}

/**
 * The fast read every consumer uses. Serves the in-memory digest instantly; on first call
 * it builds the deterministic snapshot (no LLM) and schedules learning in the background.
 */
export async function getBrainDigest(): Promise<BrainDigest> {
  if (cached) { scheduleLearning(); return { ...cached, learning }; }
  const persisted = await loadPersisted();
  const snapshot = await crawlSnapshot();
  cached = { snapshot, lessons: persisted.lessons, cycles: persisted.cycles, lastLearnedAt: persisted.lastLearnedAt, learning };
  scheduleLearning();
  return { ...cached, learning };
}

/** Compact text block for injecting the brain into any LLM prompt. */
export function brainContextBlock(digest: BrainDigest): string {
  const t = digest.snapshot.totals;
  const lines = [
    `WORKSPACE BRAIN (cycle ${digest.cycles}, verified figures):`,
    `- Portfolio: ${t.accounts} accounts / ${t.contacts} contacts / ${t.opportunities} opps · $${t.openPipeline.toLocaleString()} open ($${t.weightedPipeline.toLocaleString()} weighted) · ${t.hotAccounts} hot`,
  ];
  if (digest.snapshot.movers.length) lines.push(`- Movers: ${digest.snapshot.movers.map((m) => `${m.account} ${m.from}→${m.to}`).join("; ")}`);
  if (digest.snapshot.risks.length) lines.push(`- Risks: ${digest.snapshot.risks.join(" | ")}`);
  if (digest.lessons.length) {
    lines.push(`- Accumulated lessons (${digest.lessons.length}):`);
    for (const l of digest.lessons.slice(0, 10)) lines.push(`  • ${l.lesson} [${l.evidence}]`);
  }
  return lines.join("\n");
}
