import { invokeLLM } from "./_core/llm";
import { getAllAccounts, getAllPeople, getAllGongCalls } from "./db";

/**
 * AI Service Layer
 * Handles all intelligent processing, learning, and recommendations
 */

// Company context - the company's sales methodology and ICP
const COMPANY_CONTEXT = `
the company is a passwordless authentication and identity security company.

TARGET CUSTOMER PROFILE:
- Enterprise companies (1000+ employees)
- Industries: Financial Services, Healthcare, Technology, Government
- Key pain points: Password security, phishing attacks, compliance (SOC 2, HIPAA, FedRAMP)
- Tech stack indicators: Okta, Azure AD, legacy VPN, MFA solutions
- Buying signals: Recent security incidents, compliance deadlines, digital transformation initiatives

IDEAL DECISION MAKERS:
- CISO (Chief Information Security Officer)
- VP/Director of Security
- VP/Director of IT
- Identity & Access Management leads

SALES METHODOLOGY:
- Focus on passwordless security and zero trust architecture
- Emphasize ROI: reduced help desk costs, improved security posture
- Competitive against: Okta, Ping Identity, Microsoft Azure AD
- Key differentiators: Phishing-resistant MFA, device trust, seamless UX

BUYING SIGNALS TO WATCH:
- Security job openings (especially IAM, Zero Trust roles)
- Recent funding rounds (budget availability)
- Security incidents or breaches in the news
- Compliance initiatives (SOC 2, FedRAMP certification)
- Technology stack changes (moving to cloud, adopting zero trust)
- Executive changes (new CISO, new CTO)
`;

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
      { role: "system", content: "You are a sales call analyzer for the company. Extract insights from call transcripts." },
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
  const prompt = `${COMPANY_CONTEXT}

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
      { role: "system", content: "You are a sales email writer for the company. Write personalized, high-converting outreach emails." },
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
      { role: "system", content: "You are a search query interpreter. Understand user intent and translate to database filters." },
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
      { role: "system", content: "You are a contact prioritization AI. Rank contacts by likelihood to engage and influence deals." },
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
  // Ensure we only return top 10 contacts
  return rankings.slice(0, 10);
}
