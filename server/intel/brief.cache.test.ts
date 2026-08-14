import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SignalPack } from "./signals";

/**
 * Validation has to hold at SERVE time, not just at generation time.
 *
 * A brief is cached under `signalHash + BRIEF_VERSION`. Adding a validation rule changes
 * neither, so every brief cached before the rule existed kept being served for its full
 * 24h TTL — and the response reported `droppedClaims: []`, which states the brief was
 * checked and came back clean. Observed live on account 18: the citation
 * "intent.competitor 6" was served from cache by a build whose validator was written
 * specifically to reject it.
 *
 * These tests build that exact situation: a snapshot whose stored judgement contains a
 * claim the current rules reject, served through the cache path.
 */

const pack: SignalPack = {
  account: {
    id: 18, name: "Cobaltreach Health", domain: "cobaltreachhealth.com", website: null,
    linkedinUrl: null, industry: "Professional Services", employeeCount: 90, revenue: null,
    location: "Portland, OR", region: "West", description: "Expanding into new markets.",
    relationship: "Target", type: "Target", crmId: null,
  },
  intent: {
    score: 5, buyingStage: "Target", profileFit: "Moderate", segments: [],
    history: [
      { score: 7, category: "Competitor", source: "6sense", at: "2026-06-26T11:54:55.900Z" },
      { score: 5, category: "Competitor", source: "6sense", at: "2026-07-17T11:54:55.900Z" },
    ],
    trend: "flat", delta: 0, largestJump: 2, keywords: [], lastSyncedAt: null,
  },
  technology: { techStack: [], securityStack: [] },
  triggers: [],
  stakeholders: {
    total: 0, withEmail: 0,
    bySeniority: { executive: 0, leadership: 0, management: 0, individual: 0, unknown: 0 } as any,
    departments: [], people: [],
  },
  conversations: {
    total: 0, lastCallDate: null, daysSinceLastCall: null, totalDurationMinutes: 0,
    sentimentCounts: {}, topics: [], openActionItems: [], recent: [],
  },
  pipeline: {
    total: 0, open: 0, won: 0, lost: 0, totalValue: 0, weightedValue: 0, stages: {}, opportunities: [],
  },
  coverage: { present: ["intent"], missing: ["stakeholders", "call history", "pipeline"], completeness: 0.7 },
  generatedAt: "2026-08-14T00:00:00.000Z",
};

const getContext = vi.fn();
const storeContext = vi.fn(async () => undefined);
const invokeLLM = vi.fn();

vi.mock("./signals", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./signals")>();
  return { ...actual, gatherAccountSignals: vi.fn(async () => pack) };
});
vi.mock("../aiContext", () => ({
  getContext: (...a: unknown[]) => getContext(...a),
  storeContext: (...a: unknown[]) => storeContext(...a),
}));
vi.mock("../_core/llm", () => ({
  invokeLLM: (...a: unknown[]) => invokeLLM(...a),
  llmText: (r: any) => ({ content: r?.content ?? "", available: r?.available !== false }),
  LLM_UNAVAILABLE_NOTE: "No model configured.",
}));

/** brief.ts reads `response.choices[0].message.content` — the OpenAI shape. */
const llmReply = (judgement: unknown) => ({
  choices: [{ message: { content: JSON.stringify(judgement) } }],
});

/** The brief the model would have produced, with one citation the pack cannot support. */
const CLEAN_CLAIM = { point: "Competitor pressure", evidence: "intent.competitor 7 score from 2026-06-26T11:54:55.900Z" };
const BAD_CLAIM = { point: "Competitor activity detected", evidence: "intent.competitor 6 score from 2026-07-17T11:54:55.900Z" };

/**
 * Runs one generation so the real hashing/versioning writes a snapshot, then returns that
 * snapshot with `mutate` applied — the only honest way to build a cache entry the code
 * will actually accept, since signalHash is internal.
 */
async function cachedSnapshotWith(judgement: Record<string, unknown>) {
  const { generateAccountBrief } = await import("./brief");
  getContext.mockResolvedValue([]);
  invokeLLM.mockResolvedValue(llmReply({ situation: "A situation.", whyNow: [CLEAN_CLAIM], actions: [], risks: [] }));
  await generateAccountBrief(18, { forceRefresh: true });

  const written = storeContext.mock.calls.at(-1)?.[0] as any;
  expect(written, "generation should have snapshotted a brief").toBeTruthy();
  return [{
    value: written.value,
    createdAt: written.metadata.generatedAt,
    metadata: { ...written.metadata, generatedAt: new Date().toISOString(), judgement },
  }];
}

describe("a cached brief is re-validated before it is served", () => {
  beforeEach(() => {
    getContext.mockReset();
    storeContext.mockClear();
    invokeLLM.mockReset();
  });

  it("drops a stored claim that the current rules reject, and says so", async () => {
    const { generateAccountBrief } = await import("./brief");
    const rows = await cachedSnapshotWith({
      situation: "A situation.",
      whyNow: [CLEAN_CLAIM, BAD_CLAIM],
      actions: [],
      risks: [],
    });

    getContext.mockResolvedValue(rows);
    invokeLLM.mockClear();
    const brief = await generateAccountBrief(18);

    expect(brief.cached, "must have come from the cache, or this proves nothing").toBe(true);
    expect(invokeLLM, "a cache hit must not call the model").not.toHaveBeenCalled();

    // The unsupported citation no longer supports anything: its point is gone from the
    // prose and its evidence is gone from the structure.
    expect(brief.judgement?.whyNow.map(w => w.evidence)).toEqual([CLEAN_CLAIM.evidence]);
    expect(brief.markdown).not.toContain(BAD_CLAIM.point);
    expect(brief.judgement?.whyNow.map(w => w.point)).not.toContain(BAD_CLAIM.point);

    // It survives in exactly one place — the validation note that says it was removed.
    // That is the disclosure, not a leak: naming the figure is how a rep can tell which
    // claim went and why. Stripping it everywhere would make the removal invisible.
    const [prose, note] = brief.markdown.split("## Validation");
    expect(prose).not.toContain("intent.competitor 6");
    expect(note).toContain("intent.competitor 6");

    // And it is reported rather than silently swallowed — `dropped: []` here would be the
    // original bug in a new costume: a filtered brief that still claims nothing was wrong.
    expect(brief.validation.dropped).toHaveLength(1);
    expect(brief.validation.dropped[0].reason).toContain("intent.competitor 6");
  });

  it("serves a still-valid cached brief byte for byte", async () => {
    const { generateAccountBrief } = await import("./brief");
    const rows = await cachedSnapshotWith({
      situation: "A situation.",
      whyNow: [CLEAN_CLAIM],
      actions: [],
      risks: [],
    });

    getContext.mockResolvedValue(rows);
    const brief = await generateAccountBrief(18);

    expect(brief.cached).toBe(true);
    expect(brief.validation.dropped).toHaveLength(0);
    expect(brief.markdown).toBe(rows[0].value);
  });

  it("regenerates a prose-only snapshot instead of vouching for it", async () => {
    const { generateAccountBrief } = await import("./brief");
    const rows = await cachedSnapshotWith({ situation: "x", whyNow: [], actions: [], risks: [] });
    // Predates persisted judgements: prose, but nothing structured to re-check.
    delete (rows[0].metadata as any).judgement;

    getContext.mockResolvedValue(rows);
    invokeLLM.mockClear();
    invokeLLM.mockResolvedValue(llmReply({ situation: "Fresh.", whyNow: [CLEAN_CLAIM], actions: [], risks: [] }));
    const brief = await generateAccountBrief(18);

    expect(brief.cached, "an unverifiable snapshot must not be served as cached").toBe(false);
    expect(invokeLLM, "it should have regenerated rather than trusted the prose").toHaveBeenCalled();
  });
});
