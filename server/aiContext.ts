import { getDb } from "./db";
import { contextStore } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { withRCP } from "./ai-system-prompt";

// Stub for intent spike tracking (removed to fix TS errors)
async function getRecentIntentSpikes(limit: number = 10): Promise<any[]> { return []; }

/**
 * Centralized AI Context Management
 * Persistent learning and memory across all interactions
 */

export interface ContextEntry {
  type: 'account_insight' | 'contact_insight' | 'call_analysis' | 'user_interaction' | 'search_pattern' | 'recommendation' | 'learning';
  key: string;
  value: string;
  metadata?: any;
  userId?: number;
}

/**
 * Store context for AI learning
 */
export async function storeContext(entry: ContextEntry): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(contextStore).values({
    type: entry.type,
    key: entry.key,
    value: entry.value,
    metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    userId: entry.userId || null
  });
}

/**
 * Retrieve context by type and key
 */
export async function getContext(type: string, key?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  if (key) {
    const results = await db.select()
      .from(contextStore)
      .where(and(eq(contextStore.type, type), eq(contextStore.key, key)))
      .orderBy(desc(contextStore.createdAt))
      .limit(10);
    
    return results.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null
    }));
  } else {
    const results = await db.select()
      .from(contextStore)
      .where(eq(contextStore.type, type))
      .orderBy(desc(contextStore.createdAt))
      .limit(50);
    
    return results.map(r => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null
    }));
  }
}

/**
 * Build comprehensive context for AI queries
 */
export async function buildAIContext(params: {
  accountId?: number;
  contactId?: number;
  includeHistory?: boolean;
}): Promise<string> {
  const contextParts: string[] = [];

  // Get account insights
  if (params.accountId) {
    const accountContext = await getContext('account_insight', `account_${params.accountId}`);
    if (accountContext.length > 0) {
      contextParts.push(`\nACCOUNT INSIGHTS:\n${accountContext.map(c => `- ${c.value}`).join('\n')}`);
    }
  }

  // Get contact insights
  if (params.contactId) {
    const contactContext = await getContext('contact_insight', `contact_${params.contactId}`);
    if (contactContext.length > 0) {
      contextParts.push(`\nCONTACT INSIGHTS:\n${contactContext.map(c => `- ${c.value}`).join('\n')}`);
    }
  }

  // Get recent learnings
  if (params.includeHistory) {
    const learnings = await getContext('learning');
    if (learnings.length > 0) {
      contextParts.push(`\nPREVIOUS LEARNINGS:\n${learnings.slice(0, 5).map(c => `- ${c.value}`).join('\n')}`);
    }
  }

  return contextParts.join('\n');
}

/**
 * Intelligent conversation handler with persistent memory
 */
export async function conversationWithMemory(params: {
  query: string;
  accountId?: number;
  contactId?: number;
  userId?: number;
  conversationHistory?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}): Promise<{ answer: string; insights: string[] }> {
  const { query, accountId, contactId, userId, conversationHistory = [] } = params;

  // Build context from storage
  const storedContext = await buildAIContext({ accountId, contactId, includeHistory: true });

  // Check for intent spike queries
  let intentSpikeContext = '';
  const intentSpikeKeywords = ['intent spike', 'intent increase', 'intent jump', 'buying signal', 'score increase', '6sense spike', 'recent spikes'];
  if (intentSpikeKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
    const recentSpikes = await getRecentIntentSpikes(10);
    
    if (recentSpikes.length > 0) {
      intentSpikeContext = `\n\nRECENT 6SENSE INTENT SPIKES (20+ point increases in 24 hours):\n`;
      recentSpikes.forEach((spike: any, index: number) => {
        intentSpikeContext += `${index + 1}. ${spike.accountName}: ${spike.previousScore} → ${spike.currentScore} (+${spike.scoreDelta} points)\n`;
      });
      intentSpikeContext += `\nThese accounts are showing strong buying signals and should be prioritized for immediate outreach.`;
    } else {
      intentSpikeContext = `\n\nNo recent intent spikes detected (no accounts with 20+ point increases in 24 hours).`;
    }
  }

  // Get relevant data
  const db = await getDb();
  let accountData = null;
  let contactData = null;
  let relatedCalls: any[] = [];

  if (db) {
    if (accountId) {
      const { accounts, calls } = await import("../drizzle/schema");
      const accountResults = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
      accountData = accountResults[0] || null;
      
      relatedCalls = await db.select().from(calls).where(eq(calls.accountId, accountId)).limit(5);
    }

    if (contactId) {
      const { contacts, calls } = await import("../drizzle/schema");
      const contactResults = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
      contactData = contactResults[0] || null;
      
      const callResults = await db.select().from(calls).where(eq(calls.contactId, contactId)).limit(5);
      relatedCalls = [...relatedCalls, ...callResults];
    }
  }

  // Build comprehensive prompt
  const systemPrompt = withRCP(`You are an AI sales intelligence assistant for the company, a passwordless authentication company.

COMPANY CONTEXT:
- Target customers: Enterprise (1000+ employees) in Financial Services, Healthcare, Technology, Government
- Key pain points: Password security, phishing, compliance (SOC 2, HIPAA, FedRAMP)
- Decision makers: CISO, VP Security, VP IT, IAM leads
- Differentiators: Phishing-resistant MFA, device trust, seamless UX

${storedContext}

You have access to:
- Account data, contact information, and Gong call transcripts
- Historical insights and learnings from previous interactions
- Buying signals, tech stack data, and engagement history

Provide actionable, specific answers. When making recommendations, cite specific data points.`);

  const userPrompt = `${query}

${accountData ? `\nACCOUNT DATA:\n${JSON.stringify(accountData, null, 2)}` : ''}
${contactData ? `\nCONTACT DATA:\n${JSON.stringify(contactData, null, 2)}` : ''}
${relatedCalls.length > 0 ? `\nRECENT CALLS (${relatedCalls.length}):\n${JSON.stringify(relatedCalls.slice(0, 3), null, 2)}` : ''}
${intentSpikeContext}`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory,
    { role: "user" as const, content: userPrompt }
  ];

  const response = await invokeLLM({ messages });
  const answer = response.choices[0].message.content || "I couldn't process that request.";
  const answerStr = typeof answer === 'string' ? answer : JSON.stringify(answer);

  // Extract insights and store for future use
  const insights: string[] = [];
  
  // Store this interaction for learning
  await storeContext({
    type: 'user_interaction',
    key: `query_${Date.now()}`,
    value: query,
    metadata: { answer: answerStr.substring(0, 500), accountId, contactId },
    userId
  });

  // Analyze the conversation for learnings
  if (accountData || contactData) {
    const learningPrompt = `Based on this conversation, extract 1-3 key insights that should be remembered for future interactions:

Query: ${query}
Answer: ${answer}

Return a JSON array of insight strings.`;

    try {
      const learningResponse = await invokeLLM({
        messages: [
          { role: "system", content: withRCP("Extract key learnings from conversations.") },
          { role: "user", content: learningPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "learnings",
            strict: true,
            schema: {
              type: "object",
              properties: {
                insights: { type: "array", items: { type: "string" } }
              },
              required: ["insights"],
              additionalProperties: false
            }
          }
        }
      });

      const learningContent = learningResponse.choices[0].message.content;
      const parsed = JSON.parse(typeof learningContent === 'string' ? learningContent : JSON.stringify(learningContent));
      
      for (const insight of parsed.insights) {
        insights.push(insight);
        
        // Store insights
        if (accountId) {
          await storeContext({
            type: 'account_insight',
            key: `account_${accountId}`,
            value: insight,
            metadata: { source: 'conversation', timestamp: Date.now() }
          });
        }
        
        if (contactId) {
          await storeContext({
            type: 'contact_insight',
            key: `contact_${contactId}`,
            value: insight,
            metadata: { source: 'conversation', timestamp: Date.now() }
          });
        }

        await storeContext({
          type: 'learning',
          key: `learning_${Date.now()}`,
          value: insight,
          metadata: { accountId, contactId }
        });
      }
    } catch (error) {
      console.error('Error extracting learnings:', error);
    }
  }

  return { answer: answerStr, insights };
}

/**
 * Auto-generate account summary with AI
 */
export async function generateAccountSummary(accountId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Unable to generate summary";

  const { accounts, contacts, calls } = await import("../drizzle/schema");
  
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account[0]) return "Account not found";

  const accountContacts = await db.select().from(contacts).where(eq(contacts.accountId, accountId)).limit(10);
  const accountCalls = await db.select().from(calls).where(eq(calls.accountId, accountId)).limit(10);

  // Get stored insights
  const storedInsights = await getContext('account_insight', `account_${accountId}`);

  const contactNames = accountContacts.map((c: any) => `${c.name} - ${c.title || 'No title'}`).join('\n');

  const prompt = `You are a sales intelligence analyst for the company, a passwordless MFA/SSO security company.

Generate an executive summary using this EXACT structure:

## Executive Summary: ${account[0].name}

### Account Intelligence
- **Company:** ${account[0].name}
- **Industry:** ${account[0].industry || 'Unknown'}
- **Employee Count:** ${account[0].employeeCount || 'Unknown'}
- **Region:** ${(account[0] as any).region || 'Unknown'}
- **Intent Score:** ${account[0].intentScore || 0}/100
- **Relationship:** ${account[0].relationship || 'Prospect'}
- **Domain:** ${account[0].domain || 'Unknown'}

### Key Stakeholders (${accountContacts.length} contacts)
| Name (EXACT) | Title (EXACT) | Role in Decision |
|---|---|---|
${accountContacts.slice(0, 5).map((c: any) => `| ${c.name} | ${c.title || 'No title'} | [Analyze role] |`).join('\n')}

### Strategic Fit & Why Now
[ONE paragraph: Based on intent score ${account[0].intentScore}, industry ${account[0].industry}, and employee count ${account[0].employeeCount}, explain WHY they need passwordless MFA NOW. Reference their current tech stack if available. Focus on security/compliance opportunity.]

### Engagement Status
- **Total Contacts:** ${accountContacts.length}
- **Recent Calls:** ${accountCalls.length}
- **Last Activity:** ${accountCalls[0]?.callDate || 'No recent activity'}
- **Buying Signals:** [Analyze based on intent score and activity]

### Next Best Actions
1. **Immediate Outreach:** Contact ${accountContacts[0]?.name || 'primary stakeholder'} (${accountContacts[0]?.title || 'decision maker'}) with [specific messaging]
2. **Discovery Focus:** [Pain points to confirm based on their industry and size]
3. **Technical Path:** [How to get to POC/validation]

CRITICAL RULES:
- Use EXACT contact names from data: ${contactNames}
- Use EXACT metrics: Intent ${account[0].intentScore}, ${accountContacts.length} contacts, ${accountCalls.length} calls
- Reference REAL call data if available: ${accountCalls.length > 0 ? accountCalls[0]?.callDate : 'No calls yet'}
- NEVER use placeholder names like 'Jennifer Smith' or 'John Doe'
- If data missing, state 'Data not available' - do NOT invent

ACCOUNT DATA:
${JSON.stringify(account[0], null, 2)}

REAL CONTACTS:
${contactNames}

RECENT CALLS:
${accountCalls.length > 0 ? JSON.stringify(accountCalls.slice(0, 3), null, 2) : 'No calls recorded'}

${storedInsights.length > 0 ? `\nPREVIOUS INSIGHTS:\n${storedInsights.map(i => `- ${i.value}`).join('\n')}` : ''}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP("You are a sales intelligence analyst. Create comprehensive account summaries.") },
      { role: "user", content: prompt }
    ]
  });

  const summary = response.choices[0].message.content || "Unable to generate summary";
  const summaryStr = typeof summary === 'string' ? summary : JSON.stringify(summary);

  // Store the summary
  await storeContext({
    type: 'account_insight',
    key: `account_${accountId}`,
    value: `Auto-generated summary: ${summaryStr.substring(0, 200)}...`,
    metadata: { type: 'summary', fullSummary: summaryStr }
  });

  return typeof summary === 'string' ? summary : JSON.stringify(summary);
}

/**
 * Auto-generate contact summary with AI
 */
export async function generateContactSummary(contactId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Unable to generate summary";

  const { contacts, calls } = await import("../drizzle/schema");
  
  const contact = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact[0]) return "Contact not found";

  const contactCalls = await db.select().from(calls).where(eq(calls.contactId, contactId)).limit(10);

  // Get stored insights
  const storedInsights = await getContext('contact_insight', `contact_${contactId}`);

  const prompt = `Generate a comprehensive profile summary for this contact:

CONTACT: ${JSON.stringify(contact[0], null, 2)}
CALL HISTORY (${contactCalls.length}): ${JSON.stringify(contactCalls.slice(0, 3), null, 2)}

${storedInsights.length > 0 ? `\nPREVIOUS INSIGHTS:\n${storedInsights.map(i => `- ${i.value}`).join('\n')}` : ''}

Create a 2-3 paragraph profile covering:
1. Role, responsibilities, and influence in the organization
2. Engagement history and topics of interest
3. Pain points and priorities based on conversations
4. Best approach for outreach

Be specific and personalized.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP("You are a sales intelligence analyst. Create detailed contact profiles.") },
      { role: "user", content: prompt }
    ]
  });

  const summary = response.choices[0].message.content || "Unable to generate summary";
  const summaryStr = typeof summary === 'string' ? summary : JSON.stringify(summary);

  // Store the summary
  await storeContext({
    type: 'contact_insight',
    key: `contact_${contactId}`,
    value: `Auto-generated profile: ${summaryStr.substring(0, 200)}...`,
    metadata: { type: 'profile', fullSummary: summaryStr }
  });

  return typeof summary === 'string' ? summary : JSON.stringify(summary);
}
