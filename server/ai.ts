import { invokeLLM } from "./_core/llm";
import { getAllAccounts, getAllPeople, getAllGongCalls } from "./db";
import { withRCP, asRevenueArchitect } from "./ai-system-prompt";
import { getCompanyConfig } from "./config";
import { TITLE_TOKENS, isDecisionMaker } from "@shared/taxonomy";

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
${JSON.stringify(accountData, null, 2)}

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

  const content = response.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
}

/**
 * Analyze Gong call and extract insights
 */
export async function analyzeGongCall(callData: any): Promise<any> {
  const prompt = `${getCompanyContext()}

Analyze this sales call transcript and extract key insights:

CALL DATA:
${JSON.stringify(callData, null, 2)}

Provide a JSON response with:
1. summary: Brief call summary (2-3 sentences)
2. keyTopics: Array of main topics discussed
3. objections: Array of objections or concerns raised
4. nextSteps: Array of agreed next steps
5. sentiment: Overall sentiment (positive/neutral/negative)
6. buyingSignals: Array of buying signals detected
7. competitorsMentioned: Array of competitors mentioned
8. actionItems: Array of specific action items for the rep
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

  const content = response.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
}

/**
 * Generate personalized outreach email
 */
export async function generateOutreachEmail(accountData: any, contactData: any, context?: string): Promise<string> {
  const prompt = `${getCompanyContext()}

Generate a personalized outreach email for this prospect:

ACCOUNT: ${JSON.stringify(accountData, null, 2)}
CONTACT: ${JSON.stringify(contactData, null, 2)}
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

  const content = response.choices[0].message.content;
  return typeof content === 'string' ? content : JSON.stringify(content);
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
    const content = response.choices[0].message.content;
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
    if (parsed && typeof parsed === "object" && !("available" in parsed)) interp = { ...interp, ...parsed };
  } catch { /* fall back to text-only search below */ }

  // Actually run the search against real data — the whole point the page was missing.
  const { results, resultType } = runSearch(query, interp, accounts, people);
  if (!interp.explanation) {
    interp.explanation = `Interpreted as a ${resultType} search. ${results.length} match${results.length === 1 ? "" : "es"} found.`;
  }
  return { ...interp, resultType, resultCount: results.length, results };
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
): { results: any[]; resultType: "account" | "contact" } {
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
  const wantsContacts =
    interp.intent === "contact_search" ||
    isDecisionMaker(q) ||
    /\b(who|contact|contacts|person|people|decision maker)\b/.test(q);

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
        if (q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w))) score += 5;
        return { ...p, accountName: acc?.name, _score: Math.round(score) };
      })
      .filter(Boolean) as any[];
    scored.sort((a, b) => b._score - a._score);
    return { results: scored.slice(0, 25), resultType: "contact" };
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
      if (q.split(/\s+/).some((w) => w.length > 3 && hay.includes(w))) score += 8;
      return {
        id: a.id, name: a.name, domain: a.domain, industry: a.industry, region: a.region,
        employeeCount: a.employeeCount, intentScore: a.intentScore,
        buyingStage: a.sixsenseBuyingStage, relationship: a.relationship, _score: Math.round(score),
      };
    })
    .filter(Boolean) as any[];
  scored.sort((a, b) => b._score - a._score);
  return { results: scored.slice(0, 25), resultType: "account" };
}

/**
 * Prioritize contacts for outreach
 */
export async function prioritizeContacts(contacts: any[], accountContext: any): Promise<any[]> {
  const prompt = `${getCompanyContext()}

Given these contacts at the same account, rank them by outreach priority:

ACCOUNT CONTEXT: ${JSON.stringify(accountContext, null, 2)}
CONTACTS: ${JSON.stringify(contacts, null, 2)}

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

  const content = response.choices[0].message.content;
  const rankings = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content)).rankings;
  
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
