import { wrapUntrusted, INJECTION_GUARD } from "./_core/untrusted";
import { getDb } from "./db";
import { contextStore } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } from "./_core/llm";
import { withRCP } from "./ai-system-prompt";
import { getCompanyConfig } from "./config";
// Real intent-spike detection, computed from the intentScores time series — so the AI
// assistant reports actual spikes instead of always answering "none detected".
import { detectIntentSpikes } from "./intel/spikes";

async function getRecentIntentSpikes(limit: number = 10): Promise<any[]> {
  return detectIntentSpikes({ limit });
}

/**
 * Centralized AI Context Management
 * Persistent learning and memory across all interactions
 */

export interface ContextEntry {
  /** The tenant this memory belongs to. AI memory is account data by another name. */
  orgId: number;
  type: 'account_insight' | 'contact_insight' | 'call_analysis' | 'user_interaction' | 'search_pattern' | 'recommendation' | 'learning' | 'account_brief' | 'company_brain';
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
    orgId: entry.orgId,
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
export async function getContext(orgId: number, type: string, key?: string): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  if (key) {
    const results = await db.select()
      .from(contextStore)
      .where(and(eq(contextStore.orgId, orgId), eq(contextStore.type, type), eq(contextStore.key, key)))
      .orderBy(desc(contextStore.createdAt))
      .limit(10);
    
    return results.map((r: any) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null
    }));
  } else {
    const results = await db.select()
      .from(contextStore)
      .where(and(eq(contextStore.orgId, orgId), eq(contextStore.type, type)))
      .orderBy(desc(contextStore.createdAt))
      .limit(50);
    
    return results.map((r: any) => ({
      ...r,
      metadata: r.metadata ? JSON.parse(r.metadata) : null
    }));
  }
}

/**
 * Build comprehensive context for AI queries
 */
export async function buildAIContext(params: {
  orgId: number;
  accountId?: number;
  contactId?: number;
  includeHistory?: boolean;
}): Promise<string> {
  const contextParts: string[] = [];

  // Get account insights
  if (params.accountId) {
    const accountContext = await getContext(params.orgId, 'account_insight', `account_${params.accountId}`);
    if (accountContext.length > 0) {
      contextParts.push(`\nACCOUNT INSIGHTS:\n${accountContext.map(c => `- ${c.value}`).join('\n')}`);
    }
  }

  // Get contact insights
  if (params.contactId) {
    const contactContext = await getContext(params.orgId, 'contact_insight', `contact_${params.contactId}`);
    if (contactContext.length > 0) {
      contextParts.push(`\nCONTACT INSIGHTS:\n${contactContext.map(c => `- ${c.value}`).join('\n')}`);
    }
  }

  // Get recent learnings
  if (params.includeHistory) {
    const learnings = await getContext(params.orgId, 'learning');
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
  /** The tenant asking. The workspace brain below is per-org; without this the chat
   *  would answer one customer's question using another customer's portfolio. */
  orgId: number;
  query: string;
  accountId?: number;
  contactId?: number;
  userId?: number;
  conversationHistory?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}): Promise<{ answer: string; insights: string[]; available: boolean }> {
  const { orgId, query, accountId, contactId, userId, conversationHistory = [] } = params;

  // Build context from storage
  let storedContext = await buildAIContext({ orgId, accountId, contactId, includeHistory: true });

  // Prepend the continuously-learning workspace brain (verified snapshot + accumulated
  // lessons) so chat answers draw on the whole portfolio's knowledge.
  try {
    const { getBrainDigest, brainContextBlock } = await import("./intel/brain");
    storedContext = `${brainContextBlock(await getBrainDigest(params.orgId))}\n${storedContext}`;
  } catch { /* brain unavailable → chat still works */ }

  // Check for intent spike queries
  let intentSpikeContext = '';
  const intentSpikeKeywords = ['intent spike', 'intent increase', 'intent jump', 'buying signal', 'score increase', '6sense spike', 'recent spikes'];
  if (intentSpikeKeywords.some(keyword => query.toLowerCase().includes(keyword))) {
    // detectIntentSpikes throws on a genuine query failure now, rather than returning []
    // the same as "checked, found nothing" — this is the one caller that must not let
    // that failure abort the whole chat reply, so it's caught locally. The two
    // messages below must stay distinguishable: telling the model "no spikes" when the
    // check never ran would have it confidently repeat that as fact to a rep.
    let recentSpikes: any[] = [];
    let spikesChecked = true;
    try {
      recentSpikes = await getRecentIntentSpikes(10);
    } catch (err) {
      spikesChecked = false;
      console.error('[aiContext] could not check intent spikes:', err);
    }

    if (!spikesChecked) {
      intentSpikeContext = `\n\nIntent spike data could not be checked right now — do not state whether any spikes occurred.`;
    } else if (recentSpikes.length > 0) {
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
      const accountResults = await db.select().from(accounts)
        .where(and(eq(accounts.orgId, orgId), eq(accounts.id, accountId))).limit(1);
      accountData = accountResults[0] || null;

      relatedCalls = await db.select().from(calls)
        .where(and(eq(calls.orgId, orgId), eq(calls.accountId, accountId))).limit(5);
    }

    if (contactId) {
      const { contacts, calls } = await import("../drizzle/schema");
      const contactResults = await db.select().from(contacts)
        .where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId))).limit(1);
      contactData = contactResults[0] || null;

      const callResults = await db.select().from(calls)
        .where(and(eq(calls.orgId, orgId), eq(calls.contactId, contactId))).limit(5);
      relatedCalls = [...relatedCalls, ...callResults];
    }
  }

  // Build comprehensive prompt
  const config = getCompanyConfig();
  const differentiatorsList = config.keyDifferentiators
    ? config.keyDifferentiators.map(d => `- ${d.trim()}`).join('\n')
    : '- Modern B2B features';

  const systemPrompt = withRCP(`You are an AI sales intelligence assistant for ${config.companyName}, a company specializing in ${config.industry}.

COMPANY CONTEXT:
- Target customers: ${config.targetCustomers}
- Key pain points: Addressed by ${config.productDescription}
- Decision makers: Key executive stakeholders (C-level, VP, Director, Leads)
- Differentiators:
${differentiatorsList}

${storedContext}

You have access to:
- Account data, contact information, and Gong call transcripts
- Historical insights and learnings from previous interactions
- Buying signals, tech stack data, and engagement history

Provide actionable, specific answers. When making recommendations, cite specific data points.`);

  const userPrompt = `${query}

${accountData ? `\nACCOUNT DATA:\n${wrapUntrusted("account data", accountData)}` : ''}
${contactData ? `\nCONTACT DATA:\n${wrapUntrusted("contact data", contactData)}` : ''}
${relatedCalls.length > 0 ? `\nRECENT CALLS (${relatedCalls.length}):\n${wrapUntrusted("related calls", relatedCalls.slice(0, 3))}` : ''}
${intentSpikeContext}`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...conversationHistory,
    { role: "user" as const, content: userPrompt }
  ];

  const response = await invokeLLM({ messages });
  // With no model reachable this is the degradation note, not a reply. Returned as-is
  // it reads like an answer, and everything below would then mine it for "insights"
  // and write those into the conversation memory.
  const { content: answer, available } = llmText(response);
  // Both chat widgets (GlobalAIChat.tsx, AIAssistant.tsx) set the assistant's message
  // straight from `answer` with no other check — without `available` here, the outage
  // note was indistinguishable from a real reply and rendered in the same bubble style.
  if (!available) return { answer: LLM_UNAVAILABLE_NOTE, insights: [], available: false };
  const answerStr = answer;

  // Extract insights and store for future use
  const insights: string[] = [];
  
  // Store this interaction for learning
  await storeContext({
    orgId,
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

      // Mining the degradation note for "insights" would write apologies into the
      // context store, where they resurface as prior learnings on every later answer.
      const { content: learningContent, available: learningAvailable } = llmText(learningResponse);
      if (!learningAvailable) return { answer: answerStr, insights: [], available: true };
      const parsed = JSON.parse(learningContent);
      
      for (const insight of parsed.insights) {
        insights.push(insight);
        
        // Store insights
        if (accountId) {
          await storeContext({
            orgId,
            type: 'account_insight',
            key: `account_${accountId}`,
            value: insight,
            metadata: { source: 'conversation', timestamp: Date.now() }
          });
        }
        
        if (contactId) {
          await storeContext({
            orgId,
            type: 'contact_insight',
            key: `contact_${contactId}`,
            value: insight,
            metadata: { source: 'conversation', timestamp: Date.now() }
          });
        }

        await storeContext({
          orgId,
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

  return { answer: answerStr, insights, available: true };
}

/**
 * Auto-generate account summary with AI
 */
export async function generateAccountSummary(orgId: number, accountId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "Unable to generate summary";

  const { accounts, contacts, calls } = await import("../drizzle/schema");
  
  const account = await db.select().from(accounts)
    .where(and(eq(accounts.orgId, orgId), eq(accounts.id, accountId))).limit(1);
  if (!account[0]) return "Account not found";

  const accountContacts = await db.select().from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.accountId, accountId))).limit(10);
  const accountCalls = await db.select().from(calls)
    .where(and(eq(calls.orgId, orgId), eq(calls.accountId, accountId))).limit(10);

  // Get stored insights
  const storedInsights = await getContext(orgId, 'account_insight', `account_${accountId}`);

  const contactNames = accountContacts.map((c: any) => `${c.name} - ${c.title || 'No title'}`).join('\n');
  const config = getCompanyConfig();

  const prompt = `You are a sales intelligence analyst for ${config.companyName}, a company specializing in ${config.industry}.

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
[ONE paragraph: Based on intent score ${account[0].intentScore}, industry ${account[0].industry}, and employee count ${account[0].employeeCount}, explain WHY they need our solution (${config.productDescription}) NOW. Reference their current tech stack if available. Focus on pain points solved and value drivers.]

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
${wrapUntrusted("account record", account[0])}

REAL CONTACTS:
${contactNames}

RECENT CALLS:
${accountCalls.length > 0 ? wrapUntrusted("recent calls", accountCalls.slice(0, 3)) : 'No calls recorded'}

${storedInsights.length > 0 ? `\nPREVIOUS INSIGHTS:\n${storedInsights.map(i => `- ${i.value}`).join('\n')}` : ''}`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP("You are a sales intelligence analyst. Create comprehensive account summaries.") },
      { role: "user", content: prompt }
    ]
  });

  // With no model reachable this is the degradation note. It used to be returned as the
  // summary AND cached under account_insight, so the apology became the stored answer
  // and outlived the outage.
  const { content: summary, available } = llmText(response);
  if (!available) return LLM_UNAVAILABLE_NOTE;
  const summaryStr = summary;

  // Store the summary
  await storeContext({
    orgId,
    type: 'account_insight',
    key: `account_${accountId}`,
    value: `Auto-generated summary: ${summaryStr.substring(0, 200)}...`,
    metadata: { type: 'summary', fullSummary: summaryStr }
  });

  return summary;
}

/**
 * Auto-generate contact summary with AI, optionally including LinkedIn data
 */
export async function generateContactSummary(
  orgId: number,
  contactId: number,
  includeLinkedIn: boolean = false
): Promise<{ content: string; available: boolean }> {
  const db = await getDb();
  if (!db) return { content: "Unable to generate summary", available: false };

  const { contacts, calls, accounts } = await import("../drizzle/schema");
  const { getLinkedInContextForContact } = await import("./linkedin");

  const contact = await db.select().from(contacts)
    .where(and(eq(contacts.orgId, orgId), eq(contacts.id, contactId))).limit(1);
  if (!contact[0]) return { content: "Contact not found", available: false };

  // Get account context if available
  let accountContext = '';
  if (contact[0].accountId) {
    const account = await db.select().from(accounts)
      .where(and(eq(accounts.orgId, orgId), eq(accounts.id, contact[0].accountId))).limit(1);
    if (account[0]) {
      accountContext = `\nACCOUNT CONTEXT:\n- Company: ${account[0].name}\n- Industry: ${account[0].industry || 'Unknown'}\n- Intent Score: ${account[0].intentScore || 'N/A'}\n- Buying Stage: ${(account[0] as any).sixsenseBuyingStage || 'Unknown'}`;
    }
  }

  const contactCalls = await db.select().from(calls)
    .where(and(eq(calls.orgId, orgId), eq(calls.contactId, contactId))).limit(10);

  // Get stored insights
  const storedInsights = await getContext(orgId, 'contact_insight', `contact_${contactId}`);

  // Fetch real-time LinkedIn data if requested and URL is available
  let linkedInSection = '';
  if (contact[0].linkedinUrl) {
    if (includeLinkedIn) {
      try {
        const linkedInContext = await getLinkedInContextForContact(contact[0].linkedinUrl);
        if (linkedInContext) {
          linkedInSection = `\n\nREAL-TIME LINKEDIN DATA:\n${linkedInContext}`;
        } else {
          linkedInSection = `\nLINKEDIN PROFILE: ${contact[0].linkedinUrl}\n(Unable to fetch real-time data)`;
        }
      } catch (error) {
        console.error('Error fetching LinkedIn data:', error);
        linkedInSection = `\nLINKEDIN PROFILE: ${contact[0].linkedinUrl}\n(Error fetching real-time data)`;
      }
    } else {
      linkedInSection = `\nLINKEDIN PROFILE: ${contact[0].linkedinUrl}`;
    }
  }

  const prompt = `Generate a comprehensive profile summary for this contact:

CONTACT INFO:
- Name: ${contact[0].name}
- Title: ${contact[0].title || 'Unknown'}
- Company: ${contact[0].company || 'Unknown'}
- Email: ${contact[0].email || 'Unknown'}
- Phone: ${contact[0].phone || 'Unknown'}
- Location: ${contact[0].location || 'Unknown'}${linkedInSection}${accountContext}

CALL HISTORY (${contactCalls.length} calls): ${contactCalls.length > 0 ? JSON.stringify(contactCalls.slice(0, 3).map((c: any) => ({ date: c.callDate, duration: c.duration, summary: c.summary?.substring(0, 200) })), null, 2) : 'No recorded calls'}

${storedInsights.length > 0 ? `PREVIOUS INSIGHTS:\n${storedInsights.map(i => `- ${i.value}`).join('\n')}` : ''}

Create a concise but insightful profile covering:
1. **Role & Influence**: Their position, responsibilities, and decision-making authority
2. **Background**: Professional experience and expertise areas (infer from title and company)
3. **Engagement**: Key topics from past conversations and their priorities
4. **Outreach Strategy**: Best approach, talking points, and timing recommendations

Be specific, actionable, and avoid generic statements. Focus on what makes this contact unique and how to effectively engage them.`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: withRCP("You are a sales intelligence analyst specializing in B2B enterprise sales. Create actionable contact profiles that help sales reps effectively engage prospects. Be concise, specific, and avoid generic advice. Output only the final profile - no reasoning or thinking sections.") },
      { role: "user", content: prompt }
    ]
  });

  // With no model reachable this is the degradation note. It used to be returned as the
  // summary AND cached under account_insight, so the apology became the stored answer
  // and outlived the outage. It was also handed to the client as an ordinary successful
  // string with no `available` flag — ContactDetail.tsx toasted "AI summary generated
  // from LinkedIn!" over a panel that literally said the model was unreachable.
  const { content: summary, available } = llmText(response);
  if (!available) return { content: LLM_UNAVAILABLE_NOTE, available: false };
  const summaryStr = summary;

  // Store the summary
  await storeContext({
    orgId,
    type: 'contact_insight',
    key: `contact_${contactId}`,
    value: `Auto-generated profile: ${summaryStr.substring(0, 200)}...`,
    metadata: { type: 'profile', fullSummary: summaryStr }
  });

  return { content: summary, available: true };
}
