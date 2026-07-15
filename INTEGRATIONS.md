# Native Integrations

TargetDash ships **real, native connectors** to the tools B2B sales teams use. Every
connector is a thin, real HTTP client against the vendor's documented API
(`server/integrations/connectors.ts`), exposed over tRPC under `integrations.*`, and
**feature-flagged by env** — if a key/URL isn't set the connector reports
`{ ok:false, skipped:true }` instead of throwing, so the app runs without any of them.

`integrations.status` returns which connectors are configured.

## Connectors

| Tool | tRPC endpoint | What it does | Config (env) |
|---|---|---|---|
| **Slack** | `integrations.slackNotify` | Post a message (e.g. "🔥 hot lead") via Incoming Webhook | `SLACK_WEBHOOK_URL` |
| **Discord** | `integrations.discordNotify` | Post to a channel webhook | `DISCORD_WEBHOOK_URL` |
| **Microsoft Teams** | `integrations.teamsNotify` | Post a MessageCard via Incoming Webhook | `TEAMS_WEBHOOK_URL` |
| **HubSpot** | `integrations.hubspotSyncContact` | Create/update a contact (CRM v3) | `HUBSPOT_ACCESS_TOKEN` |
| **Notion** | `integrations.notionExportAccount` | Add an account as a page in a database | `NOTION_TOKEN`, `NOTION_DATABASE_ID` |
| **Linear** | `integrations.linearCreateTask` | Create an issue (GraphQL) | `LINEAR_API_KEY`, `LINEAR_TEAM_ID` |
| **Intercom** | `integrations.intercomSyncContact` | Create/update a lead | `INTERCOM_ACCESS_TOKEN` |
| **Airtable** | `integrations.airtableCreateRecord` | Create a record in a table | `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE` |
| **Pipedrive** | `integrations.pipedriveCreateDeal` | Create a deal | `PIPEDRIVE_API_TOKEN`, `PIPEDRIVE_DOMAIN` |
| **Apollo.io** | `integrations.apolloEnrichPerson` | Enrich a person by email | `APOLLO_API_KEY` |
| **Zapier / Make / n8n** | `integrations.sendWebhook` (out) · `zapier.webhook` (in) | Any HTTP endpoint, both directions | `ZAPIER_WEBHOOK_SECRET` (inbound) |
| **Clay** | `clay.receiveAccount` / `clay.receiveContact` (in) · `clayPull.triggerEnrichment` (out) | Enrichment in/out | `CLAY_WEBHOOK_SECRET`, `CLAY_WEBHOOK_URL` |
| **6sense** | `intentScores.create` / `.list` | Store intent scores per account | `SIXSENSE_API_KEY` |
| **Salesforce** | `salesforce.testConnection` / `.fullSync` | Account/contact OAuth sync | `SALESFORCE_CLIENT_ID/SECRET/INSTANCE_URL` |
| **Gong** | `calls.create` / `calls.list` | Store & surface call intelligence | `GONG_API_KEY` |

## Proof (verified live)

The outbound connectors make **real HTTP calls**. Verified end-to-end by pointing
`integrations.slackNotify` and `integrations.sendWebhook` at a live request-capture
endpoint and confirming the payloads were delivered:

```bash
curl -X POST 'http://localhost:3333/api/trpc/integrations.slackNotify?batch=1' \
  -H 'content-type: application/json' \
  -d '{"0":{"json":{"text":"🔥 Hot lead: Vertex Cloud Systems (intent 95)","webhookUrl":"https://<your-webhook>"}}}'
# → {"ok":true,"status":200}   — the message arrives at the endpoint (Slack channel).

curl -X POST 'http://localhost:3333/api/trpc/integrations.sendWebhook?batch=1' \
  -H 'content-type: application/json' \
  -d '{"0":{"json":{"url":"https://<your-webhook>","payload":{"event":"account.hot","account":"Vertex Cloud Systems","intentScore":95}}}}'
# → {"ok":true,"status":200}
```

For Slack/Discord/Teams you paste an Incoming Webhook URL (no OAuth). For
HubSpot/Notion/Linear/Intercom you paste a private-app token / API key. Set them in
`.env` (see `.env.example`) or pass a `webhookUrl` per call.

## Wiring an automation

Typical flow: TargetDash detects a hot lead → `integrations.slackNotify` pings your
`#sales` channel and `integrations.sendWebhook` fires a Zap that creates a task in your
PM tool. Inbound: Clay/Zapier POST enrichment back to `clay.receiveAccount` /
`zapier.webhook` (both secret-verified, fail-closed in production).
