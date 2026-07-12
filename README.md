# 🎯 TargetDash - AI-Powered Prospect Relationship Layer for Salesforce

[![CI](https://github.com/chzchzchzchz/AI-CRM/actions/workflows/ci.yml/badge.svg)](https://github.com/chzchzchzchz/AI-CRM/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/chzchzchzchz/AI-CRM?style=social)](https://github.com/chzchzchzchz/AI-CRM)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-online-blue)](https://targetdash-pwcs8qfq.manus.space)

---

## 🧠 The Story

I was at an enterprise B2B company building their sales stack. We had 14,000+ contacts, 6sense, Gong, Clay, Salesforce — the whole enterprise nightmare.

**The problem:** Salesforce is dumb. It's a glorified spreadsheet that needs humans to type stuff. Your reps hate it. Your data is stale. Your AI is bolted on as an afterthought.

**The realization:** Reps don't need a new CRM. They need a **prospect relationship layer** that sits on top of Salesforce and actually makes it useful:

- **Captures signals automatically** (6sense intent, Gong calls, Clay enrichment — no manual entry)
- **Uses AI at every layer** (not just a chatbot sidebar)
- **Has zero manual data entry** (contacts enrich themselves)
- **Gives you the "Next Best Action"** in plain English

So I built **TargetDash** — the AI-powered layer that makes Salesforce actually work for your reps.

---

## 🚀 What It Does

**TargetDash sits on top of Salesforce** to give your reps AI-powered prospect intelligence:

| Feature | Salesforce Alone | Salesforce + TargetDash |
|---------|-----------------|---------------------------|
| **AI Architecture** | Bolt-on (Einstein) | Native layer (every touchpoint) |
| **Data Entry** | Manual / Reps hate it | Zero (auto-capture from 6sense, Gong, Clay) |
| **Signal Detection** | Basic lead scoring | Multi-channel AI (intent, calls, engagement) |
| **Next Best Action** | None (you figure it out) | AI-generated ("Email Vertex Cloud VP re: renewal risk") |
| **MCP Server** | ❌ | ✅ (plug into ANY AI agent) |
| **Setup Time** | Months + consultants | 5 minutes (see below) |

---

## 📊 What You Get (Demo Dataset)

Spin it up with `pnpm dev` and the seeded demo dataset looks like this out of the box:

```
📈 16 accounts tracked (scores to thousands with real data)
🔥 13 hot leads (intent 70+)
🌡️ 3 warm leads
📇 40 contacts, 8 open opportunities
🎯 Top accounts ranked by VECTOR score, e.g. Vertex Cloud Systems (95), Pinnacle Software (93)
```

Point it at your own 6sense/Gong/Clay/Salesforce data and it scales to your real book of business.

---

## 🛠️ Quick Start

### Run the demo — zero config, ~2 minutes
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
(Or skip the copy and run `DEMO_MODE=true pnpm dev` — it just picks the first free port from 3000.)
The AI features (account briefs, outreach, chat) work for free too — they fall back to a local
Ollama model when no cloud key is set. See [SETUP.md](SETUP.md) for the one-time Ollama step.

### Use it for YOUR company
TargetDash is **generic** — it works for any B2B company once you point it at your data.

1. **Configure your company** (drives the AI prompts):
   ```bash
   cp config/company-config.json.example config/company-config.json
   ```
   Edit it with your name, product, differentiators, and competitors. Skip it and the app falls back
   to `COMPANY_*` env vars (see `.env.example`), then to generic defaults — it always runs.
2. **Point at a real database** (optional — demo mode needs none):
   ```bash
   cp .env.example .env          # set DATABASE_URL and DEMO_MODE=false
   pnpm db:push                  # run migrations
   pnpm dev
   ```
3. **Load your data** (optional):
   ```bash
   npx tsx scripts/import-6sense-data.ts   # import 6sense intent data
   node scripts/seed-demo.mjs              # or (re)generate the synthetic demo dataset
   ```

Integration keys (6sense, Gong, Clay, Salesforce) are all optional and independent — full matrix in
[SETUP.md](SETUP.md). Admins configuring reps, territories, branding, and live integrations:
see **[ADMIN_SETUP.md](ADMIN_SETUP.md)**.

---

## 🏗️ Architecture - AI Layer on Top of Salesforce

TargetDash **sits between your reps and Salesforce**, adding AI intelligence to every touchpoint:

```
┌─────────────────────────────────────────────┐
│           MCP Server (Model Context)        │
│  Exposes CRM data to ANY AI agent         │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         Deep-Think AI Engine               │
│  Layer 1: Recursive Reasoning (hidden)    │
│  Layer 2: Synthesizer (user-facing)       │
│  Cached responses for identical queries    │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│      Signal Detection (6sense, Gong)       │
│  - Intent scoring                         │
│  - Buying stage tracking                  │
│  - Engagement heatmaps                    │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│    Next Best Action Engine                 │
│  "Email VP re: renewal risk"               │
│  "Call CISO - intent spiking"              │
└─────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────┐
│         Salesforce (your source of truth)    │
└─────────────────────────────────────────────┘
```

### MCP Server - Plug Into ANY AI
TargetDash includes an **MCP (Model Context Protocol) server** — meaning ANY AI agent (Claude, GPT, etc.) can query your Salesforce data in real-time:

```typescript
// Your AI agent can now do:
"Show me hot leads with >90 intent"
"Draft an email to the VP of Engineering at our top account"
"What's our 6QA gap this week?"
```

---

## 🎯 Key Features

### 🔥 Priority Actions - "What Do I Do Today?"
AI analyzes your whole book of accounts and tells you:
- **Why Now** (intent spike? buying stage change?)
- **Next Best Action** (specific email/cal sequence)
- **Contact to target** (decision-maker + role)

### 🧲 Vector Scoring - Find Hidden Gems
Uses AI embeddings to score accounts by:
- Intent signals (6sense)
- Engagement (Gong calls + email)
- Fit (employees, industry, tech stack)
- **VECTOR score** = single number for prioritization

### 📧 AI-Generated Outreach
- Personalized emails using account insights
- Multiple sequences (Ping integration, cold outreach, etc.)
- Auto-A/B testing subject lines

### 📊 6sense Integration
- Buying stage tracking
- Keyword performance
- 6QA (6sense Qualified Accounts) gap analysis
- Real-time intent data

### 🎙️ Gong Call Intelligence
- Auto-transcribes sales calls
- Extracts action items
- Surfaces objection patterns
- Recommends follow-up actions

---



## 🔐 Security & Compliance

- ✅ **No hardcoded secrets** (all in config/environment)
- ✅ **Parameterized SQL** (Drizzle ORM, no injection vectors)
- ✅ **Email/password + 2FA auth**, session cookies, audit logging (bypassed only when `DEMO_MODE=true`)
- ✅ **CORS hardened**
- ✅ **XSS protected** (React sanitizes by default)
- ⚠️ Audit logs and role-based access are in place as a foundation — not a certified SOC 2 posture

---

## 🚦 Roadmap

- [x] **Phase 1: Core CRM** (accounts, contacts, signals) ✅
- [x] **Phase 2: AI integration** (OpenAI, Deep-Think engine) ✅
- [x] **Phase 3: MCP server** (AI agent integration) ✅
- [ ] **Phase 4: Multi-channel capture** (email, Slack, LinkedIn, Zoom)
- [ ] **Phase 5: Multi-tenant SaaS** (self-serve onboarding)
- [ ] **Phase 6: Open-source core** (community + enterprise tiers)


---

## 🤝 Contributing

This is an **open-core** project:
- **Core CRM**: MIT license (free forever)
- **Enterprise features**: Commercial license
- **Integrations**: Open-source (6sense, Gong, Clay, etc.)

PRs welcome! Especially:
- New integrations (HubSpot, ZoomInfo, etc.)
- MCP server improvements
- Mobile app (React Native)

---

## 📫 Contact

**Ryan Chazi**  
- 📧 mohssinechazi@gmail.com  
- 💼 [LinkedIn](https://linkedin.com/in/ryan-chazi)  
- 🐙 [GitHub](https://github.com/chzchzchzchz)  



---

## ⭐ Star History

If this helped you, star it! It helps others find the future of CRM.

[![Star History Chart](https://api.star-history.com/svg?repos=chzchzchzchz/AI-CRM&type=Date)](https://star-history.com/#chzchzchzchz/AI-CRM&Date)

---

## 📄 License

MIT License — free for personal & commercial use.

---

### 🎤 LinkedIn Post (Copy-Paste This)

> Just open-sourced the AI-powered prospect relationship layer I built for Salesforce reps. 🚀
> 
> After seeing the pain of managing enterprise sales data (14K contacts, stale data, reps hating Salesforce), I built **TargetDash**:
> 
> ✅ Zero manual entry (AI captures everything from 6sense, Gong, Clay)
> ✅ MCP server (any AI agent can query your Salesforce data)
> ✅ Next Best Action (AI tells you what to do today)
> ✅ Multi-channel signal detection (intent, calls, engagement)
> 
> Layer it on top of Salesforce in 5 minutes: https://github.com/chzchzchzchz/AI-CRM
> 
> #Salesforce #AI #SalesReps #OpenSource
> 
> #Salesforce #AI #SalesReps #OpenSource

---

**Now go star it. Fork it. Build the future.** ⭐
