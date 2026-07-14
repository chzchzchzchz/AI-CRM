# External Service Integrations

How to connect external services to TargetDash. Every endpoint below is a **real,
implemented tRPC procedure** — verify with `curl` against a running server (default
port **3333**). All integrations are optional; see [ADMIN_SETUP.md](ADMIN_SETUP.md)
for keys and the plug-n-play walkthrough.

> tRPC calling convention used in the curl examples:
> `POST /api/trpc/<procedure>?batch=1` with body `{"0":{"json":{ ...input }}}`.

## Clay (enrichment)

**Inbound (push) — Clay → TargetDash.** Configure an HTTP API column in your Clay
table to POST enriched rows here. Secured by `CLAY_WEBHOOK_SECRET` (fails closed
outside demo mode).

- `POST /api/trpc/clay.receiveAccount` — upsert an account (by `clayId`/`domain`)
- `POST /api/trpc/clay.receiveContact` — upsert a contact (by `clayId`/`email`)
- `POST /api/trpc/clayWebhook.receive` — flexible passthrough (auto-categorises fields)

```bash
curl -X POST 'http://localhost:3333/api/trpc/clay.receiveAccount?batch=1' \
  -H 'Content-Type: application/json' \
  -d '{"0":{"json":{"webhook_secret":"<secret>","name":"Acme Corp","domain":"acme.com",
       "industry":"Technology","employees":"500","intentScore":"82","clayId":"rec_123"}}}'
# → {"success":true,"action":"created"}
```

**Outbound (pull) — TargetDash → Clay.** Trigger enrichment by pushing a row to your
Clay table's webhook (`CLAY_WEBHOOK_URL`):

- `POST /api/trpc/clayPull.triggerEnrichment` — `{ domain, name? }`

## 6sense (intent)

Store intent scores per account (from a 6sense export or API):

- `POST /api/trpc/intentScores.create` — `{ accountId, score, category?, keywords?[], source? }`
- `GET  /api/trpc/intentScores.list` — `{ accountId }`
- Bulk import buying-stage / keyword / 6QA metrics: `npx tsx scripts/import-6sense-data.ts`
  (edit the example arrays with your export first)

```bash
curl -X POST 'http://localhost:3333/api/trpc/intentScores.create?batch=1' \
  -H 'Content-Type: application/json' \
  -d '{"0":{"json":{"accountId":1,"score":85,"category":"Security","keywords":["Zero Trust"],"source":"6sense"}}}'
# → {"success":true}
```

## Gong (calls)

Store call intelligence:

- `POST /api/trpc/calls.create` — `{ accountId?, contactId?, title, duration?, gongCallId?,
  sentiment?, keyTopics?[], actionItems?[], callDate? }`
- `GET  /api/trpc/calls.list`, `calls.getByAccountId`

## SAM.gov (government RFPs)

Track open RFPs matching your product's keywords (`RFP_KEYWORDS`, comma-separated):

- `POST /api/trpc/rfps.create` — manually add an RFP
- `POST /api/trpc/rfps.scrape` — pull from SAM.gov (`SAM_GOV_API_KEY`)
- `GET  /api/trpc/rfps.list`, `rfps.stats`

## Zapier (automation)

Receive automation events (secured by `ZAPIER_WEBHOOK_SECRET`, fails closed outside demo mode):

- `POST /api/trpc/zapier.webhook` — `{ event, data?, webhook_secret? }`

```bash
curl -X POST 'http://localhost:3333/api/trpc/zapier.webhook?batch=1' \
  -H 'Content-Type: application/json' \
  -d '{"0":{"json":{"event":"account.enriched","data":{"accountId":1}}}}'
# → {"received":true,"event":"account.enriched"}
```

## AI (research & outreach)

Built-in, powered by the local/cloud LLM helper (see SETUP.md — free via Ollama):

- `POST /api/trpc/ai.generateAccountResearch` — `{ accountId }`
- `POST /api/trpc/ai.generateOutreachRecommendation` — `{ accountId, contactId, recentActivity? }`
- Also: `ai.enrichAccount`, `ai.generateEmail`, `ai.analyzeCall`, `ai.chat`, `ai.search`

## Environment variables

See [.env.example](.env.example) for the full list. Relevant here:
`CLAY_WEBHOOK_SECRET`, `CLAY_WEBHOOK_URL`, `SIXSENSE_API_KEY`, `GONG_API_KEY`,
`SAM_GOV_API_KEY`, `RFP_KEYWORDS`, `ZAPIER_WEBHOOK_SECRET`.
