# TargetDash

**An AI account-intelligence layer for B2B sales.**

A sales rep opens this in the morning and sees which accounts moved, why they moved, and what to
do about it — with the evidence for every claim attached. It sits on top of a CRM rather than
replacing one.

`React 19` · `TypeScript` · `tRPC` · `Express` · `Drizzle` · `Vite` — 452 tests, ~54k lines,
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
| 6sense, Gong, Salesforce, Clay, + 20 other connectors | Real HTTP clients against documented APIs, exercised by unit tests with mocked transports. Not verified against live paid accounts |
| AI features with no key set | Fall back to a local Ollama model; with nothing reachable they say so plainly |
| Auth, 2FA, audit logging, rate limiting | Implemented and tested. Not independently audited |
| Multi-tenancy, billing, onboarding | Not built. Not pretending to be |

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
- `pnpm audit` clean, and CI keeps it that way

`DEMO_MODE=true` bypasses authentication by design. Never run it on a public deployment with real
data. See [`SECURITY.md`](SECURITY.md).

---

## Known limitations

- **Connectors are unproven against live paid accounts.** The clients are real and unit-tested
  against mocked transports, but no enterprise 6sense/Gong tenant was available to
  integration-test against.
- **Single-tenant.** There's no org isolation, so it's one deployment per team.
- **The AI quality depends entirely on the model you point it at.** The grounding work constrains
  what a model can claim; it can't make a weak local model insightful.
- **No accessibility audit.** The design targets WCAG 2.1 AA and the gate checks contrast and
  overflow, but nobody has tested it with a screen reader.

---

## License & contact

MIT — see [LICENSE](LICENSE). Use any part of it.

Questions, bugs, or suggestions: [mohssinechazi@gmail.com](mailto:mohssinechazi@gmail.com) or open
an [issue](https://github.com/chzchzchzchz/AI-CRM/issues).
