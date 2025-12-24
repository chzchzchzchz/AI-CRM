export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
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
  sixSenseApiKey: process.env.SIXSENSE_API_KEY ?? process.env['6Sense_API'] ?? "",
  clayWebhookUrl: process.env.CLAY_WEBHOOK_URL ?? "",
};
