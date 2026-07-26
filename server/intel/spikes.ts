import { desc } from "drizzle-orm";
import { intentScores as intentScoresTable, accounts as accountsTable } from "../../drizzle/schema";
import { getDb } from "../db";

/**
 * INTENT SPIKE DETECTION — real, computed from the intentScores time series.
 *
 * A "spike" is a jump of at least `minDelta` points between an account's two most recent
 * readings within `windowDays`. This used to be a `return []` stub, so the 6sense spike
 * feature (and the AI assistant's "recent spikes" answer) always reported nothing.
 */

export type IntentSpike = {
  accountId: number;
  accountName: string;
  previousScore: number;
  currentScore: number;
  scoreDelta: number;
  at: string;
  category: string | null;
};

const DEFAULT_MIN_DELTA = 15;
const DEFAULT_WINDOW_DAYS = 30;

function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Dates in the store may be ISO or Date.toString() form ("Wed Jul 08 2026 ..."), which do
// NOT sort correctly as strings ("Jul" < "Jun"). Always compare by parsed timestamp.
function toMillis(value: unknown): number {
  if (!value) return 0;
  const d = value instanceof Date ? value : new Date(String(value));
  const t = d.getTime();
  return Number.isNaN(t) ? 0 : t;
}

export async function detectIntentSpikes(opts: {
  minDelta?: number;
  windowDays?: number;
  limit?: number;
} = {}): Promise<IntentSpike[]> {
  const minDelta = opts.minDelta ?? DEFAULT_MIN_DELTA;
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const limit = opts.limit ?? 10;

  const db = await getDb();
  if (!db) return [];

  let scoreRows: any[] = [];
  let accountRows: any[] = [];
  try {
    [scoreRows, accountRows] = await Promise.all([
      db.select().from(intentScoresTable).orderBy(desc(intentScoresTable.createdAt)),
      db.select().from(accountsTable),
    ]);
  } catch (error) {
    console.error("[spikes] could not read intent history:", error);
    return [];
  }

  const nameById = new Map<number, string>(
    (accountRows || []).map((a: any) => [a.id, a.name])
  );

  // Group readings per account, newest first.
  const byAccount = new Map<number, any[]>();
  for (const row of scoreRows || []) {
    const id = row.accountId;
    if (id == null) continue;
    if (!byAccount.has(id)) byAccount.set(id, []);
    byAccount.get(id)!.push(row);
  }

  const cutoff = Date.now() - windowDays * 86_400_000;
  const spikes: IntentSpike[] = [];

  for (const [accountId, rows] of byAccount) {
    // Sort newest-first by parsed timestamp — string compare mis-orders Date.toString() dates.
    const sorted = rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    if (sorted.length < 2) continue;

    const current = sorted[0];
    const previous = sorted[1];
    const at = toIso(current.createdAt);
    if (!at || new Date(at).getTime() < cutoff) continue;

    const currentScore = Number(current.score) || 0;
    const previousScore = Number(previous.score) || 0;
    const scoreDelta = currentScore - previousScore;
    if (scoreDelta < minDelta) continue;

    spikes.push({
      accountId,
      accountName: nameById.get(accountId) || `Account ${accountId}`,
      previousScore,
      currentScore,
      scoreDelta,
      at,
      category: current.category ?? null,
    });
  }

  spikes.sort((a, b) => b.scoreDelta - a.scoreDelta);
  return spikes.slice(0, limit);
}
