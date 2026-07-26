import crypto from "crypto";
import { invokeLLM } from "../_core/llm";
import { getCompanyConfig } from "../config";
import { storeContext, getContext } from "../aiContext";
import { gatherAccountSignals, type SignalPack } from "./signals";

/**
 * ACCOUNT BRIEF ENGINE
 *
 * Division of labour, and the whole point of this module:
 *   - Every FACT (names, titles, scores, amounts, dates, counts) is rendered from the
 *     SignalPack by code. The model never gets to author a number or a person's name,
 *     so fabricating one is structurally impossible rather than scrubbed out afterwards.
 *   - The model contributes only JUDGEMENT (situation read, why-now, next actions, risks)
 *     and must cite the signal each judgement rests on.
 *
 * Briefs are versioned: each generation is snapshotted with the hash of the signals it
 * was built from plus a standardized metrics row, so an account's trajectory is diffable.
 */

export const BRIEF_VERSION = 2;
const BRIEF_CONTEXT_TYPE = "account_brief";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** The standardized, diffable metrics row stored with every brief. */
export type BriefMetrics = {
  intentScore: number | null;
  intentTrend: string;
  intentDelta: number | null;
  buyingStage: string | null;
  profileFit: string | null;
  contacts: number;
  calls: number;
  openActionItems: number;
  pipelineValue: number;
  weightedPipeline: number;
  openOpportunities: number;
  completeness: number;
};

export type AccountBrief = {
  accountId: number;
  accountName: string;
  markdown: string;
  signals: SignalPack;
  metrics: BriefMetrics;
  signalHash: string;
  version: number;
  generatedAt: string;
  cached: boolean;
  /** True when the narrative fell back to a deterministic render (no LLM available). */
  degraded: boolean;
  /** Statements removed because they could not be verified against the signal pack. */
  validation: Validation;
};

export type Judgement = {
  situation: string;
  whyNow: Array<{ point: string; evidence: string }>;
  actions: Array<{ action: string; rationale: string; evidence: string; priority: string }>;
  risks: Array<{ risk: string; evidence: string }>;
};

function metricsFrom(pack: SignalPack): BriefMetrics {
  return {
    intentScore: pack.intent.score,
    intentTrend: pack.intent.trend,
    intentDelta: pack.intent.delta,
    buyingStage: pack.intent.buyingStage,
    profileFit: pack.intent.profileFit,
    contacts: pack.stakeholders.total,
    calls: pack.conversations.total,
    openActionItems: pack.conversations.openActionItems.length,
    pipelineValue: pack.pipeline.totalValue,
    weightedPipeline: pack.pipeline.weightedValue,
    openOpportunities: pack.pipeline.open,
    completeness: pack.coverage.completeness,
  };
}

/** Hash the material signals (not the timestamp) so an unchanged account reuses its brief. */
function hashSignals(pack: SignalPack): string {
  const { generatedAt, conversations, ...rest } = pack;
  // daysSinceLastCall is derived from Date.now(), so it ticks over once a day at an hour
  // unrelated to the brief. Hashing it would expire the cache early and write no-op
  // history snapshots. lastCallDate is the stable source of truth and stays hashed.
  const { daysSinceLastCall, ...stableConversations } = conversations;
  const material = { ...rest, conversations: stableConversations };
  return crypto.createHash("sha256").update(JSON.stringify(material)).digest("hex").slice(0, 32);
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

// ---------------------------------------------------------------------------------
// Deterministic renderers — these produce every factual section of the brief.
// ---------------------------------------------------------------------------------

function renderSignalReadout(p: SignalPack): string {
  const rows: Array<[string, string]> = [];
  const acct = p.account;

  rows.push(["Company", `${acct.name}${acct.domain ? ` (${acct.domain})` : ""}`]);
  if (acct.industry) rows.push(["Industry", acct.industry]);
  if (acct.employeeCount) rows.push(["Employees", acct.employeeCount.toLocaleString("en-US")]);
  if (acct.revenue) rows.push(["Revenue", acct.revenue]);
  if (acct.location || acct.region) {
    rows.push(["Location", [acct.location, acct.region].filter(Boolean).join(" · ")]);
  }
  if (acct.relationship) rows.push(["Relationship", acct.relationship]);

  if (p.intent.score != null) {
    const trendMark = p.intent.trend === "rising" ? "▲" : p.intent.trend === "falling" ? "▼" : "→";
    const deltaText =
      p.intent.delta != null && p.intent.history.length >= 2
        ? ` (${trendMark} ${p.intent.delta >= 0 ? "+" : ""}${p.intent.delta} across ${p.intent.history.length} readings)`
        : "";
    rows.push(["Intent score", `${p.intent.score}/100${deltaText}`]);
  }
  if (p.intent.buyingStage) rows.push(["Buying stage", p.intent.buyingStage]);
  if (p.intent.profileFit) rows.push(["Profile fit", p.intent.profileFit]);
  if (p.intent.largestJump != null && p.intent.largestJump > 0) {
    rows.push(["Largest intent jump", `+${p.intent.largestJump} between consecutive readings`]);
  }
  if (p.intent.keywords.length) rows.push(["Intent keywords", p.intent.keywords.join(", ")]);
  if (p.technology.techStack.length) rows.push(["Tech stack", p.technology.techStack.join(", ")]);
  if (p.technology.securityStack.length) rows.push(["Security stack", p.technology.securityStack.join(", ")]);
  if (p.triggers.length) rows.push(["Trigger events", p.triggers.join("; ")]);

  rows.push(["Stakeholders", `${p.stakeholders.total} on file (${p.stakeholders.withEmail} with email)`]);
  rows.push([
    "Conversations",
    p.conversations.total
      ? `${p.conversations.total} calls · ${p.conversations.totalDurationMinutes} min · last ${p.conversations.daysSinceLastCall} days ago`
      : "None recorded",
  ]);
  rows.push([
    "Pipeline",
    p.pipeline.total
      ? `${p.pipeline.total} opp(s) · ${money(p.pipeline.totalValue)} total · ${money(p.pipeline.weightedValue)} weighted`
      : "No opportunities",
  ]);
  rows.push(["Signal coverage", `${Math.round(p.coverage.completeness * 100)}% (${p.coverage.present.length}/${p.coverage.present.length + p.coverage.missing.length} categories)`]);

  return ["## Signal Readout", "", "| Signal | Value |", "|---|---|",
    ...rows.map(([k, v]) => `| **${k}** | ${v} |`)].join("\n");
}

function renderStakeholders(p: SignalPack): string {
  if (!p.stakeholders.total) {
    return "## Stakeholder Map\n\nNo contacts on file. Outreach is blocked until contacts are added.";
  }
  const lines = p.stakeholders.people.map(
    (s) => `| ${s.name} | ${s.title || "—"} | ${s.seniority} | ${s.department || "—"} | ${s.email ? "✓" : "—"} |`
  );
  const mix = Object.entries(p.stakeholders.bySeniority)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  return [
    "## Stakeholder Map",
    "",
    `Coverage: ${mix}.`,
    "",
    "| Name | Title | Seniority | Dept | Email |",
    "|---|---|---|---|---|",
    ...lines,
  ].join("\n");
}

function renderConversations(p: SignalPack): string {
  if (!p.conversations.total) {
    return "## Conversation Intelligence\n\nNo calls recorded for this account.";
  }
  const sentiment = Object.entries(p.conversations.sentimentCounts)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  const out = [
    "## Conversation Intelligence",
    "",
    `**${p.conversations.total} calls** · ${p.conversations.totalDurationMinutes} min total · last contact ${p.conversations.daysSinceLastCall} days ago${sentiment ? ` · sentiment: ${sentiment}` : ""}`,
  ];
  if (p.conversations.topics.length) {
    out.push("", `**Topics raised:** ${p.conversations.topics.join(", ")}`);
  }
  if (p.conversations.openActionItems.length) {
    out.push("", "**Open action items (from calls):**");
    out.push(...p.conversations.openActionItems.map((a) => `- [ ] ${a}`));
  }
  if (p.conversations.recent.length) {
    out.push("", "**Recent calls:**");
    out.push(
      ...p.conversations.recent.map((c) => {
        const date = c.date ? c.date.slice(0, 10) : "unknown date";
        const meta = [c.durationMinutes ? `${c.durationMinutes} min` : null, c.sentiment].filter(Boolean);
        return `- ${date} — ${c.title || "Untitled"}${meta.length ? ` (${meta.join(", ")})` : ""}`;
      })
    );
  }
  return out.join("\n");
}

function renderPipeline(p: SignalPack): string {
  if (!p.pipeline.total) return "## Pipeline\n\nNo opportunities recorded.";
  const rows = p.pipeline.opportunities.map(
    (o) =>
      `| ${o.name} | ${o.stage} | ${o.status} | ${o.amount != null ? money(o.amount) : "—"} | ${o.probability != null ? `${o.probability}%` : "—"} | ${o.expectedCloseDate ? o.expectedCloseDate.slice(0, 10) : "—"} |`
  );
  return [
    "## Pipeline",
    "",
    `${p.pipeline.open} open · ${p.pipeline.won} won · ${p.pipeline.lost} lost · **${money(p.pipeline.totalValue)}** total · **${money(p.pipeline.weightedValue)}** probability-weighted`,
    "",
    "| Opportunity | Stage | Status | Amount | Probability | Close |",
    "|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function renderDataGaps(p: SignalPack): string {
  if (!p.coverage.missing.length) {
    return "## Data Gaps\n\nNone — all tracked signal categories have data.";
  }
  return [
    "## Data Gaps",
    "",
    "The following signal categories have no data. Nothing in this brief infers them:",
    ...p.coverage.missing.map((m) => `- ${m}`),
  ].join("\n");
}

// ---------------------------------------------------------------------------------
// Judgement layer — the only part the model authors.
// ---------------------------------------------------------------------------------

const JUDGEMENT_SCHEMA = {
  type: "object",
  properties: {
    situation: { type: "string" },
    whyNow: {
      type: "array",
      items: {
        type: "object",
        properties: { point: { type: "string" }, evidence: { type: "string" } },
        required: ["point", "evidence"],
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          rationale: { type: "string" },
          evidence: { type: "string" },
          priority: { type: "string" },
        },
        required: ["action", "rationale", "evidence", "priority"],
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: { risk: { type: "string" }, evidence: { type: "string" } },
        required: ["risk", "evidence"],
      },
    },
  },
  required: ["situation", "whyNow", "actions", "risks"],
} as const;

function buildJudgementPrompt(pack: SignalPack): { system: string; user: string } {
  const cfg = getCompanyConfig();
  const differentiators = cfg.keyDifferentiators?.length
    ? cfg.keyDifferentiators.map((d) => `- ${d.trim()}`).join("\n")
    : "- (none configured)";

  const system = `You are a senior B2B account strategist for ${cfg.companyName} (${cfg.industry}).
We sell: ${cfg.productDescription}
Our target customer: ${cfg.targetCustomers}
Our differentiators:
${differentiators}

You will receive a SIGNAL PACK: a complete, verified JSON record of everything known about one
account. It is the ONLY source of truth available to you.

HARD RULES — these define whether your output is usable:
1. Ground every statement in a specific field of the signal pack. The "evidence" field must
   quote the actual value you used (e.g. "intentScore 92, buyingStage Purchase", or
   "openActionItems: Send tailored demo").
2. NEVER invent a person, company, number, date, technology, or event that is not in the pack.
   If you want to reference something that isn't there, don't — the reader will check.
3. Do not restate the raw numbers as your analysis. The reader already sees a facts table.
   Your value is interpretation: what this combination of signals MEANS and what to do about it.
4. If a signal category is listed under coverage.missing, treat it as unknown. Never fill a gap
   with a plausible guess, and never recommend an action that depends on data we don't have.
5. Actions must be specific and executable by a rep this week — name the actual person to
   contact from the stakeholder list and the actual hook from the signals. "Reach out to
   stakeholders" or "engage the champion" are failures. Prefer advancing open action items
   that already exist over inventing new motions.
6. Be concise. Every sentence must carry information a rep could not get from the facts table.

Return ONLY a JSON object matching this shape:
{
  "situation": "2-3 sentences: where this account actually stands and what changed",
  "whyNow": [ { "point": "...", "evidence": "..." } ],
  "actions": [ { "action": "...", "rationale": "...", "evidence": "...", "priority": "high|medium|low" } ],
  "risks": [ { "risk": "...", "evidence": "..." } ]
}
Aim for 2-4 whyNow points, 3-5 actions, 1-3 risks.`;

  const user = `SIGNAL PACK (the only facts you may use):

${JSON.stringify(pack, null, 2)}

Produce the JSON judgement object for ${pack.account.name}.`;

  return { system, user };
}

function parseJudgement(raw: string): Judgement | null {
  if (!raw) return null;
  // Models sometimes wrap JSON in prose or fences — recover the object.
  let text = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  text = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.situation !== "string") return null;
    const arr = (v: any) => (Array.isArray(v) ? v : []);
    return {
      situation: parsed.situation,
      whyNow: arr(parsed.whyNow).filter((x: any) => x?.point),
      actions: arr(parsed.actions).filter((x: any) => x?.action),
      risks: arr(parsed.risks).filter((x: any) => x?.risk),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------
// Validation — the model's judgement is checked back against the signal pack before
// anything reaches the reader. Code renders the facts, so tables are already safe; this
// catches fabrication in the free-text narrative (a made-up stakeholder or dollar figure
// is the most damaging error a brief can contain, because a rep will act on it).
// ---------------------------------------------------------------------------------

export type Validation = { dropped: Array<{ section: string; text: string; reason: string }> };

/** Capitalized word-pairs that are business vocabulary, not people. */
const NON_PERSON_TERMS = new Set([
  "zero", "trust", "series", "new", "vp", "sales", "revops", "revenue", "operations",
  "purchase", "stage", "proposal", "discovery", "decision", "consideration", "awareness",
  "target", "open", "won", "lost", "profile", "fit", "strong", "moderate", "weak",
  "intent", "score", "buying", "signal", "pipeline", "account", "brief", "action",
  "items", "item", "high", "medium", "low", "north", "south", "east", "west", "central",
  "supply", "chain", "logistics", "security", "tech", "stack", "close", "date", "team",
  "rollout", "pilot", "terms", "demo", "call", "calls", "director", "manager", "head",
  "chief", "officer", "president", "founder", "partner", "owner", "lead", "principal",
  "data", "gaps", "why", "now", "risks", "situation", "recommended", "actions", "next",
  "q1", "q2", "q3", "q4", "crm", "ai", "roi", "poc", "sso", "mfa", "api",
]);

function buildKnownTokens(pack: SignalPack): Set<string> {
  const known = new Set<string>();
  const add = (v: unknown) => {
    if (!v) return;
    String(v)
      .split(/[^A-Za-z0-9']+/)
      .forEach((w) => w && known.add(w.toLowerCase()));
  };

  add(pack.account.name);
  add(pack.account.industry);
  add(pack.account.location);
  add(pack.account.region);
  add(pack.account.domain);
  add(pack.account.type);
  add(pack.account.relationship);
  add(pack.intent.buyingStage);
  add(pack.intent.profileFit);
  pack.intent.segments.forEach(add);
  pack.intent.keywords.forEach(add);
  pack.technology.techStack.forEach(add);
  pack.technology.securityStack.forEach(add);
  pack.triggers.forEach(add);
  pack.stakeholders.people.forEach((p) => {
    add(p.name);
    add(p.title);
    add(p.department);
  });
  pack.stakeholders.departments.forEach(add);
  pack.conversations.topics.forEach(add);
  pack.conversations.openActionItems.forEach(add);
  pack.conversations.recent.forEach((c) => add(c.title));
  pack.pipeline.opportunities.forEach((o) => {
    add(o.name);
    add(o.stage);
    add(o.status);
  });
  try {
    add(getCompanyConfig().companyName);
  } catch {
    /* config optional */
  }
  return known;
}

/** Every currency figure the pack can legitimately support, in the forms a model writes them. */
function buildKnownAmounts(pack: SignalPack): Set<string> {
  const amounts = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return;
    const v = Math.round(n);
    amounts.add(String(v));
    amounts.add(v.toLocaleString("en-US"));
    if (v >= 1000) {
      amounts.add(`${Math.round(v / 1000)}k`);
      amounts.add(`${(v / 1000).toFixed(1)}k`);
    }
    if (v >= 1_000_000) {
      amounts.add(`${Math.round(v / 1_000_000)}m`);
      amounts.add(`${(v / 1_000_000).toFixed(1)}m`);
    }
  };
  add(pack.pipeline.totalValue);
  add(pack.pipeline.weightedValue);
  pack.pipeline.opportunities.forEach((o) => add(o.amount));
  // Revenue is stored as a display string like "$420M" — keep its digits as legitimate.
  if (pack.account.revenue) {
    String(pack.account.revenue)
      .replace(/[$,]/g, "")
      .split(/\s+/)
      .forEach((tok) => tok && amounts.add(tok.toLowerCase()));
  }
  return amounts;
}

/** Returns a reason string when the text makes an unsupported claim, else null. */
function findFabrication(
  text: string,
  known: Set<string>,
  amounts: Set<string>
): string | null {
  if (!text) return null;

  // 1. Person-shaped references: two consecutive capitalized words where neither token is
  //    known vocabulary. This is what catches an invented stakeholder.
  const nameMatches = text.match(/\b[A-Z][a-z]{1,15}\s+[A-Z][a-z]{1,15}\b/g) || [];
  for (const candidate of nameMatches) {
    const [first, second] = candidate.split(/\s+/).map((w) => w.toLowerCase());
    if (NON_PERSON_TERMS.has(first) || NON_PERSON_TERMS.has(second)) continue;
    if (known.has(first) || known.has(second)) continue;
    return `references "${candidate}", who is not in the account's stakeholder data`;
  }

  // 2. Currency figures that the pipeline data cannot support.
  const moneyMatches = text.match(/\$\s?[\d,.]+\s?[kmKM]?/g) || [];
  for (const raw of moneyMatches) {
    const normalized = raw.replace(/[$\s,]/g, "").toLowerCase().replace(/\.0+$/, "");
    if (!normalized) continue;
    if (amounts.has(normalized) || amounts.has(normalized.replace(/\.\d+/, ""))) continue;
    return `cites ${raw.trim()}, which does not match any recorded amount`;
  }

  return null;
}

export function validateJudgement(j: Judgement, pack: SignalPack): { judgement: Judgement; validation: Validation } {
  const known = buildKnownTokens(pack);
  const amounts = buildKnownAmounts(pack);
  const dropped: Validation["dropped"] = [];

  const check = (section: string, text: string) => {
    const reason = findFabrication(text, known, amounts);
    if (reason) dropped.push({ section, text: text.slice(0, 160), reason });
    return !reason;
  };

  const whyNow = j.whyNow.filter((w) => check("Why Now", `${w.point} ${w.evidence}`));
  const actions = j.actions.filter((a) =>
    check("Recommended Actions", `${a.action} ${a.rationale} ${a.evidence}`)
  );
  const risks = j.risks.filter((r) => check("Risks", `${r.risk} ${r.evidence}`));

  // The situation paragraph is the brief's opening line; if it fabricates, replace it
  // with the deterministic version rather than dropping it entirely.
  const situationReason = findFabrication(j.situation, known, amounts);
  if (situationReason) {
    dropped.push({ section: "Situation", text: j.situation.slice(0, 160), reason: situationReason });
  }

  return {
    judgement: {
      situation: situationReason ? "" : j.situation,
      whyNow,
      actions,
      risks,
    },
    validation: { dropped },
  };
}

function renderJudgement(j: Judgement, fallbackSituation: string): string {
  const out: string[] = ["## Situation", "", j.situation || fallbackSituation];

  if (j.whyNow.length) {
    out.push("", "## Why Now", "");
    out.push(...j.whyNow.map((w) => `- **${w.point}**  \n  _Evidence: ${w.evidence}_`));
  }
  if (j.actions.length) {
    out.push("", "## Recommended Actions", "");
    out.push(
      ...j.actions.map((a, i) => {
        const p = (a.priority || "").toLowerCase();
        const tag = p === "high" ? "🔴 High" : p === "medium" ? "🟡 Medium" : p === "low" ? "🟢 Low" : a.priority || "—";
        return `${i + 1}. **${a.action}** — ${tag}  \n   ${a.rationale}  \n   _Evidence: ${a.evidence}_`;
      })
    );
  }
  if (j.risks.length) {
    out.push("", "## Risks", "");
    out.push(...j.risks.map((r) => `- **${r.risk}**  \n  _Evidence: ${r.evidence}_`));
  }
  return out.join("\n");
}

/** A situation line derived purely from the signals — used when the model is unavailable
 *  or when its own opening paragraph failed validation. */
function deterministicSituation(p: SignalPack): string {
  const bits: string[] = [];
  if (p.intent.score != null) {
    bits.push(`intent ${p.intent.score}/100${p.intent.trend !== "unknown" ? ` and ${p.intent.trend}` : ""}`);
  }
  if (p.intent.buyingStage) bits.push(`buying stage "${p.intent.buyingStage}"`);
  if (p.pipeline.open) {
    bits.push(`${p.pipeline.open} open opportunity worth ${money(p.pipeline.totalValue)}`);
  }
  if (p.conversations.total) {
    bits.push(`${p.conversations.total} recorded calls, last ${p.conversations.daysSinceLastCall} days ago`);
  }
  if (p.stakeholders.total) bits.push(`${p.stakeholders.total} stakeholders on file`);
  return `${p.account.name}${p.account.industry ? ` (${p.account.industry})` : ""} — ${bits.join(", ") || "limited signal data"}.`;
}

function renderDegradedSituation(p: SignalPack): string {
  return [
    "## Situation",
    "",
    deterministicSituation(p),
    "",
    "_AI interpretation unavailable — no model reachable. All facts below are read directly from your data._",
  ].join("\n");
}

/** Disclose what validation removed, so a thin brief is never mistaken for a quiet one. */
function renderValidationNote(v: Validation): string {
  if (!v.dropped.length) return "";
  const lines = v.dropped.map((d) => `- _${d.section}_: ${d.reason}`);
  return [
    "## Validation",
    "",
    `${v.dropped.length} generated statement(s) were removed because they could not be verified against your data:`,
    ...lines,
  ].join("\n");
}

function assembleBrief(pack: SignalPack, judgementMd: string, validation?: Validation): string {
  const header = `# Account Brief: ${pack.account.name}\n\n_Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · signal coverage ${Math.round(pack.coverage.completeness * 100)}%_`;
  return [
    header,
    judgementMd,
    renderSignalReadout(pack),
    renderStakeholders(pack),
    renderConversations(pack),
    renderPipeline(pack),
    renderDataGaps(pack),
    validation ? renderValidationNote(validation) : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------------

type Snapshot = {
  version: number;
  signalHash: string;
  generatedAt: string;
  metrics: BriefMetrics;
  markdown?: string;
  validation?: Validation;
};

async function loadSnapshots(accountId: number): Promise<Snapshot[]> {
  try {
    const rows = await getContext(BRIEF_CONTEXT_TYPE, `account_${accountId}`);
    return (rows || [])
      .map((r: any) => {
        const meta = r.metadata || {};
        if (!meta.signalHash || !meta.metrics) return null;
        return {
          version: meta.version ?? 1,
          signalHash: meta.signalHash,
          generatedAt: meta.generatedAt || r.createdAt,
          metrics: meta.metrics,
          markdown: r.value,
          validation: meta.validation,
        } as Snapshot;
      })
      .filter(Boolean) as Snapshot[];
  } catch (error) {
    console.error(`[brief] could not load history for account ${accountId}:`, error);
    return [];
  }
}

/**
 * Brief history with per-generation deltas, so you can see how the account moved
 * (intent climbed, pipeline grew, contacts added) rather than just re-reading prose.
 */
export async function getAccountBriefHistory(accountId: number, limit = 10) {
  const snaps = (await loadSnapshots(accountId))
    .sort((a, b) => (b.generatedAt || "").localeCompare(a.generatedAt || ""))
    .slice(0, limit);

  return snaps.map((snap, i) => {
    const prev = snaps[i + 1];
    const diff = (key: keyof BriefMetrics) => {
      const cur = snap.metrics?.[key];
      const old = prev?.metrics?.[key];
      if (typeof cur !== "number" || typeof old !== "number") return null;
      return cur - old;
    };
    return {
      version: snap.version,
      generatedAt: snap.generatedAt,
      signalHash: snap.signalHash,
      metrics: snap.metrics,
      changes: prev
        ? {
            intentScore: diff("intentScore"),
            contacts: diff("contacts"),
            calls: diff("calls"),
            pipelineValue: diff("pipelineValue"),
            weightedPipeline: diff("weightedPipeline"),
            openActionItems: diff("openActionItems"),
          }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------------

export async function generateAccountBrief(
  accountId: number,
  opts: { forceRefresh?: boolean } = {}
): Promise<AccountBrief> {
  const pack = await gatherAccountSignals(accountId);
  const signalHash = hashSignals(pack);
  const metrics = metricsFrom(pack);

  // Reuse the last brief when the underlying signals are byte-identical and still fresh.
  if (!opts.forceRefresh) {
    const snaps = await loadSnapshots(accountId);
    const latest = snaps
      .filter((s) => s.signalHash === signalHash && s.version === BRIEF_VERSION && s.markdown)
      .sort((a, b) => (b.generatedAt || "").localeCompare(a.generatedAt || ""))[0];
    if (latest && Date.now() - new Date(latest.generatedAt).getTime() < CACHE_TTL_MS) {
      return {
        accountId,
        accountName: pack.account.name,
        markdown: latest.markdown!,
        signals: pack,
        metrics,
        signalHash,
        version: BRIEF_VERSION,
        generatedAt: latest.generatedAt,
        cached: true,
        degraded: false,
        validation: latest.validation ?? { dropped: [] },
      };
    }
  }

  const { system, user } = buildJudgementPrompt(pack);
  let judgement: Judgement | null = null;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "judgement", schema: JUDGEMENT_SCHEMA as any } },
    });
    const content = response.choices?.[0]?.message?.content;
    judgement = parseJudgement(typeof content === "string" ? content : JSON.stringify(content));
  } catch (error) {
    console.error(`[brief] judgement generation failed for account ${accountId}:`, error);
  }

  const degraded = !judgement;
  let validation: Validation = { dropped: [] };
  let judgementMd: string;

  if (judgement) {
    const checked = validateJudgement(judgement, pack);
    validation = checked.validation;
    judgementMd = renderJudgement(checked.judgement, deterministicSituation(pack));
    if (validation.dropped.length) {
      console.warn(
        `[brief] dropped ${validation.dropped.length} unverifiable statement(s) for account ${accountId}`
      );
    }
  } else {
    judgementMd = renderDegradedSituation(pack);
  }

  const markdown = assembleBrief(pack, judgementMd, validation);
  const generatedAt = new Date().toISOString();

  // Snapshot for history. A degraded brief is not worth remembering as a version.
  if (!degraded) {
    try {
      await storeContext({
        type: BRIEF_CONTEXT_TYPE,
        key: `account_${accountId}`,
        value: markdown,
        metadata: { version: BRIEF_VERSION, signalHash, generatedAt, metrics, validation },
      });
    } catch (error) {
      console.error(`[brief] could not snapshot brief for account ${accountId}:`, error);
    }
  }

  return {
    accountId,
    accountName: pack.account.name,
    markdown,
    signals: pack,
    metrics,
    signalHash,
    version: BRIEF_VERSION,
    generatedAt,
    cached: false,
    degraded,
    validation,
  };
}
