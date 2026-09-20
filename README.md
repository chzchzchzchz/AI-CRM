# TargetDash

[![CI](https://github.com/chzchzchzchz/AI-CRM/actions/workflows/ci.yml/badge.svg)](https://github.com/chzchzchzchz/AI-CRM/actions/workflows/ci.yml)

**An AI account-intelligence layer for B2B sales.**

A sales rep opens this in the morning and sees which accounts moved, why they moved, and what to
do about it — with the evidence for every claim attached. It sits on top of a CRM rather than
replacing one.

`React 19` · `TypeScript` · `tRPC` · `Express` · `Drizzle` · `Vite` — 479 tests, ~55k lines,
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

## How it works

The unit of work is an **account brief**: why this account matters today, what to do about it,
and the evidence for both. It's built in three passes, and the split between them is the design.

**1 · Signals — code only, no model.** `server/intel/signals.ts` reads every stored data point
for one account and folds it into a single `SignalPack`:

| | |
|---|---|
| Intent | current score, the full reading history, direction of travel, and the largest single jump between consecutive readings — a spike is the buying signal |
| Stakeholders | every contact bucketed by seniority inferred from job title, plus departments and who has a reachable email |
| Conversations | call count, days since the last one, sentiment, topics, and still-open action items |
| Pipeline | open / won / lost, total value, and `amount × probability` summed for the forecast figure |
| Technology | tech stack and security stack |

Every number here is computed in code, so it's arithmetically true by construction, and nothing
downstream recalculates it.

**2 · Judgement — the model, constrained to a schema.** The pack goes to the model, which has to
return structure rather than prose: `whyNow[]`, `actions[]`, `risks[]`, each item carrying an
`evidence` string naming the specific `section.field` it came from. Prose is easy to make
plausible; a citation to `intent.largestJump` either matches the pack or it doesn't.

**3 · Validation — checked against the pack before anyone sees it.** `validateJudgement` builds
the set of names the pack can support, the currency figures it can support, and the legitimate
values for every field an evidence string may cite — then rejects anything outside them. A model
that invents a contact, a number, or a citation doesn't get to ship it.

Briefs are keyed by a hash of the *material* signals rather than a timestamp, so an account that
hasn't moved reuses its brief instead of paying to regenerate it. With no model reachable at all,
each surface says so rather than presenting an empty brief as a finished one.

---

## How this was built

A personal project, written largely by AI coding agents — Manus early on, Claude Code since —
under my direction. `git log --format='%an' | sort | uniq -c` shows the split.

The verification is the part I'd point at. `pnpm check:claims` asserts this README against the
code and the seed data and fails the build when a figure drifts; `pnpm gate` walks every route in
a real browser at desktop and mobile; `pnpm flows` clicks through the app rather than only
loading it. [`docs/QUALITY-GATE.md`](docs/QUALITY-GATE.md) has the detail.

---

## The demo dataset

```text
1,000 accounts · 474 with intent data · 10,023 contacts
105 accounts at intent 70+ · 144 at 40–69
113 open opportunities · $21.3M open pipeline
152 calls · 24 RFPs · 2,772 intent-score history points
```

<sub>Counted from `demo-db.seed.json` by `pnpm check:claims`, which fails the build if this block
drifts from the data.</sub>

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

<sub>`server/mcp.test.ts` asserts every tool above resolves to a procedure that exists in the
router, so a renamed procedure breaks the build rather than the agent.</sub>

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
all, each feature says plainly that none is configured rather than presenting the outage note as
output — a CI flow check asserts exactly that.

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
