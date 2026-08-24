import { wrapUntrusted, INJECTION_GUARD } from "./_core/untrusted";
import { invokeLLM, llmText, LLM_UNAVAILABLE_NOTE } from "./_core/llm";
import { getDb } from "./db";
import { aiResponseCache } from "../drizzle/schema";
import { eq, and, gt } from "drizzle-orm";
import crypto from "crypto";
import { getCompanyContext, getCompanyConfig } from "./config";

/**
 * DEEP-THINK ARCHITECTURE
 * 2-Layer AI System for Enhanced Intelligence
 * 
 * Layer 1: Recursive Reasoning Engine (hidden backend)
 * Layer 2: Synthesizer (user-facing frontend)
 * 
 * + Response Caching for identical queries
 */

// Cache TTL in hours (default 24 hours)
const CACHE_TTL_HOURS = 24;

// Layer 1: Reasoning Engine System Prompt
const LAYER_1_PROMPT = `# SYSTEM ROLE: RECURSIVE REASONING CORE (INTERNAL ONLY)
You are a pure computational engine. You do NOT speak to users. You generate raw, structured reasoning data.

Your goal is to simulate "Super-Intelligence" by breaking a problem down into atomic steps, debating yourself, and verifying logic loops.

## INSTRUCTIONS
For every input, you must generate a verbose XML log of your thinking.
1.  **Deconstruct:** Break the user's prompt into variables and constraints.
2.  **Debate:** Generate 3 competing answers, then ruthlessly critique them to find flaws.
3.  **Iterate:** If the best answer has < 95% certainty, loop back and re-derive.

## OUTPUT FORMAT
You must ONLY output this XML structure. Do not add markdown or pleasantries.

<REASONING_LOG>
    <QUERY_ANALYSIS>
        <INTENT>...</INTENT>
        <CONSTRAINTS>...</CONSTRAINTS>
    </QUERY_ANALYSIS>
    <HYPOTHESIS_GENERATION>
        <PATH_1>...</PATH_1>
        <PATH_2>...</PATH_2>
        <PATH_3>...</PATH_3>
    </HYPOTHESIS_GENERATION>
    <ADVERSARIAL_REVIEW>
        <FLAWS_IN_PATH_1>...</FLAWS_IN_PATH_1>
        <FLAWS_IN_PATH_2>...</FLAWS_IN_PATH_2>
        <FLAWS_IN_PATH_3>...</FLAWS_IN_PATH_3>
    </ADVERSARIAL_REVIEW>
    <FINAL_SYNTHESIS>
        <LOGIC_CHAIN> [Step-by-step derivation of the best answer] </LOGIC_CHAIN>
        <RAW_ANSWER> [The unpolished but factually perfect answer] </RAW_ANSWER>
    </FINAL_SYNTHESIS>
</REASONING_LOG>`;

// Layer 2: Synthesizer System Prompt
const LAYER_2_PROMPT = `# SYSTEM ROLE: THE INTERFACE
You are an advanced AI assistant (Gemini/GPT-5 level persona).
You have access to a "Deep Thought Backend" that provides you with raw logical derivations.

## YOUR TASK
1.  Receive the User's original query.
2.  Receive the <REASONING_LOG> from the Backend.
3.  Extract the \`<RAW_ANSWER>\` and the logic from \`<LOGIC_CHAIN>\`.
4.  **Transformation:**
    * Strip away all XML tags, internal debates, and "robot" language.
    * Rewrite the answer to be elegant, empathetic, and extremely clear.
    * Use the logic provided to ensure the answer is 100% accurate, but make it sound effortless.

## CONSTRAINT
* **NEVER** mention "Layer 1", "XML", "Backend", or "Hypothesis Generation."
* Present the answer as if you just thought of it instantly.
* If the backend logic suggests uncertainty, convey that nuance gracefully.

Your goal is to make the user feel like they are talking to the smartest, most articulate person on earth.`;

export interface DeepThinkResult {
  answer: string;
  reasoning?: string; // Only included in debug mode
  cached?: boolean; // Indicates if response was from cache
  cacheHitCount?: number; // How many times this response has been served
  // False only when no model was reachable and `answer` is LLM_UNAVAILABLE_NOTE, not
  // a real answer. ContextualAI.tsx and SupportBot.tsx both used to do
  // `result.answer || fallback` — a non-empty degradation note is truthy, so it
  // rendered straight into the chat as if a model had actually answered the question.
  available?: boolean;
}

/**
 * Generate a hash for cache lookup
 */
function generateCacheHash(query: string, context: string): string {
  const combined = `${query.toLowerCase().trim()}|${context}`;
  return crypto.createHash("sha256").update(combined).digest("hex");
}

/**
 * Check cache for existing response
 */
async function checkCache(queryHash: string): Promise<DeepThinkResult | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    
    const now = new Date();
    const cached = await db
      .select()
      .from(aiResponseCache)
      .where(
        and(
          eq(aiResponseCache.queryHash, queryHash),
          gt(aiResponseCache.expiresAt, now)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      const entry = cached[0];
      
      // Update hit count and last hit time
      await db
        .update(aiResponseCache)
        .set({
          hitCount: (entry.hitCount || 1) + 1,
          lastHitAt: now
        })
        .where(eq(aiResponseCache.id, entry.id));

      return {
        answer: entry.answer,
        reasoning: entry.reasoning || undefined,
        cached: true,
        cacheHitCount: (entry.hitCount || 1) + 1
      };
    }
  } catch (error) {
    console.error("[DeepThink] Cache lookup error:", error);
  }
  return null;
}

/**
 * Store response in cache
 */
async function storeInCache(params: {
  queryHash: string;
  query: string;
  contextHash: string;
  answer: string;
  reasoning?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + CACHE_TTL_HOURS);

    await db.insert(aiResponseCache).values({
      queryHash: params.queryHash,
      query: params.query,
      contextHash: params.contextHash,
      answer: params.answer,
      reasoning: params.reasoning,
      expiresAt,
      hitCount: 1,
      lastHitAt: new Date()
    }).onDuplicateKeyUpdate({
      set: {
        answer: params.answer,
        reasoning: params.reasoning,
        expiresAt,
        lastHitAt: new Date()
      }
    });
  } catch (error) {
    console.error("[DeepThink] Cache store error:", error);
  }
}

/**
 * Execute Deep-Think Architecture
 * 2-layer AI processing for enhanced intelligence
 */
export async function deepThink(params: {
  query: string;
  context?: string;
  debugMode?: boolean;
  skipCache?: boolean;
}): Promise<DeepThinkResult> {
  const { query, context = "", debugMode = false, skipCache = false } = params;

  // Generate cache hash
  const queryHash = generateCacheHash(query, context);
  const contextHash = crypto.createHash("sha256").update(context).digest("hex").substring(0, 32);

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cachedResult = await checkCache(queryHash);
    if (cachedResult) {
      console.log(`[DeepThink] Cache HIT for query: "${query.substring(0, 50)}..."`);
      return {
        ...cachedResult,
        reasoning: debugMode ? cachedResult.reasoning : undefined,
        // Only a real answer is ever written to the cache (see the comment below,
        // at the point that writes it) — a cache hit is always available.
        available: true,
      };
    }
    console.log(`[DeepThink] Cache MISS for query: "${query.substring(0, 50)}..."`);
  }

  // ============================================
  // LAYER 1: RECURSIVE REASONING ENGINE
  // ============================================
  const layer1Input = context 
    ? `${wrapUntrusted("account and page context", context)}\n\nQUERY:\n${query}`
    : query;

  const layer1Response = await invokeLLM({
    messages: [
      { role: "system", content: LAYER_1_PROMPT + "\n\n" + INJECTION_GUARD },
      { role: "user", content: layer1Input }
    ]
  });

  const { content: reasoning, available: reasoningAvailable } = llmText(layer1Response);
  const reasoningStr = reasoningAvailable ? reasoning : LLM_UNAVAILABLE_NOTE;

  // ============================================
  // LAYER 2: SYNTHESIZER
  // ============================================
  const layer2Input = `ORIGINAL USER QUERY:
${query}

REASONING LOG FROM BACKEND:
${reasoningStr}

Transform this into a polished, human response.`;

  const layer2Response = await invokeLLM({
    messages: [
      { role: "system", content: LAYER_2_PROMPT + "\n\n" + INJECTION_GUARD },
      { role: "user", content: layer2Input }
    ]
  });

  // Caching the degradation note would make one outage look like a permanent answer.
  const { content: answer, available } = llmText(layer2Response);
  if (!available) {
    return { answer: LLM_UNAVAILABLE_NOTE, reasoning: reasoningStr, cached: false, available: false };
  }
  const answerStr = answer;

  // Store in cache for future use
  await storeInCache({
    queryHash,
    query,
    contextHash,
    answer: answerStr,
    reasoning: reasoningStr
  });

  return {
    answer: answerStr,
    reasoning: debugMode ? reasoningStr : undefined,
    cached: false,
    available: true
  };
}

/**
 * Deep-Think for Sales Intelligence
 * Specialized version with {COMPANY_NAME} context
 */
export async function deepThinkSales(params: {
  query: string;
  accountData?: any;
  contactData?: any;
  additionalContext?: string;
  debugMode?: boolean;
  skipCache?: boolean;
}): Promise<DeepThinkResult> {
  const { query, accountData, contactData, additionalContext, debugMode = false, skipCache = false } = params;

  // Build rich context
  let context = getCompanyContext();

  // Account and contact records carry text this deployment did not author (descriptions
  // and triggers from enrichment, topics lifted off calls), so they are fenced rather than
  // pasted — the sales assistant answers questions about them, it does not take orders.
  if (accountData) {
    context += `\n\n${wrapUntrusted("account data", accountData)}`;
  }

  if (contactData) {
    context += `\n\n${wrapUntrusted("contact data", contactData)}`;
  }

  if (additionalContext) {
    context += `\n\nADDITIONAL CONTEXT:\n${additionalContext}`;
  }

  return deepThink({ query, context, debugMode, skipCache });
}

/**
 * Deep-Think for Help/Support queries
 * Specialized version for dashboard help
 */
export async function deepThinkHelp(params: {
  query: string;
  debugMode?: boolean;
  skipCache?: boolean;
}): Promise<DeepThinkResult> {
  const { query, debugMode = false, skipCache = false } = params;

  const cfg = getCompanyConfig();
  const repsBlock = cfg.reps.length
    ? "\n\nREPS AND TERRITORIES:\n" + cfg.reps
        .map(r => `- ${r.name}: ${r.region}, ${r.sizeSegment === "enterprise" ? "2K+" : "<2K"} employees`)
        .join("\n")
    : "";

  const context = `DASHBOARD FEATURES:
- Accounts: View and manage target accounts with 6sense intent data
- Contacts: Browse contacts with title, company, and engagement info
- Insights: Analytics on buying stages, intent scores, keywords
- Priority Actions: AI-recommended accounts to engage
- CSV Processor: Transform messy CSVs to SFDC/HubSpot format
- Outreach Generator: AI-powered email drafts
- Rep Territories: Filter by region (West, Central, East) and company size (<2K, 2K+)${repsBlock}

If you can't answer something, suggest the user reach out to ${cfg.supportContact} for help.`;

  return deepThink({ query, context, debugMode, skipCache });
}
