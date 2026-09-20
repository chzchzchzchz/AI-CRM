# TargetDash

**An AI account-intelligence layer for B2B sales.**

A sales rep opens this in the morning and sees which accounts moved, why they moved, and what to
do about it — with the evidence for every claim attached. It sits on top of a CRM rather than
replacing one.

`React 19` · `TypeScript` · `tRPC` · `Express` · `Drizzle` · `Vite` — 722 tests, ~54k lines,
runs with zero API keys.

```bash
git clone https://github.com/chzchzchzchz/AI-CRM.git && cd AI-CRM
pnpm install && cp .env.example .env && pnpm dev    # → http://localhost:3333
```

Sign in with `demo@ai-crm.com` / `DemoPass123!`. No database, no keys, no signup.

---

## What's real vs. what's demo

| | Status |
|---|---|
| The app, routing, data model, AI pipeline, MCP server | Real, running, tested |
| Demo dataset | Synthetic — deterministically generated, no real entities |
| 6sense, Gong, Salesforce, Clay, + 20 other connectors | Real HTTP clients against documented APIs, exercised by unit tests with mocked transports. Not verified against live paid accounts — but `pnpm smoke` checks 16 of the 24 for real the moment a key exists, on every run |
| AI features with no key set | Fall back to a local Ollama model; with nothing reachable they say so plainly |
| Auth, 2FA, audit logging, rate limiting | Implemented and tested. Not independently audited |
| Multi-tenancy | Org boundary on every tenant table, enforced by a build check. `SIGNUP_MODE=self-serve` gives each new customer their own workspace, and admins invite colleagues into it from `/admin`. Not yet run with two paying customers |
| Getting your own data in | `/import` takes pasted rows or a CSV/TSV/JSON file straight into your workspace — accounts and contacts from the same paste, no connector needed. The CSV Processor builds a file for import into *Salesforce*, not into this app |
| Connectors under multi-tenancy | A workspace connects its own accounts from `/admin` — stored AES-256-GCM encrypted, never shown again, and used only for that workspace's calls. Falling back to the deployment's own `SALESFORCE_*`/`GONG_*` is allowed only for the workspace that owns them; anyone else is refused and told to connect their own. Needs `CREDENTIALS_KEY`, and refuses to store anything without it |
| Metering and limits | Seats, accounts, contacts and AI calls are counted per workspace and shown in `/admin`. A limit refuses the action that would exceed it, saying the numbers. No limit is set anywhere by default — a guessed cap fires on a real customer for a rule nobody chose |
| Taking money | Not built. No prices, no plans, no payment provider — metering and enforcement are the half that belongs in the product; what a seat costs is yours to decide |

`pnpm doctor` reads your `.env` and tells you which integrations are actually ready, which are
half-configured, and which are set but wrong — a placeholder value, a quoted string, a webhook
URL pointed at the wrong vendor.

---

## The demo dataset

```text
1,000 accounts · 474 with intent data · 10,023 contacts
105 accounts at intent 70+ · 144 at 40–69
113 open opportunities · $21.3M open pipeline
152 calls · 24 RFPs · 2,772 intent-score history points
```

<sub>Counted from `demo-db.seed.json` by `pnpm check:claims`, which fails the build if this block
drifts from the data. It once advertised 16 accounts against 1,000 actual.</sub>

Point it at your own data and the same views render your real book of business — see
[`SETUP.md`](SETUP.md) for the tiers and [`ADMIN_SETUP.md`](ADMIN_SETUP.md) for reps,
territories, branding, and live connectors.

---

## Architecture

TargetDash sits between the rep and the system of record:

```text
┌─────────────────────────────────────────────┐
│   MCP Server — exposes the CRM to any agent │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│   Account Intelligence (server/intel)       │
│   Facts by code · judgement by model        │
│   Each claim validated before it ships      │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│   Signal detection (6sense intent, Gong)    │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│   Next best action, with the named contact  │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│   Salesforce — your source of truth         │
└─────────────────────────────────────────────┘
```

[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) covers repo layout, the app shell and nav model,
design tokens, bundle splits, and how to add a page. [`DESIGN.md`](DESIGN.md) covers the visual
language. [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) covers the local loop and conventions.
[`docs/case-study.html`](docs/case-study.html) is a written walkthrough of the main surfaces, with
full-size captures in [`docs/screenshots/`](docs/screenshots/).

### MCP server

`pnpm mcp` exposes the CRM to any MCP-speaking agent over stdio:

| Tool | What it does |
|---|---|
| `list_accounts` | every account with intent score, buying stage, industry, region, tech stack |
| `get_account` | one account in full, including intent history |
| `search_accounts` | natural language — *"CISOs at fintechs with intent over 80"* |
| `get_workspace_brain` | executive summary of the book: totals, hot accounts, what changed |
| `sync_salesforce` | pull accounts and contacts from Salesforce |

With `DEMO_MODE=true` no credential is needed. Against a real deployment, set
`MCP_SESSION_COOKIE`.

<sub>Every one of these was broken for a long time. Four called tRPC procedures that don't exist,
and two returned *"import initiated"* for an import that was never written. The server started,
listed its tools, and failed on every call — and nothing in the repo called it, so nothing
noticed. `server/mcp.test.ts` now asserts each named procedure exists in the router.</sub>

---

## Running it other ways

```bash
docker compose up          # same demo, no toolchain needed
pnpm verify                # the full gate — see docs/QUALITY-GATE.md
pnpm doctor                # what's configured, what's misconfigured
pnpm mcp                   # MCP server over stdio
```

The AI features run for free: with no cloud key set they fall back to a local Ollama model at
`localhost:11434` ([`SETUP.md`](SETUP.md) has the one-time install). With no model reachable at
all, each feature says plainly that none is configured — a CI flow check asserts exactly that,
because it used to report "Content generated" and hand you the apology as the content.

---

## Security posture

Written down honestly, because a self-hosted app that reads your CRM deserves that.

- No hardcoded secrets; everything via environment or gitignored `config/`
- Parameterized SQL throughout (Drizzle) — no string-built queries
- Email/password auth with session cookies, login lockout, and audit logging
- TOTP 2FA enrolled at `/security` and enforced at login; recovery codes from
  `crypto.randomBytes`, stored bcrypt-hashed, single-use
- `SameSite` negotiated per request (`None; Secure` over HTTPS, `Lax` over plain HTTP)
- A weak or missing `JWT_SECRET` refuses to sign in production
- CORS hardened; rate limiting scoped to `/api` so static assets can't exhaust a real user's budget
- Login lockout, rate limiting and 2FA challenges share one store — per-process by default,
  Redis when `REDIS_URL` is set, so throttling holds across instances instead of being
  N × looser per pod. `pnpm doctor` proves which mode is live with a real round trip
- `pnpm audit` clean, and CI keeps it that way

`DEMO_MODE=true` bypasses authentication by design. Never run it on a public deployment with real
data. See [`SECURITY.md`](SECURITY.md).

---

## Known limitations

- **Connectors are unproven against live paid accounts.** The clients are real and unit-tested
  against mocked transports, but no enterprise 6sense/Gong tenant was available to
  integration-test against. `pnpm smoke` closes the *remembering* half of that: set a key —
  locally or as a CI secret — and that connector is exercised for real on every run from
  then on, so a vendor changing its response shape breaks the build instead of a sync
  quietly returning nothing. It reports how much it can speak for: 16 of 24 connectors are
  checkable at all, 4 of them deeply. The other 8 are webhook-delivered or have no read
  endpoint, and no key will ever verify those from a test harness.
- **Multi-tenancy is new and unproven at scale.** Every tenant table carries an `orgId`,
  `ctx.orgId` comes from the session and never from input, inbound webhooks resolve their
  org from a per-organization credential, and `pnpm check:claims` fails the build if any
  query on a tenant table loses its org filter. With `SIGNUP_MODE=self-serve` each signup
  creates its own organization and its first user is that org's admin; the default
  (`invite-only`) keeps the single-workspace behaviour every existing install has. Two
  customers signing up, inviting colleagues, and staying isolated from each other is
  verified in a browser, not just in tests. It has not run a deployment with two *paying*
  customers — tested and enforced, not battle-worn.
- **No payment provider, and no prices.** Usage is metered per workspace and limits are
  enforced when set, but nothing charges anybody: there are no plans, no prices and no
  Stripe. Selling still means invoicing out of band, or wiring a provider to the meter
  that now exists. Limits default to unset — every deployment behaves exactly as it did
  until an operator chooses a number.
- **Connector coverage is per workspace now, but only Salesforce is threaded through.**
  A workspace stores its own credentials and calls run in that scope, with no fallback to
  the deployment's environment for a field it left blank. Salesforce reads through it;
  the remaining connectors still read the environment directly and so remain refused to
  any workspace but the deployment's own until they are converted the same way.
- **Rep territories are still per deployment.** `shared/territories.ts` is one roster for
  the whole instance. Company identity is now per workspace (set it in `/admin`), so a
  second workspace no longer writes as the deployment owner's company — but the AE list
  and their territories are still shared, and a workspace that has set no identity writes
  as "Your company" rather than inheriting anyone's.
- **The AI quality depends entirely on the model you point it at.** The grounding work constrains
  what a model can claim; it can't make a weak local model insightful.
- **No accessibility audit.** The design targets WCAG 2.1 AA and the gate checks contrast and
  overflow, but nobody has tested it with a screen reader.

---

## License & contact

MIT — see [LICENSE](LICENSE). Use any part of it.

Questions, bugs, or suggestions: [mohssinechazi@gmail.com](mailto:mohssinechazi@gmail.com) or open
an [issue](https://github.com/chzchzchzchz/AI-CRM/issues).
