# TargetDash — Admin Setup & Customization Guide

Everything an admin needs to make TargetDash **yours**: branding, reps, territories, accounts, and
live integrations (Salesforce, 6sense, Clay, Gong). It's plug-n-play — the app runs on demo data
with zero config, and you turn on each piece independently as you need it.

> New here? Run the demo first ([SETUP.md](SETUP.md)), then come back to customize.

---

## 0. How configuration works (the mental model)

There are three config surfaces. You only touch the ones you need.

| Surface | File / vars | Drives |
|---|---|---|
| **Server config** | `config/company-config.json` (or `COMPANY_*` / `PRODUCT_NAME` / `SUPPORT_CONTACT` env) | AI persona, product name in emails/2FA, support contact, rep roster for AI context |
| **Client branding** | `VITE_APP_TITLE`, `VITE_APP_LOGO`, `VITE_SUPPORT_CONTACT` env (build-time) | Browser tab, header logo, help-bot text |
| **Rep roster (UI)** | `client/src/contexts/RepContext.tsx` → `REP_TERRITORIES` | Territory dropdown + filtering in the app |

Resolution order for server config: `config/company-config.json` → `COMPANY_*` env vars → built-in
demo defaults. **It always runs** — nothing here is required.

```bash
cp config/company-config.json.example config/company-config.json
# edit it, then restart the server
```

---

## 1. Branding — make it look like your product

**Server-side** (`config/company-config.json`): `productName` is used in transactional emails,
2FA issuer, and access-approval pages.
```json
{ "productName": "Acme Signal", "supportContact": "#sales-help on Slack" }
```

**Client-side** (build-time env, e.g. in `.env`):
```bash
VITE_APP_TITLE="Acme Signal"          # browser tab + header
VITE_APP_LOGO="/logo.svg"             # replace client/public/logo.svg with your mark
VITE_SUPPORT_CONTACT="#sales-help"    # what the in-app help bot tells users
```
The AI help bot's fallback ("if I can't help, reach out to …") reads `supportContact` server-side and
`VITE_SUPPORT_CONTACT` client-side — set both to the same value.

---

## 2. Company & AI persona

The AI (account briefs, strategic insights, outreach, call analysis) is driven entirely by
`config/company-config.json`. No prompt editing required.

```json
{
  "companyName": "Acme Signal",
  "industry": "Revenue Intelligence",
  "productDescription": "AI pipeline intelligence for B2B sales teams",
  "keyDifferentiators": ["Real-time intent", "Zero manual entry", "Native AI"],
  "competitors": "Clari, Gong, 6sense",
  "targetCustomers": "Enterprise 1000+ employees"
}
```
`competitors` and `keyDifferentiators` are injected into the "Revenue Architect" persona so the AI
positions against *your* competitors with *your* value props. (Verified: every prompt path resolves
these — no `{COMPANY_NAME}` placeholders leak to the model.)

---

## 3. Reps & territory assignment (the split)

Territory routing is a **2-axis grid**: `region` × `company size`.

- **Regions:** `Central`, `West`, `East`, `Intl`
- **Size segments:** `commercial` (< 2,000 employees) and `enterprise` (≥ 2,000 employees)
- The threshold lives in `server/repAssignment.ts` (`>= 2000`).

**Define your reps** in `config/company-config.json`:
```json
"reps": [
  { "name": "Alex Rivera",   "email": "alex.rivera@acme.com",   "region": "Central", "sizeSegment": "commercial" },
  { "name": "Jordan Bailey", "email": "jordan.bailey@acme.com", "region": "West",    "sizeSegment": "commercial" },
  { "name": "Taylor Brooks", "email": "taylor.brooks@acme.com", "region": "Central", "sizeSegment": "enterprise" }
]
```

**Wire the in-app territory dropdown** by editing `REP_TERRITORIES` in
`client/src/contexts/RepContext.tsx` (the email is just an opaque key; filtering is by
`region` + `sizeFilter`):
```ts
export const REP_TERRITORIES = {
  "alex.rivera@acme.com":   { name: "Alex Rivera",   region: "Central", sizeFilter: "<2000",  label: "Central <2K" },
  "taylor.brooks@acme.com": { name: "Taylor Brooks", region: "Central", sizeFilter: ">=2000", label: "Central 2K+" },
} as const;
```
The dropdown, the TopAccounts view, and per-rep filtering all derive from this single object. An
account's `region` field + `employeeCount` decide which rep it routes to.

---

## 4. Customizing accounts & data

Five ways to get accounts/contacts in, from lowest to highest effort:

| Method | When | How |
|---|---|---|
| **Demo seed** | Portfolio / eval | Edit `scripts/seed-demo.mjs`, run `node scripts/seed-demo.mjs` (writes `demo-db.seed.json` + runtime `demo-db.json`) |
| **Clay webhook** | Continuous enrichment | Push enriched rows from Clay → §5.3 |
| **Salesforce sync** | Existing CRM | OAuth + `salesforce.fullSync` → §5.1 |
| **6sense** | Intent signals | `SIXSENSE_API_KEY` → §5.2 |
| **CSV import** | One-off bulk | `npx tsx scripts/import-6sense-data.ts` |

For real (persistent, multi-user) data instead of the JSON demo DB:
```bash
DATABASE_URL="mysql://user:pass@host/db"   # MySQL
DEMO_MODE=false
pnpm db:push                                # apply the Drizzle schema
```

---

## 5. Integrations — step by step (each is independent & optional)

### 5.1 Salesforce (account/contact sync) — **fully implemented**
Uses the OAuth **client-credentials** flow, then SOQL → transform → bulk upsert.

1. In Salesforce: **Setup → App Manager → New Connected App**. Enable OAuth, enable
   *Client Credentials Flow*, assign a run-as user with read access to Accounts/Contacts.
2. Set env:
   ```bash
   SALESFORCE_CLIENT_ID="<consumer key>"
   SALESFORCE_CLIENT_SECRET="<consumer secret>"
   SALESFORCE_INSTANCE_URL="https://yourorg.my.salesforce.com"
   ```
3. Verify + sync (tRPC procedures, admin-only):
   - `salesforce.testConnection` → `{ connected: true, accountCount, contactCount }`
   - `salesforce.fullSync` → syncs accounts then contacts (links contacts to accounts)

Without creds, `testConnection` returns a clear, non-crashing message telling you exactly which
env vars to set (verified).

### 5.2 6sense (intent signals) — implemented
```bash
SIXSENSE_API_KEY="<key>"        # or legacy 6Sense_API
```
Enriches accounts with intent score, buying stage, and segments (`server/sixsense.ts`).

### 5.3 Clay (enrichment) — **inbound webhook, verified live**
Clay pushes enriched rows to TargetDash via its **HTTP API / webhook** action. Two endpoints:
- `POST /api/trpc/clay.receiveAccount` — enriched accounts
- `POST /api/trpc/clay.receiveContact` — enriched contacts

Secure it with a shared secret (recommended):
```bash
CLAY_WEBHOOK_SECRET="<random-long-string>"
```
In your Clay table, add an **HTTP API** column pointing at the endpoint, including
`webhook_secret` in the body. Payloads upsert by `clayId` (or `domain`/`email`) — re-sending the
same record **updates in place, never duplicates** (verified).

Verify it yourself (server running in demo mode; omit the secret if `CLAY_WEBHOOK_SECRET` is unset):
```bash
curl -s -X POST 'http://localhost:3333/api/trpc/clay.receiveAccount?batch=1' \
  -H 'content-type: application/json' \
  -d '{"0":{"json":{"name":"Quantum Dynamics","domain":"quantum-dynamics.io",
       "industry":"Quantum Computing","employees":"850","region":"West",
       "intentScore":"88","clayId":"clay_rec_001"}}}'
# → [{"result":{"data":{"json":{"success":true,"action":"created"}}}}]
```

### 5.4 Gong (call intelligence) — data-in-DB, not a live pull
Gong calls live in the `calls` table and power call analysis, action-item extraction, and priority
actions (`server/ai.ts → analyzeGongCall`). Calls are loaded via import/Clay/seed today; a **live
Gong API pull is on the roadmap** (not yet implemented). `GONG_API_KEY` is reserved in config for it.

---

## 5.5 Deploy — one command (Docker)

Self-host the whole thing in one command (verified: image builds, container serves the demo + Clay webhook):
```bash
docker compose up                    # zero-config demo at http://localhost:3333
docker compose --profile full up     # app + persistent MySQL (set DEMO_MODE=false)
```
Or without compose:
```bash
docker build -t targetdash .
docker run -p 3333:3333 targetdash                       # demo
docker run -p 3333:3333 -e DEMO_MODE=false \
  -e DATABASE_URL="mysql://user:pass@host/db" targetdash # real data
```
Pass any integration env var (§5.1–5.4) with `-e` or in `docker-compose.yml`.

---

## 6. Auth & multi-user

Demo mode auto-logs-in a demo admin (no login screen). For real multi-user:
```bash
DEMO_MODE=false
JWT_SECRET="<rotate-this-random-secret>"     # signs session cookies
```
Built-in email/password + 2FA + email-verification is wired (Login/SignUp/2FA pages + audit logs).
New signups land in an admin approval queue (`admin-approval-api.ts`).

---

## 7. Verification checklist (what "working" means)

| Check | Command | Expected |
|---|---|---|
| App boots | `pnpm dev` | UI at :3333, 16 demo accounts |
| Types clean | `npx tsc --noEmit` | 0 errors |
| Tests green | `npm test` | 76 passed, 1 skipped |
| Clay ingest | curl in §5.3 | `success: true, action: created` |
| Clay idempotent | re-POST same `clayId` | `action: updated`, no duplicate row |
| Salesforce path | `salesforce.testConnection` | clear connected/not-configured result |

All six were run and pass on the current build.
