import { wrapUntrusted, INJECTION_GUARD, stripLeakedFence } from "./_core/untrusted";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE, parseLlmJson } from "./_core/llm";
import { getAllAccounts, getAllPeople, getAllGongCalls } from "./db";
import { withRCP, asRevenueArchitect } from "./ai-system-prompt";
import { getCompanyConfig } from "./config";
import { TITLE_TOKENS, isDecisionMaker, bySeniority } from "@shared/taxonomy";

/**
 * AI Service Layer
 * Handles all intelligent processing, learning, and recommendations
 */

// Dynamically build company context based on config
function getCompanyContext(): string {
  const config = getCompanyConfig();
  
  const competitorsList = config.competitors
    ? config.competitors.split(',').map(c => `- ${c.trim()}`).join('\n')
    : '- Traditional Competitors';
    
  const differentiatorsList = config.keyDifferentiators
    ? config.keyDifferentiators.map(d => `- ${d.trim()}`).join('\n')
    : '- Modern B2B features';

  return `
COMPANY: ${config.companyName}
INDUSTRY: ${config.industry}
DESCRIPTION: ${config.companyDescription}
PRODUCT: ${config.productDescription}

TARGET CUSTOMER PROFILE:
- ${config.targetCustomers}
- Key pain points: Addressed by ${config.productDescription}

IDEAL DECISION MAKERS:
- Key executive stakeholders in targeted sectors (C-level, VP, Director, Leads)

SALES METHODOLOGY:
- Focus on value, ROI, and solving the specific customer pain points.
- Emphasize key benefits of our solution.
- Competitive against:
${competitorsList}
- Key differentiators:
${differentiatorsList}

BUYING SIGNALS TO WATCH:
- Job openings related to our space
- Budget signals / funding rounds
- Technology stack shifts / migration plans
- Executive changes (new C-level leadership)
- Operational/compliance/strategic initiatives in target domains
`;
}

interface EnrichmentResult {
  summary: string;
  score: number;
  insights: string[];
  recommendations: string[];
  confidence: number;
}

/**
 * Enrich account with AI-powered analysis
 */
export async function enrichAccountWithAI(accountData: any): Promise<EnrichmentResult> {
  const prompt = `${getCompanyContext()}

Analyze this target account and provide sales intelligence:

ACCOUNT DATA:
${wrapUntrusted("account data", accountData)}

Provide a JSON response with:
1. summary: 2-3 sentence executive summary of this account's fit and priority
2. score: Overall account score 0-100 based on fit, intent, and opportunity
3. insights: Array of 3-5 key insights about this account
4. recommendations: Array of 3-5 specific action items for the sales team
5. confidence: Your confidence in this analysis (0-100)

Focus on:
- How well they match our ICP
- Buying signals and intent
- Tech stack fit and gaps
- Competitive landscape
- Specific outreach angles
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: asRevenueArchitect("Analyze this target account and provide tactical sales intelligence. Use REAL data only.") },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "account_enrichment",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            score: { type: "number" },
            insights: { type: "array", items: { type: "string" } },
            recommendations: { type: "array", items: { type: "string" } },
            confidence: { type: "number" }
          },
          required: ["summary", "score", "insights", "recommendations", "confidence"],
          additionalProperties: false
        }
      }
    }
  });

  // No model reachable: the note would JSON.parse into an object with none of the
  // fields below, and every caller would read undefined off it.
  const { content, available } = llmText(response);
  if (!available) {
    return { summary: LLM_UNAVAILABLE_NOTE, score: 0, insights: [], recommendations: [], confidence: 0 };
  }
  return parseLlmJson(content);
}

/** Fields may arrive as a real array, a JSON string, or a comma-joined string. */
function toArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
      } catch { /* fall through to comma-split */ }
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/** Shares a real word (4+ chars, to skip "the"/"and"-type noise) with a known-good string. */
function overlapsKnownText(candidate: string, knownWords: Set<string>): boolean {
  const words = candidate.toLowerCase().match(/[a-z0-9]{4,}/g) || [];
  return words.some((w) => knownWords.has(w));
}

/**
 * The prompt tells the model explicitly to reuse the metadata's own topics/action
 * items and to leave objections/buyingSignals/competitorsMentioned empty unless
 * evidenced — but nothing checked that it actually did. Confirmed live: call 13's
 * real keyTopics were ["budget","expansion"], and analyzeGongCall returned
 * ["budget","expansion","AI-powered insights","operational improvement"] plus a
 * buyingSignal ("Technology stack shifts") absent from the metadata entirely, and
 * a summary claiming the account was in "financial services" when the account's
 * real industry recorded elsewhere is different. This drops any array entry that
 * doesn't share real text with the call's own metadata, the same "computed facts,
 * not model claims" principle server/intel/brief.ts already applies to briefs.
 */
export function sanitizeCallAnalysis(analysis: any, callData: any): any {
  const knownWords = new Set<string>();
  const add = (s: unknown) => {
    for (const w of String(s || "").toLowerCase().match(/[a-z0-9]{4,}/g) || []) knownWords.add(w);
  };
  add(callData?.title);
  add(callData?.sentiment);
  toArray(callData?.keyTopics).forEach(add);
  toArray(callData?.actionItems).forEach(add);

  const filterArray = (items: unknown): string[] =>
    toArray(items).filter((item) => overlapsKnownText(item, knownWords));

  return {
    ...analysis,
    // The array fields above are already dropped if fabricated; summary is prose,
    // so it can't be filtered the same way — but it can still leak the untrusted-
    // data fence's own ID the same way webinar-generator output did (server/
    // tools-router.ts), so strip that defensively rather than leaving it unguarded.
    summary: typeof analysis?.summary === "string" ? stripLeakedFence(analysis.summary) : analysis?.summary,
    keyTopics: filterArray(analysis?.keyTopics),
    nextSteps: filterArray(analysis?.nextSteps),
    actionItems: filterArray(analysis?.actionItems),
    // Stricter fields: the prompt says these must be empty unless directly
    // evidenced, so anything that doesn't overlap known text is dropped outright
    // rather than kept-with-a-caveat.
    objections: filterArray(analysis?.objections),
    buyingSignals: filterArray(analysis?.buyingSignals),
    competitorsMentioned: filterArray(analysis?.competitorsMentioned),
  };
}

/**
 * Analyze Gong call and extract insights
 */
export async function analyzeGongCall(callData: any): Promise<any> {
  // We do not store full transcript text for Gong calls — only metadata (title,
  // duration, sentiment, and topics/action items already extracted at ingest time).
  // Telling the model this is a "transcript" invites it to invent specifics (named
  // competitors, objections, buying signals) that were never actually said on the
  // call. Be explicit about what's real so the model elaborates on the given data
  // instead of fabricating detail to fill required fields.
  const prompt = `${getCompanyContext()}

Below is METADATA for a sales call — NOT the full transcript. No transcript text is
available. The metadata includes the call title, duration, sentiment, and topics/action
items that were already extracted from the call.

CALL METADATA:
${wrapUntrusted("call metadata", callData)}

Using ONLY the metadata given above, provide a JSON response with:
1. summary: Brief summary of the call based on the metadata (2-3 sentences)
2. keyTopics: Array of main topics — reuse/refine the topics already present in the metadata
3. objections: Array of objections or concerns — ONLY if evidenced by the metadata, otherwise an empty array
4. nextSteps: Array of agreed next steps — reuse/refine the action items already present in the metadata
5. sentiment: Overall sentiment (positive/neutral/negative) — use the sentiment field if present
6. buyingSignals: Array of buying signals — ONLY if evidenced by the metadata, otherwise an empty array
7. competitorsMentioned: Array of competitors — ONLY if a competitor is explicitly named in the metadata, otherwise an empty array. Do NOT guess or name typical competitors that are not actually present in the data.
8. actionItems: Array of specific action items for the rep — reuse/refine the action items already present in the metadata

Do not invent details that are not present in the metadata above. If information for a
field isn't in the data, return an empty array rather than a plausible-sounding guess.
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP(`You are a sales call analyzer for ${getCompanyConfig().companyName}. Extract insights from call transcripts.`) },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "call_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            keyTopics: { type: "array", items: { type: "string" } },
            objections: { type: "array", items: { type: "string" } },
            nextSteps: { type: "array", items: { type: "string" } },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
            buyingSignals: { type: "array", items: { type: "string" } },
            competitorsMentioned: { type: "array", items: { type: "string" } },
            actionItems: { type: "array", items: { type: "string" } }
          },
          required: ["summary", "keyTopics", "objections", "nextSteps", "sentiment", "buyingSignals", "competitorsMentioned", "actionItems"],
          additionalProperties: false
        }
      }
    }
  });

  const { content, available } = llmText(response);
  if (!available) {
    // `summary` used to be the only place this showed up — inside a JSON blob dumped
    // to the page (Calls.tsx renders the whole response with JSON.stringify), next to
    // several genuinely-empty arrays. Nothing marked the object itself as a failure,
    // so the row still expanded and read as "not much happened on this call" rather
    // than "the analysis didn't run."
    return {
      summary: LLM_UNAVAILABLE_NOTE, keyTopics: [], objections: [], nextSteps: [],
      sentiment: "neutral", buyingSignals: [], competitorsMentioned: [], actionItems: [],
      available: false,
    };
  }
  return { ...sanitizeCallAnalysis(parseLlmJson(content), callData), available: true };
}

/**
 * Generate personalized outreach email
 */
export async function generateOutreachEmail(accountData: any, contactData: any, context?: string): Promise<string> {
  const prompt = `${getCompanyContext()}

Generate a personalized outreach email for this prospect:

ACCOUNT: ${wrapUntrusted("account data", accountData)}
CONTACT: ${wrapUntrusted("contact data", contactData)}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

Write a compelling, personalized email that:
1. References specific details about their company/role
2. Addresses a likely pain point based on their profile
3. Offers clear value proposition
4. Includes a specific, low-friction call to action
5. Keeps it under 150 words
6. Professional but conversational tone

Return only the email body (no subject line).
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: asRevenueArchitect("Write a personalized outreach email. Use REAL contact names and account data provided. Never fabricate details.") },
      { role: "user", content: prompt }
    ]
  });

  const { content, available } = llmText(response);
  return available ? content : LLM_UNAVAILABLE_NOTE;
}

/**
 * Smart search with natural language understanding
 */
export async function intelligentSearch(query: string): Promise<any> {
  // Get all data for context
  const accounts = await getAllAccounts();
  const people = await getAllPeople();
  const calls = await getAllGongCalls();

  const prompt = `${getCompanyContext()}

User search query: "${query}"

Available data summary:
- ${accounts.length} accounts
- ${people.length} contacts  
- ${calls.length} Gong calls

Interpret this search query and return a JSON response with:
1. intent: What is the user trying to find? (account_search, contact_search, insight_request, recommendation_request)
2. filters: Object with relevant filters to apply
3. sortBy: How to sort results (relevance, score, recent_activity, etc.)
4. explanation: Brief explanation of how you interpreted the query

Examples:
- "show me high-intent accounts in fintech" -> filter by industry=financial, sort by intent score
- "who should I call this week" -> filter by priority score, recent activity
- "accounts with recent security incidents" -> filter by trigger data containing incidents
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP("You are a search query interpreter. Understand user intent and translate to database filters.") },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "search_intent",
        strict: true,
        schema: {
          type: "object",
          properties: {
            intent: { type: "string", enum: ["account_search", "contact_search", "insight_request", "recommendation_request"] },
            filters: { type: "object", additionalProperties: true },
            sortBy: { type: "string" },
            explanation: { type: "string" }
          },
          required: ["intent", "filters", "sortBy", "explanation"],
          additionalProperties: false
        }
      }
    }
  });

  // Interpret the query. Tolerate a degraded/unavailable model — we still search.
  let interp: { intent: string; filters: Record<string, any>; sortBy: string; explanation: string } = {
    intent: "account_search", filters: {}, sortBy: "relevance", explanation: "",
  };
  try {
    const { content, available } = llmText(response);
    // Without a model the deterministic interpretation below still answers the query.
    if (!available) throw new Error("no model");
    const parsed = parseLlmJson(content);
    if (parsed && typeof parsed === "object") interp = { ...interp, ...parsed };
  } catch { /* fall back to text-only search below */ }

  // Actually run the search against real data — the whole point the page was missing.
  const { results, resultType, appliedFilters } = runSearch(query, interp, accounts, people);

  // interp.filters/explanation are the model's own unverified claims about what it
  // did — spread into the response untouched, they could describe constraints that
  // were never actually enforced against `results`. Confirmed live: an empty query
  // returned an explanation naming an industry allowlist and a >1000-employee floor,
  // while the results themselves included accounts with as few as 31 employees in
  // "Professional Services" — a filter description that didn't match the filtering
  // that actually ran. appliedFilters is what runSearch really checked; report that
  // instead of relaying the model's account of itself.
  const definedFilters = Object.fromEntries(
    Object.entries(appliedFilters).filter(([, v]) => v !== undefined)
  );
  const filterSummary = Object.entries(definedFilters)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join(" · ");
  const explanation =
    `Interpreted as a ${resultType} search.` +
    (filterSummary ? ` Applied — ${filterSummary}.` : " No specific filter recognized in the query; ranked by relevance.") +
    ` ${results.length} match${results.length === 1 ? "" : "es"} found.`;

  return { ...interp, filters: definedFilters, explanation, resultType, resultCount: results.length, results };
}

/**
 * Deterministically apply an interpreted query to real accounts/contacts and rank matches.
 * Works from both the model's structured filters and the raw query text, so results appear
 * even when the model is unavailable.
 */
function runSearch(
  query: string,
  interp: { intent: string; filters: Record<string, any> },
  accounts: any[],
  people: any[]
): { results: any[]; resultType: "account" | "contact"; appliedFilters: Record<string, unknown> } {
  const q = (query || "").toLowerCase();
  const f = interp.filters || {};

  const firstStr = (...vals: any[]) => vals.find((v) => typeof v === "string" && v.trim());
  const firstNum = (...vals: any[]) => vals.map(Number).find((n) => Number.isFinite(n));

  // ---- resolve constraints from filters OR query text ------------------------------
  // Match the query against industry/region values actually present in the data, so text
  // queries filter correctly even when the model returned no structured filters.
  const matchFromData = (values: string[]) => {
    const known = Array.from(new Set(values.map((v) => (v || "").toLowerCase()).filter(Boolean)));
    return known.find((val) => q.includes(val) || val.split(/[\s&/,-]+/).some((w) => w.length > 3 && q.includes(w)));
  };
  const industry = (firstStr(f.industry, f.sector, f.vertical) || matchFromData(accounts.map((a) => a.industry)) || "").toLowerCase();
  const region = (firstStr(f.region, f.geo, f.location) || matchFromData(accounts.map((a) => a.region)) || "").toLowerCase();
  let minIntent = firstNum(f.minIntentScore, f.minIntent, f.intentScore, f.intent_min);
  if (minIntent == null && /(high|strong)\s*intent|ready to buy|hot/.test(q)) minIntent = 70;
  const minEmployees = firstNum(f.minEmployees, f.employeeMin, f.min_employees);
  const empMatch = q.match(/(\d[\d,]{2,})\s*\+?\s*(employees|people|staff)/);
  const minEmpFromText = empMatch ? Number(empMatch[1].replace(/,/g, "")) : undefined;
  const employeeFloor = minEmployees ?? minEmpFromText;

  let stages = Array.isArray(f.buyingStage) ? f.buyingStage.map(String)
    : firstStr(f.buyingStage, f.stage) ? [String(firstStr(f.buyingStage, f.stage))] : [];
  if (!stages.length && /ready to buy|purchase|closing/.test(q)) stages = ["Purchase", "Decision"];
  const stageSet = new Set(stages.map((s) => s.toLowerCase()));

  // Vocabulary from @shared/taxonomy: "find me the CISOs" has to look for the same
  // word the Decision makers tile counts, or search and the dashboard disagree.
  const titleKeywords: string[] = [];
  for (const kw of TITLE_TOKENS) {
    if (q.includes(kw) || (firstStr(f.title) || "").toLowerCase().includes(kw)) titleKeywords.push(kw);
  }

  // A seniority word in the question means the rep is asking about people, so that
  // test comes from the shared taxonomy rather than a fourth list of executive titles.
  // isDecisionMaker() and the literal word list below both require a whole-token
  // match ("ciso", not "cisos"), so a plural title query never set either one —
  // even though titleKeywords two lines up already recognized "ciso" inside
  // "cisos" via substring match. Confirmed live: the app's own suggested example
  // query, "Find CISOs at companies with 1000+ employees", routed to account
  // (company) search 3/3 runs instead of contact (person) search, and so did
  // "find CTOs". titleKeywords having found anything already means the rep is
  // asking about people by title — that's the more direct signal, use it.
  const wantsContacts =
    interp.intent === "contact_search" ||
    isDecisionMaker(q) ||
    titleKeywords.length > 0 ||
    /\b(who|contact|contacts|person|people|decision maker)\b/.test(q);

  // Whether ANY real constraint — structured filter or a recognized title/intent/
  // stage keyword in the query text — actually narrowed this search. Used below
  // so a query with none of these (gibberish, emoji, SQL-shaped text, an unknown
  // company name) can't fall through to "everyone, ranked by intent score" and
  // still be reported as N query matches.
  const hasStructuredConstraint = !!(
    industry || region || minIntent != null || employeeFloor != null || stageSet.size || titleKeywords.length
  );
  const appliedFilters: Record<string, unknown> = {
    industry: industry || undefined,
    region: region || undefined,
    minIntentScore: minIntent ?? undefined,
    minEmployees: employeeFloor ?? undefined,
    buyingStage: stages.length ? stages : undefined,
    titleKeywords: titleKeywords.length ? titleKeywords : undefined,
  };

  // ---- contact search --------------------------------------------------------------
  if (wantsContacts) {
    const accById = new Map(accounts.map((a) => [a.id, a]));
    const scored = people
      .map((p) => {
        const acc = p.accountId != null ? accById.get(p.accountId) : null;
        const title = (p.title || "").toLowerCase();
        let score = 0;
        const titleHit = titleKeywords.some((k) => title.includes(k));
        if (titleKeywords.length) { if (!titleHit) return null; score += 40; }
        if (industry && acc) { if (!(acc.industry || "").toLowerCase().includes(industry)) return null; score += 20; }
        if (employeeFloor != null && acc) { if ((acc.employeeCount || 0) < employeeFloor) return null; score += 10; }
        if (acc) score += (acc.intentScore || 0) * 0.2;
        // text relevance
        const hay = `${p.name} ${p.title} ${p.company || ""} ${acc?.name || ""}`.toLowerCase();
        const textHit = q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w));
        if (textHit) score += 5;
        // Nothing about this query narrowed the search AND nothing about this
        // record actually matches its text — without this, a query with no
        // recognized structure (gibberish, emoji, an unknown name) fell through
        // to "everyone, ranked by intent score" and was reported as N real
        // matches. Confirmed live on four such queries, all returning a full
        // page of 25 confidently-labelled "matches".
        if (!hasStructuredConstraint && !textHit) return null;
        return { ...p, accountName: acc?.name, _score: Math.round(score) };
      })
      .filter(Boolean) as any[];
    scored.sort((a, b) => b._score - a._score);
    return { results: scored.slice(0, 25), resultType: "contact", appliedFilters };
  }

  // ---- account search --------------------------------------------------------------
  const scored = accounts
    .map((a) => {
      let score = 0;
      if (industry) { if (!(a.industry || "").toLowerCase().includes(industry)) return null; score += 25; }
      if (region) { if (!(a.region || "").toLowerCase().includes(region)) return null; score += 15; }
      if (minIntent != null) { if ((a.intentScore || 0) < minIntent) return null; score += 15; }
      if (employeeFloor != null) { if ((a.employeeCount || 0) < employeeFloor) return null; score += 10; }
      if (stageSet.size) { if (!stageSet.has((a.sixsenseBuyingStage || "").toLowerCase())) return null; score += 20; }
      score += (a.intentScore || 0) * 0.5;
      const hay = `${a.name} ${a.industry || ""} ${a.region || ""} ${a.description || ""} ${a.techStack || ""}`.toLowerCase();
      const textHit = q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w));
      if (textHit) score += 8;
      // Same reasoning as the contact branch above: with no structured filter
      // and no text overlap, this record isn't a match for the query — it's
      // just a highly-scored account that would appear for any query at all.
      if (!hasStructuredConstraint && !textHit) return null;
      return {
        id: a.id, name: a.name, domain: a.domain, industry: a.industry, region: a.region,
        employeeCount: a.employeeCount, intentScore: a.intentScore,
        buyingStage: a.sixsenseBuyingStage, relationship: a.relationship, _score: Math.round(score),
      };
    })
    .filter(Boolean) as any[];
  scored.sort((a, b) => b._score - a._score);
  return { results: scored.slice(0, 25), resultType: "account", appliedFilters };
}

/**
 * Prioritize contacts for outreach
 */
export async function prioritizeContacts(contacts: any[], accountContext: any): Promise<any[]> {
  const prompt = `${getCompanyContext()}

Given these contacts at the same account, rank them by outreach priority:

ACCOUNT CONTEXT: ${wrapUntrusted("account context", accountContext)}
CONTACTS: ${wrapUntrusted("contact list", contacts)}

Return a JSON array of contact IDs sorted by priority (highest first), with reasoning for each.
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP("You are a contact prioritization AI. Rank contacts by likelihood to engage and influence deals.") },
      { role: "user", content: prompt }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "contact_priority",
        strict: true,
        schema: {
          type: "object",
          properties: {
            rankings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  contactId: { type: "number" },
                  priority: { type: "number" },
                  reasoning: { type: "string" }
                },
                required: ["contactId", "priority", "reasoning"],
                additionalProperties: false
              }
            }
          },
          required: ["rankings"],
          additionalProperties: false
        }
      }
    }
  });

  // Seniority order is a defensible ranking on its own, so an outage degrades the
  // quality of the list rather than emptying it.
  const { content, available } = llmText(response);
  if (!available) return [...contacts].sort(bySeniority);
  const rankings = parseLlmJson<{ rankings: any[] }>(content).rankings;
  
  // Map rankings back to full contact objects, sorted by priority
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const sortedContacts = rankings
    .sort((a: any, b: any) => b.priority - a.priority)
    .map((r: any) => {
      const contact = contactMap.get(r.contactId);
      if (contact) {
        return { ...contact, aiPriority: r.priority, aiReasoning: r.reasoning };
      }
      return null;
    })
    .filter(Boolean);
  
  // Return top 10 prioritized contacts with full data
  return sortedContacts.slice(0, 10);
}
