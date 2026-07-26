# TargetDash 

The daily revenue command centre for Salesforce.

See who’s hot, what changed overnight, and the next best action for every account; powered by live signals from Gong, 6sense, Clay, and Salesforce. It sits on top of your CRM, not in place of it.


---

## The Story

I was at an enterprise B2B company building their sales stack. We had 14,000+ contacts, 6sense, Gong, Clay, and Salesforce in a highly complex enterprise environment.

**The challenge:** The sheer volume of modern sales data is simply too much for one person to handle. When critical information is scattered across multiple platforms, it creates cognitive overload, requires constant manual syncing, and makes it difficult for reps to access the insights they need when they need them.

**The solution:** Reps don't need a replacement CRM. They need a **seamless routing layer** that unites all these various information points into one single moment. TargetDash sits on top of Salesforce and acts as an intelligent bridge:

* **Captures signals automatically** (6sense intent, Gong calls, Clay enrichment, reducing manual workload)
* **Integrates AI natively** (working seamlessly at every layer)
* **Reduces data entry friction** (contacts enrich themselves in the background)
* **Generates the "Next Best Action"** in plain English

So I built **TargetDash**, the AI-powered layer that organizes the noise and helps Salesforce work smoothly for your reps.

---

## What It Does

**TargetDash sits on top of Salesforce** to give your reps AI-powered prospect intelligence without replacing your core system of record:

| Feature | Standard CRM | CRM + TargetDash |
| --- | --- | --- |
| **AI Architecture** | Standalone additions | Native layer (every touchpoint) |
| **Data Entry** | Manual input required | Automated capture (from 6sense, Gong, Clay) |
| **Signal Detection** | Basic lead scoring | Multi-channel AI (intent, calls, engagement) |
| **Next Best Action** | Requires manual synthesis | AI-generated ("Email Vertex Cloud VP re: renewal risk") |
| **MCP Server** | ❌ | ✅ (plug into ANY AI agent) |
| **Setup Time** | Extended implementation | 5 minutes (see below) |

---

## What You Get (Demo Dataset)

Spin it up with `pnpm dev` and the seeded demo dataset looks like this out of the box:

```text
📈 16 accounts tracked (scales seamlessly with real data)
🔥 13 highly active leads (intent 70+)
🌡️ 3 developing leads
📇 40 contacts, 8 open opportunities
🎯 Top accounts ranked by VECTOR score, e.g. Vertex Cloud Systems (95), Pinnacle Software (93)

```

Point it at your own 6sense/Gong/Clay/Salesforce data and it routes your real book of business into one clear dashboard.

---

## Quick Start

### Run the demo (zero config, ~2 minutes)

No database, no API keys. Boots with a synthetic dataset (16 accounts, 40 contacts, $1.02M pipeline).

```bash
git clone https://github.com/chzchzchzchz/AI-CRM.git
cd AI-CRM
pnpm install
cp .env.example .env           # ships with DEMO_MODE=true and PORT=3333
pnpm dev                       # → http://localhost:3333

```

Prefer Docker? One command, no toolchain needed:

```bash
docker compose up              # → http://localhost:3333

```

Want it live on a public URL? One click, no local setup (deploys the demo; add your keys in the dashboard for real data):

[](https://render.com/deploy?repo=https://github.com/chzchzchzchz/AI-CRM)
(Or skip the copy and run `DEMO_MODE=true pnpm dev`, which just picks the first free port from 3000.)
The AI features (account briefs, outreach, chat) work for free too, as they fall back to a local Ollama model when no cloud key is set. See [SETUP.md](https://www.google.com/search?q=SETUP.md) for the one-time Ollama step.

### Use it for YOUR company

TargetDash is **generic**, acting as a routing layer for any B2B company once you connect your data.

1. **Configure your company** (drives the AI context):
```bash
cp config/company-config.json.example config/company-config.json

```


Edit it with your name, product, differentiators, and competitors. Skip it and the app falls back to `COMPANY_*` env vars (see `.env.example`), then to generic defaults, ensuring it always runs.
2. **Point at a real database** (optional, demo mode needs none):
```bash
cp .env.example .env          # set DATABASE_URL and DEMO_MODE=false
pnpm db:push                  # create the tables from the schema (drizzle-kit push)
pnpm dev

```


3. **Load your data** (optional):
```bash
npx tsx scripts/import-6sense-data.ts   # import 6sense intent data
node scripts/seed-demo.mjs              # or (re)generate the synthetic demo dataset

```



Integration keys (6sense, Gong, Clay, Salesforce) are all optional and independent. See the full matrix in [SETUP.md](https://www.google.com/search?q=SETUP.md). Admins configuring reps, territories, branding, and live integrations can refer to **[ADMIN_SETUP.md](https://www.google.com/search?q=ADMIN_SETUP.md)**.

---

## Architecture - A Seamless Routing Layer

TargetDash **sits exactly between your reps and Salesforce**, bringing scattered intelligence into one focused view:

```text
┌─────────────────────────────────────────────┐
│             MCP Server (Model Context)      │
│  Exposes CRM data to ANY AI agent           │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│          Deep-Think AI Engine               │
│  Layer 1: Recursive Reasoning (hidden)      │
│  Layer 2: Synthesizer (user-facing)         │
│  Cached responses for identical queries     │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│      Signal Detection (6sense, Gong)        │
│  - Intent scoring                           │
│  - Buying stage tracking                    │
│  - Engagement heatmaps                      │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│    Next Best Action Engine                  │
│  "Email VP re: renewal risk"                │
│  "Call CISO - intent spiking"               │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│          Salesforce (your source of truth)  │
└─────────────────────────────────────────────┘

```

### MCP Server - Plug Into ANY AI

TargetDash includes an **MCP (Model Context Protocol) server**, meaning ANY AI agent (Claude, GPT, etc.) can securely query your Salesforce data in real-time to help carry the load:

```typescript
// Your AI agent can now assist with:
"Show me highly active leads with >90 intent"
"Draft an email to the VP of Engineering at our top account"
"What's our 6QA gap this week?"

```

---

> **Setting it up?** Run `pnpm doctor` — it reads your `.env` and tells you
> exactly which integrations are ready, which are half configured, and which
> are set but wrong (a placeholder, a quoted value, a webhook URL pointed at
> the wrong vendor). It catches the mistakes that otherwise fail silently.

> **Working on the code?** [`docs/ARCHITECTURE.md`](https://www.google.com/search?q=docs/ARCHITECTURE.md) covers repo layout, the app shell and nav model, the design-system tokens, the bundle splits, and how to add a page. [`DESIGN.md`](https://www.google.com/search?q=DESIGN.md) covers the visual language.

---

## Key Features

### Priority Actions - "What Needs Attention Today?"

AI analyzes your whole book of accounts and helps you prioritize:

* **Why Now** (intent spike? buying stage change?)
* **Suggested Action** (specific email/cal sequence)
* **Recommended Contact** (decision-maker + role)

### Vector Scoring - Surface Hidden Opportunities

Uses AI embeddings to score accounts by synthesizing multiple data points:

* Intent signals (6sense)
* Engagement (Gong calls + email)
* Fit (employees, industry, tech stack)
* **VECTOR score** = single unified metric for easier prioritization

### 📧ssisted Outreach

* Personalized email drafts using account insights
* Multiple sequences (Ping integration, cold outreach, etc.)
* Auto-A/B testing subject lines

### 6sense Integration

* Buying stage tracking
* Keyword performance
* 6QA (6sense Qualified Accounts) gap analysis
* Real-time intent data seamlessly routed

### Gong Call Intelligence

* Auto-transcribes sales calls
* Extracts action items so nothing falls through the cracks
* Surfaces objection patterns
* Recommends follow-up actions

---

## Security & Compliance

* ✅ **No hardcoded secrets** (all in config/environment)
* ✅ **Parameterized SQL** (Drizzle ORM, no injection vectors)
* ✅ **Email/password + 2FA auth**, session cookies, audit logging (bypassed only when `DEMO_MODE=true`)
* ✅ **CORS hardened**; rate limiting scoped to `/api` so static assets can't exhaust a legitimate user's budget
* ✅ **Session cookies negotiate `SameSite` per request**: `None; Secure` over HTTPS, `Lax` over plain HTTP (an invalid pairing is silently dropped by browsers)
* ✅ **Weak/missing `JWT_SECRET` refuses to sign** in production
* ✅ **XSS protected** (React sanitizes by default)
* ✅ **Zero known dependency advisories** since `pnpm audit` is clean and CI keeps it that way
* ⚠️ Audit logs and role-based access are in place as a foundation and not as a certified SOC 2 posture

---

## Roadmap

* [x] **Phase 1: Core Routing** (accounts, contacts, signals) ✅
* [x] **Phase 2: AI integration** (OpenAI, Deep-Think engine) ✅
* [x] **Phase 3: MCP server** (AI agent integration) ✅
* [ ] **Phase 4: Multi-channel capture** (email, Slack, LinkedIn, Zoom)
* [ ] **Phase 5: Multi-tenant SaaS** (self-serve onboarding)
* [ ] **Phase 6: Open-source core** (community + enterprise tiers)

---

## Contributing

This is an **open-core** project:

* **Core Routing**: MIT license (free forever)
* **Enterprise features**: Commercial license
* **Integrations**: Open-source (6sense, Gong, Clay, etc.)

PRs welcome! Especially:

* New integrations (HubSpot, ZoomInfo, etc.)
* MCP server improvements
* Mobile app (React Native)

---

## Contact

Questions, bugs, or feature requests? Open a [GitHub issue](https://github.com/chzchzchzchz/AI-CRM/issues).

---

## License

MIT License, free for personal & commercial use. See [LICENSE](https://www.google.com/search?q=LICENSE).
