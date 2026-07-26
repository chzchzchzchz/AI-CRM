/**
 * The integration registry — one declarative description of every connector,
 * what it needs, and how to tell whether what you supplied is plausible.
 *
 * This exists because the failure mode we cannot afford is a *silent* one: a
 * key that is present but wrong looks exactly like a key that is right, until
 * a sync quietly returns nothing hours later. Every rule below turns one of
 * those silent failures into a specific sentence at setup time.
 *
 * Rules are deliberately conservative. They reject things that are definitely
 * wrong (a placeholder, a pasted quote, a Slack URL pointing at Discord) and
 * stay quiet about anything merely unusual — a false "your key is broken" is
 * worse than no check at all.
 */

export type EnvSpec = {
  name: string;
  /** Optional vars still get format-checked when present. */
  required?: boolean;
  /** Human answer to "where do I get this?" */
  hint: string;
  /** Must match if set. */
  pattern?: RegExp;
  /** Explains the pattern in words when it fails. */
  expected?: string;
  /** Minimum sane length, for opaque tokens with no fixed shape. */
  minLength?: number;
  /** Treated as "not really set". Compared case-insensitively. */
  placeholders?: string[];
  secret?: boolean;
};

export type ConnectorSpec = {
  key: string;
  name: string;
  category: "data" | "crm" | "engagement" | "alerts" | "automation";
  /** What the app can do once this is configured. */
  capability: string;
  docs: string;
  env: EnvSpec[];
  /**
   * Some connectors accept alternative credential sets (e.g. password OR PKI).
   * Each inner array is one sufficient combination of env var names.
   */
  anyOf?: string[][];
};

/** Values people leave behind from a copied template. */
const COMMON_PLACEHOLDERS = [
  "changeme",
  "change-this",
  "your-key-here",
  "your_api_key",
  "xxx",
  "todo",
  "replace-me",
];

export const CONNECTORS: ConnectorSpec[] = [
  // ---- Data sources -------------------------------------------------------
  {
    key: "sixsense",
    name: "6sense",
    category: "data",
    capability: "Pull buying stage, intent score and firmographics per account",
    docs: "https://api-docs.6sense.com/",
    env: [
      {
        name: "SIXSENSE_API_KEY",
        required: true,
        hint: "6sense app → Settings → API Tokens",
        minLength: 16,
        secret: true,
      },
    ],
  },
  {
    key: "zoominfo",
    name: "ZoomInfo",
    category: "data",
    capability: "Enrich companies, discover and enrich contacts",
    docs: "https://api-docs.zoominfo.com/",
    env: [
      { name: "ZOOMINFO_USERNAME", hint: "Your ZoomInfo API username", required: true },
      { name: "ZOOMINFO_PASSWORD", hint: "Password auth (simplest)", secret: true },
      { name: "ZOOMINFO_CLIENT_ID", hint: "PKI auth: client id" },
      { name: "ZOOMINFO_PRIVATE_KEY", hint: "PKI auth: private key", secret: true },
    ],
    anyOf: [
      ["ZOOMINFO_USERNAME", "ZOOMINFO_PASSWORD"],
      ["ZOOMINFO_USERNAME", "ZOOMINFO_CLIENT_ID", "ZOOMINFO_PRIVATE_KEY"],
    ],
  },
  {
    key: "apollo",
    name: "Apollo.io",
    category: "data",
    capability: "Enrich a person by email",
    docs: "https://docs.apollo.io/",
    env: [{ name: "APOLLO_API_KEY", required: true, hint: "Apollo → Settings → API", minLength: 16, secret: true }],
  },
  {
    key: "clay",
    name: "Clay",
    category: "data",
    capability: "Receive enriched rows from a Clay table, and push rows back",
    docs: "https://www.clay.com/university",
    env: [
      {
        name: "CLAY_WEBHOOK_SECRET",
        required: true,
        hint: "A secret you invent; Clay sends it back so we can trust the payload",
        minLength: 12,
        secret: true,
      },
      {
        name: "CLAY_WEBHOOK_URL",
        hint: "Clay table → Add webhook → copy the URL (only needed to push out)",
        pattern: /^https:\/\/.+/i,
        expected: "an https:// URL from your Clay table",
      },
    ],
  },
  {
    key: "salesforce",
    name: "Salesforce",
    category: "crm",
    capability: "Two-way account and contact sync",
    docs: "https://developer.salesforce.com/docs/apis",
    env: [
      { name: "SALESFORCE_CLIENT_ID", required: true, hint: "Connected App → Consumer Key" },
      { name: "SALESFORCE_CLIENT_SECRET", required: true, hint: "Connected App → Consumer Secret", secret: true },
      {
        name: "SALESFORCE_INSTANCE_URL",
        required: true,
        hint: "e.g. https://yourorg.my.salesforce.com",
        pattern: /^https:\/\/[^\s]+\.(salesforce|force)\.com\/?$/i,
        expected: "https://<yourorg>.my.salesforce.com",
      },
    ],
  },
  {
    key: "gong",
    name: "Gong",
    category: "data",
    capability: "Pull call recordings and transcripts",
    docs: "https://gong.app.gong.io/settings/api",
    env: [{ name: "GONG_API_KEY", required: true, hint: "Gong → Settings → API", minLength: 16, secret: true }],
  },

  // ---- CRM / workspace ----------------------------------------------------
  {
    key: "hubspot",
    name: "HubSpot",
    category: "crm",
    capability: "Create and update contacts",
    docs: "https://developers.hubspot.com/docs/api/private-apps",
    env: [
      {
        name: "HUBSPOT_ACCESS_TOKEN",
        required: true,
        hint: "Private app token (starts with pat-)",
        pattern: /^pat-/i,
        expected: "a private-app token beginning with 'pat-'",
        secret: true,
      },
    ],
  },
  {
    key: "notion",
    name: "Notion",
    category: "crm",
    capability: "Export accounts into a database",
    docs: "https://developers.notion.com/",
    env: [
      {
        name: "NOTION_TOKEN",
        required: true,
        hint: "Internal integration secret (starts with secret_ or ntn_)",
        pattern: /^(secret_|ntn_)/i,
        expected: "a token beginning with 'secret_' or 'ntn_'",
        secret: true,
      },
      { name: "NOTION_DATABASE_ID", required: true, hint: "The 32-char id in your database URL", minLength: 30 },
    ],
  },
  {
    key: "linear",
    name: "Linear",
    category: "crm",
    capability: "Create follow-up issues",
    docs: "https://developers.linear.app/",
    env: [
      {
        name: "LINEAR_API_KEY",
        required: true,
        hint: "Linear → Settings → API (starts with lin_api_)",
        pattern: /^lin_api_/i,
        expected: "a key beginning with 'lin_api_'",
        secret: true,
      },
      { name: "LINEAR_TEAM_ID", required: true, hint: "Team settings → the team's UUID" },
    ],
  },
  {
    key: "airtable",
    name: "Airtable",
    category: "crm",
    capability: "Create records in a base",
    docs: "https://airtable.com/developers/web/api/introduction",
    env: [
      {
        name: "AIRTABLE_TOKEN",
        required: true,
        hint: "Personal access token (starts with pat)",
        pattern: /^pat/i,
        expected: "a personal access token beginning with 'pat'",
        secret: true,
      },
      {
        name: "AIRTABLE_BASE_ID",
        required: true,
        hint: "Base id from the API docs URL (starts with app)",
        pattern: /^app/i,
        expected: "a base id beginning with 'app'",
      },
      { name: "AIRTABLE_TABLE", required: true, hint: "The table name, exactly as shown in Airtable" },
    ],
  },
  {
    key: "pipedrive",
    name: "Pipedrive",
    category: "crm",
    capability: "Create deals",
    docs: "https://developers.pipedrive.com/",
    env: [
      { name: "PIPEDRIVE_API_TOKEN", required: true, hint: "Personal preferences → API", secret: true },
      {
        name: "PIPEDRIVE_DOMAIN",
        required: true,
        hint: "Just the subdomain, e.g. 'acme' for acme.pipedrive.com",
        pattern: /^[a-z0-9-]+$/i,
        expected: "the bare subdomain, without https:// or .pipedrive.com",
      },
    ],
  },
  {
    key: "intercom",
    name: "Intercom",
    category: "crm",
    capability: "Sync leads",
    docs: "https://developers.intercom.com/",
    env: [{ name: "INTERCOM_ACCESS_TOKEN", required: true, hint: "Developer Hub → your app → Access token", secret: true }],
  },

  // ---- Engagement ---------------------------------------------------------
  {
    key: "salesloft",
    name: "Salesloft",
    category: "engagement",
    capability: "Create people in cadences",
    docs: "https://developers.salesloft.com/",
    env: [{ name: "SALESLOFT_API_KEY", required: true, hint: "Salesloft → Settings → API keys", secret: true }],
  },
  {
    key: "outreach",
    name: "Outreach",
    category: "engagement",
    capability: "Create prospects",
    docs: "https://developers.outreach.io/",
    env: [{ name: "OUTREACH_ACCESS_TOKEN", required: true, hint: "OAuth access token", secret: true }],
  },
  {
    key: "calendly",
    name: "Calendly",
    category: "engagement",
    capability: "Connect the scheduling account",
    docs: "https://developer.calendly.com/",
    env: [{ name: "CALENDLY_API_KEY", required: true, hint: "Calendly → Integrations → API", secret: true }],
  },

  // ---- Alerts -------------------------------------------------------------
  {
    key: "slack",
    name: "Slack",
    category: "alerts",
    capability: "Post hot-lead alerts to a channel",
    docs: "https://api.slack.com/messaging/webhooks",
    env: [
      {
        name: "SLACK_WEBHOOK_URL",
        required: true,
        hint: "Slack app → Incoming Webhooks → Add New Webhook",
        pattern: /^https:\/\/hooks\.slack\.com\/services\//i,
        expected: "https://hooks.slack.com/services/...",
        secret: true,
      },
    ],
  },
  {
    key: "discord",
    name: "Discord",
    category: "alerts",
    capability: "Post alerts to a channel",
    docs: "https://support.discord.com/hc/en-us/articles/228383668",
    env: [
      {
        name: "DISCORD_WEBHOOK_URL",
        required: true,
        hint: "Channel → Edit → Integrations → Webhooks",
        pattern: /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//i,
        expected: "https://discord.com/api/webhooks/...",
        secret: true,
      },
    ],
  },
  {
    key: "teams",
    name: "Microsoft Teams",
    category: "alerts",
    capability: "Post a card to a channel",
    docs: "https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/",
    env: [
      {
        name: "TEAMS_WEBHOOK_URL",
        required: true,
        hint: "Channel → Connectors → Incoming Webhook",
        pattern: /^https:\/\/.+/i,
        expected: "an https:// webhook URL",
        secret: true,
      },
    ],
  },
  {
    key: "googleChat",
    name: "Google Chat",
    category: "alerts",
    capability: "Post to a space",
    docs: "https://developers.google.com/chat/how-tos/webhooks",
    env: [
      {
        name: "GOOGLE_CHAT_WEBHOOK_URL",
        required: true,
        hint: "Space → Apps & integrations → Webhooks",
        pattern: /^https:\/\/chat\.googleapis\.com\//i,
        expected: "https://chat.googleapis.com/...",
        secret: true,
      },
    ],
  },
  {
    key: "twilio",
    name: "Twilio",
    category: "alerts",
    capability: "Send SMS alerts",
    docs: "https://www.twilio.com/docs/iam/api-keys",
    env: [
      {
        name: "TWILIO_ACCOUNT_SID",
        required: true,
        hint: "Console dashboard (starts with AC)",
        pattern: /^AC[0-9a-f]{32}$/i,
        expected: "an Account SID: 'AC' followed by 32 hex characters",
      },
      { name: "TWILIO_AUTH_TOKEN", required: true, hint: "Console dashboard → Auth Token", secret: true },
      {
        name: "TWILIO_FROM_NUMBER",
        required: true,
        hint: "A Twilio number in E.164 form, e.g. +14155551234",
        pattern: /^\+[1-9]\d{6,14}$/,
        expected: "E.164 format, e.g. +14155551234",
      },
    ],
  },
  {
    key: "pagerduty",
    name: "PagerDuty",
    category: "alerts",
    capability: "Trigger alerts",
    docs: "https://developer.pagerduty.com/docs/events-api-v2/",
    env: [{ name: "PAGERDUTY_ROUTING_KEY", required: true, hint: "Service → Integrations → Events API v2", secret: true }],
  },
  {
    key: "segment",
    name: "Segment",
    category: "automation",
    capability: "Track analytics events",
    docs: "https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/",
    env: [{ name: "SEGMENT_WRITE_KEY", required: true, hint: "Source → Settings → API Keys", secret: true }],
  },

  // ---- Task tools ---------------------------------------------------------
  {
    key: "asana",
    name: "Asana",
    category: "automation",
    capability: "Create follow-up tasks",
    docs: "https://developers.asana.com/",
    env: [
      { name: "ASANA_ACCESS_TOKEN", required: true, hint: "My Settings → Apps → Personal access token", secret: true },
      { name: "ASANA_WORKSPACE_ID", required: true, hint: "The numeric workspace gid", pattern: /^\d+$/, expected: "a numeric workspace id" },
    ],
  },
  {
    key: "clickup",
    name: "ClickUp",
    category: "automation",
    capability: "Create tasks in a list",
    docs: "https://clickup.com/api",
    env: [
      { name: "CLICKUP_API_TOKEN", required: true, hint: "Settings → Apps → API token", secret: true },
      { name: "CLICKUP_LIST_ID", required: true, hint: "The numeric list id from the list URL", pattern: /^\d+$/, expected: "a numeric list id" },
    ],
  },
];

export { COMMON_PLACEHOLDERS };
