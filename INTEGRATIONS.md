# External Service Integrations

Every endpoint below is a **real tRPC procedure** in this codebase. Base URL in dev is
`http://localhost:3333`. Endpoints are `POST /api/trpc/<router>.<procedure>` (mutations) or
`GET` (queries). See also [ADMIN_SETUP.md](ADMIN_SETUP.md).

## Clay — enrichment

**Inbound (Clay → app), the primary flow.** Configure an HTTP API column in your Clay table to POST
enriched rows here; secured by `CLAY_WEBHOOK_SECRET` (fails closed outside demo mode):

- `POST /api/trpc/clay.receiveAccount` — enriched accounts
- `POST /api/trpc/clay.receiveContact` — enriched contacts

```bash
curl -X POST 'http://localhost:3333/api/trpc/clay.receiveAccount?batch=1' \
  -H 'content-type: application/json' \
  -d '{"0":{"json":{"webhook_secret":"<secret>","clayId":"rec_123","name":"Acme Corp",
       "domain":"acme.com","industry":"Technology","employees":"500",
       "stack":"{\"cloud\":[\"AWS\"]}","trigger":"Hired new CISO"}}}'
```

**Outbound (app → Clay).** Trigger enrichment by pushing a domain to your Clay table webhook
(`CLAY_WEBHOOK_URL`): `POST /api/trpc/clayPull.triggerEnrichment` `{ domain, name? }`.

## 6sense — intent scores

- `POST /api/trpc/intentScores.create` `{ accountId, score (0-100), category?, keywords?[], source? }`
- `GET  /api/trpc/intentScores.list?input={"accountId":1}`

Bulk historical metrics (buying stage, keywords, 6QA) load via
`npx tsx scripts/import-6sense-data.ts` (edit the arrays with your export).

## Gong — calls

- `POST /api/trpc/calls.create` `{ title, accountId?, contactId?, duration?, gongCallId?, sentiment?, keyTopics?[], actionItems?[], callDate? }`
- `GET  /api/trpc/calls.list`

## SAM.gov — government RFPs

- `POST /api/trpc/rfps.create` `{ title, agency?, solicitationNumber?, responseDeadline?, awardAmount?, url?, status? }`
- `POST /api/trpc/rfps.scrape` — scrape SAM.gov for the configured keywords
- `GET  /api/trpc/rfps.list`

## Zapier — automation webhook

- `POST /api/trpc/zapier.webhook` `{ event, data? }` — secured by `ZAPIER_WEBHOOK_SECRET` (fails closed
  outside demo mode). Use it to fan out CRM events into any Zap.

## AI (built-in LLM — free via local Ollama, or a cloud key)

- `POST /api/trpc/ai.generateAccountResearch` `{ accountId }`
- `POST /api/trpc/ai.generateOutreachRecommendation` `{ accountId, contactId, recentActivity? }`
- Also: `ai.generateEmail`, `ai.enrichAccount`, `ai.analyzeCall`, `ai.chat`, `ai.search`.

## Salesforce — see [ADMIN_SETUP.md §5.1] (OAuth sync: `salesforce.testConnection` / `fullSync`).

## Environment variables

```bash
CLAY_WEBHOOK_SECRET=...     # verify inbound Clay webhooks (required in prod)
CLAY_WEBHOOK_URL=...        # outbound enrichment trigger (optional)
SIXSENSE_API_KEY=...        # 6sense enrichment (optional)
GONG_API_KEY=...            # reserved for live Gong pull (roadmap)
SAM_GOV_API_KEY=...         # SAM.gov RFP scraping (optional)
ZAPIER_WEBHOOK_SECRET=...   # verify inbound Zapier events (required in prod if used)
OPENAI_API_KEY=...          # optional; AI also runs free on local Ollama
```

All sources flow into the same `accounts` + `contacts` tables, keyed by cross-platform IDs
(`sfdcAccountId`, `clayRecordId`, …) for unified tracking.
