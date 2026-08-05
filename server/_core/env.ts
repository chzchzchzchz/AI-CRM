export const ENV = {
  /**
   * Identifies this app inside a session token.
   *
   * This defaulted to "". Every session this app minted therefore carried appId: "",
   * and verifySession rejects a payload whose appId is not a non-empty string — so
   * every session token this app issued failed its own verification, always.
   *
   * Nothing looked broken because DEMO_MODE falls back to a demo admin user when
   * verification returns null. Sign-in appeared to work; it was the fallback working.
   * With DEMO_MODE=false a user would sign in, receive a cookie, and be signed out on
   * the next request, forever, with only a console warning to show for it.
   *
   * VITE_APP_ID still wins when set (it is the Manus OAuth app id). The default is
   * just a stable string so sign and verify agree in the ordinary case.
   */
  appId: process.env.VITE_APP_ID || "targetdash",
  cookieSecret: process.env.JWT_SECRET ?? "",
  // Database URLs - automatically switches based on DEMO_MODE flag
  demoMode: process.env.DEMO_MODE === "true",
  databaseUrl: process.env.DEMO_MODE === "true" 
    ? (process.env.DATABASE_URL_DEMO ?? process.env.DATABASE_URL ?? "")
    : (process.env.DATABASE_URL ?? ""),
  databaseUrlProduction: process.env.DATABASE_URL ?? "",
  databaseUrlDemo: process.env.DATABASE_URL_DEMO ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  // Free, no-key LLM fallback — local Ollama (OpenAI-compatible). Used automatically
  // when no Forge/cloud key is set, so the AI features work with zero paid keys.
  localLlmUrl: process.env.LOCAL_LLM_URL ?? "http://localhost:11434/v1",
  localLlmModel: process.env.LOCAL_LLM_MODEL ?? "phi3:mini",
  // OpenRouter (openrouter.ai) — fast hosted LLMs, incl. free models. Highest priority
  // when set. Free models are rate-limited upstream; add your own credits/key for reliability.
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  // Comma-separated fallback list — free models are rate-limited upstream and rotate,
  // so we try them in order and fall through on 429/unavailable. Set to a single paid
  // model (e.g. openai/gpt-4o-mini) for reliable speed on your own key.
  openrouterModel: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-nano-12b-v2-vl:free,google/gemma-4-26b-a4b-it:free,meta-llama/llama-3.3-70b-instruct:free",
  sixSenseApiKey: process.env.SIXSENSE_API_KEY ?? process.env['6Sense_API'] ?? "",
  clayWebhookUrl: process.env.CLAY_WEBHOOK_URL ?? "",
  // Salesforce OAuth credentials
  salesforceClientId: process.env.SALESFORCE_CLIENT_ID ?? "",
  salesforceClientSecret: process.env.SALESFORCE_CLIENT_SECRET ?? "",
  salesforceInstanceUrl: process.env.SALESFORCE_INSTANCE_URL ?? "https://login.salesforce.com",
};
