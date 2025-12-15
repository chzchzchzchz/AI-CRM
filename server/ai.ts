import { invokeLLM } from "./_core/llm";
import { getAllAccounts, getAllPeople, getAllGongCalls } from "./db";
import { REVENUE_ARCHITECT_CORE, ACCOUNT_ANALYSIS_PROMPT, CONTACT_PRIORITIZATION_PROMPT } from "./revenueArchitect";

/**
 * AI Service Layer - Revenue Architect Mode
 * Ruthlessly efficient sales intelligence. No fluff. Only kill shots.
 */

// Legacy context kept for backward compatibility
const COMPANY_CONTEXT = REVENUE_ARCHITECT_CORE;

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
  const prompt = `${COMPANY_CONTEXT}

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
      { role: "system", content: "You are a sales intelligence AI for the company. Analyze accounts and provide actionable insights." },
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
  const prompt = `${COMPANY_CONTEXT}

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
      { role: "system", content: REVENUE_ARCHITECT_CORE + "\n\nTASK: Analyze this call. Find the leverage points and blockers. No fluff." },
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
  // Extract ACTUAL security stack from account data
  let securityStack: string[] = [];
  try {
    if (accountData.securityStack) {
      securityStack = typeof accountData.securityStack === 'string' 
        ? JSON.parse(accountData.securityStack) 
        : accountData.securityStack;
    }
  } catch {}

  // Extract ACTUAL tech stack
  let techStack: string[] = [];
  try {
    if (accountData.techStack) {
      techStack = typeof accountData.techStack === 'string' 
        ? JSON.parse(accountData.techStack) 
        : accountData.techStack;
    }
  } catch {}

  // Build context with ONLY real data
  const realDataContext = {
    contact: {
      name: contactData.name || `${contactData.firstName} ${contactData.lastName}`,
      title: contactData.title,
      email: contactData.email,
      engagementScore: contactData.engagementScore,
      followscompany: contactData.followscompany
    },
    account: {
      name: accountData.name,
      industry: accountData.industry,
      employeeCount: accountData.employeeCount,
      intentScore: accountData.intentScore,
      buyingStage: accountData.buyingStage || accountData.sixsenseBuyingStage || 'Unknown'
    },
    securityStack: securityStack.length > 0 ? securityStack : ['No security stack data - lead with value prop'],
    techStack: techStack.length > 0 ? techStack : ['No tech stack data']
  };

  const prompt = `CRITICAL: Use ONLY the data provided below. Do NOT invent or assume anything.

REAL DATA:
${JSON.stringify(realDataContext, null, 2)}
${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

RULES:
1. Use the EXACT contact name: ${realDataContext.contact.name}
2. Reference their EXACT title: ${realDataContext.contact.title}
3. If securityStack contains Okta/Duo/Ping/Entra, use competitive angle
4. If securityStack says "No security stack data", lead with value prop NOT competitor displacement
5. If they follow the company (followscompany=true), mention you noticed they're interested
6. Reference ACTUAL employee count: ${realDataContext.account.employeeCount}
7. Reference ACTUAL intent score: ${realDataContext.account.intentScore}

Write a 3-4 sentence email that:
- Opens with something SPECIFIC to their situation (not generic)
- Gets to the point fast
- Has ONE clear ask
- NO fluff, NO "hope this finds you well"

Return only the email body.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: REVENUE_ARCHITECT_CORE + "\n\nTASK: Write a killer opening email. No fluff. Hook them in the first line with something specific to their situation. Use ONLY the data provided - never guess or assume." },
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

  const prompt = `${COMPANY_CONTEXT}

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
      { role: "system", content: "You are a search query interpreter. Translate user intent to database filters. Be precise." },
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

  const content = response.choices[0].message.content;
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));
}

/**
 * Prioritize contacts for outreach
 */
export async function prioritizeContacts(contacts: any[], accountContext: any): Promise<any[]> {
  const prompt = `${COMPANY_CONTEXT}

Given these contacts at the same account, rank them by outreach priority:

ACCOUNT CONTEXT: ${JSON.stringify(accountContext, null, 2)}
CONTACTS: ${JSON.stringify(contacts, null, 2)}

Return a JSON array of contact IDs sorted by priority (highest first), with reasoning for each.
`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: CONTACT_PRIORITIZATION_PROMPT },
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
  return JSON.parse(typeof content === 'string' ? content : JSON.stringify(content)).rankings;
}
