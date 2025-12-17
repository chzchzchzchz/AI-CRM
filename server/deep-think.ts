import { invokeLLM } from "./_core/llm";

/**
 * DEEP-THINK ARCHITECTURE
 * 2-Layer AI System for Enhanced Intelligence
 * 
 * Layer 1: Recursive Reasoning Engine (hidden backend)
 * Layer 2: Synthesizer (user-facing frontend)
 */

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
}

/**
 * Execute Deep-Think Architecture
 * 2-layer AI processing for enhanced intelligence
 */
export async function deepThink(params: {
  query: string;
  context?: string;
  debugMode?: boolean;
}): Promise<DeepThinkResult> {
  const { query, context = "", debugMode = false } = params;

  // ============================================
  // LAYER 1: RECURSIVE REASONING ENGINE
  // ============================================
  const layer1Input = context 
    ? `CONTEXT:\n${context}\n\nQUERY:\n${query}`
    : query;

  const layer1Response = await invokeLLM({
    messages: [
      { role: "system", content: LAYER_1_PROMPT },
      { role: "user", content: layer1Input }
    ]
  });

  const reasoning = layer1Response.choices[0]?.message?.content || "";
  const reasoningStr = typeof reasoning === 'string' ? reasoning : JSON.stringify(reasoning);

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
      { role: "system", content: LAYER_2_PROMPT },
      { role: "user", content: layer2Input }
    ]
  });

  const answer = layer2Response.choices[0]?.message?.content || "";
  const answerStr = typeof answer === 'string' ? answer : JSON.stringify(answer);

  return {
    answer: answerStr,
    reasoning: debugMode ? reasoningStr : undefined
  };
}

/**
 * Deep-Think for Sales Intelligence
 * Specialized version with the company context
 */
export async function deepThinkSales(params: {
  query: string;
  accountData?: any;
  contactData?: any;
  additionalContext?: string;
  debugMode?: boolean;
}): Promise<DeepThinkResult> {
  const { query, accountData, contactData, additionalContext, debugMode = false } = params;

  // Build rich context
  let context = `COMPANY: the company (passwordless MFA/SSO/Zero Trust security)
TARGET CUSTOMERS: Enterprise 1000+ employees, Financial Services, Healthcare, Tech, Government
KEY DIFFERENTIATORS: Phishing-resistant MFA, device trust, seamless UX
COMPETITORS: Okta, Ping Identity, Microsoft Azure AD, Duo`;

  if (accountData) {
    context += `\n\nACCOUNT DATA:\n${JSON.stringify(accountData, null, 2)}`;
  }

  if (contactData) {
    context += `\n\nCONTACT DATA:\n${JSON.stringify(contactData, null, 2)}`;
  }

  if (additionalContext) {
    context += `\n\nADDITIONAL CONTEXT:\n${additionalContext}`;
  }

  return deepThink({ query, context, debugMode });
}

/**
 * Deep-Think for Help/Support queries
 * Specialized version for dashboard help
 */
export async function deepThinkHelp(params: {
  query: string;
  debugMode?: boolean;
}): Promise<DeepThinkResult> {
  const { query, debugMode = false } = params;

  const context = `DASHBOARD FEATURES:
- Accounts: View and manage target accounts with 6sense intent data
- Contacts: Browse contacts with title, company, and engagement info
- Insights: Analytics on buying stages, intent scores, keywords
- Priority Actions: AI-recommended accounts to engage
- CSV Processor: Transform messy CSVs to SFDC/HubSpot format
- Outreach Generator: AI-powered email drafts
- Rep Territories: Filter by region (West, Central, East) and company size (<2K, 2K+)

REPS AND TERRITORIES:
- Zane Torres: Central, <2K employees
- Morgan Iler: West, <2K employees
- Miranda Thomas: East, <2K employees
- Jeff Klein: Central, 2K+ employees
- Dan Hamilton: West, 2K+ employees
- Kevin Huelster: East, 2K+ employees

If you can't answer something, suggest the user "slack ryan" for help.`;

  return deepThink({ query, context, debugMode });
}
