# 🎯 TargetDash - AI-Native CRM That Replaces Salesforce

[![GitHub stars](https://img.shields.io/github/stars/chzchzchzchz/AI-CRM?style=social)](https://github.com/chzchzchzchz/AI-CRM)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-targetdash.com-blue)](https://targetdash-pwcs8qfq.manus.space)

---

## 🧠 The Story

I was at **the company** building their sales stack. We had 14,000+ contacts, 6sense, Gong, Clay, Salesforce — the whole enterprise nightmare. 

**The problem:** Salesforce is dumb. It's a glorified spreadsheet that needs humans to type stuff. Your reps hate it. Your data is stale. Your AI is bolted on as an afterthought.

**The realization:** If you're building AI-first sales, you don't need Salesforce. You need a system that:
- **Captures signals from everywhere** (email, Slack, LinkedIn, Zoom) automatically
- **Uses AI at every layer** (not just a chatbot sidebar)
- **Has zero manual data entry** (contacts enrich themselves)
- **Gives you the "Next Best Action"** in plain English

So I built **TargetDash** — the AI-Native CRM that replaces Salesforce.

---

## 🚀 What It Does

| Feature | Salesforce | TargetDash |
|---------|-------------|-------------|
| **AI Architecture** | Bolt-on (Einstein) | Native (every layer) |
| **Data Entry** | Manual / Reps hate it | Zero (auto-capture) |
| **Signal Detection** | Basic lead scoring | Multi-channel AI (6sense, Gong, Clay) |
| **Next Best Action** | None (you figure it out) | AI-generated ("Email Cisco VP re: security risks") |
| **MCP Server** | ❌ | ✅ (plug into ANY AI agent) |
| **Setup Time** | Months + consultants | 5 minutes (see below) |

---

## 📊 Real Results (From the company Deployment)

```
📈 2,103 accounts tracked
🔥 437 hot leads (intent 70+)
🌡️ 1,389 warm leads  
⚡ 567 unworked 6QA opportunities (85% gap = revenue on table)
🎯 Top accounts: Cisco (98 intent), Verizon (97), McKesson (97)
```

---

## 🛠️ Quick Start - Use It For YOUR Company

TargetDash is **generic** — works for any B2B company. Just configure:

### 1. Clone & Install
```bash
git clone https://github.com/chzchzchzchz/AI-CRM.git
cd AI-CRM
pnpm install
```

### 2. Configure Your Company
Edit `config/company-config.json`:
```json
{
  "companyName": "Your Company",
  "companyDescription": "Your AI product description",
  "industry": "B2B SaaS",
  "productDescription": "What you sell",
  "keyDifferentiators": ["AI-first", "Zero manual entry"],
  "targetCustomers": "Enterprise 1000+ employees",
  "competitors": "Salesforce, HubSpot",
  "apiKeys": {
    "sixsense": "your_key",
    "gong": "your_key",
    "openai": "your_key"
  },
  "demoMode": false
}
```

### 3. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your:
# - DATABASE_URL (MySQL/PostgreSQL)
# - OPENAI_API_KEY
# - SIXSENSE_API_KEY (optional)
# - GONG_API_KEY (optional)
```

### 4. Run Migrations & Start
```bash
pnpm db:push
pnpm dev
```

### 5. Import Your Data
```bash
# Import 6sense data
node scripts/import-6sense-data.mjs

# Or load demo data
node scripts/seed-demo.mjs
```

**That's it. You now have an AI-Native CRM for your company.**

---

## 🏗️ Architecture - Why This Is Better

### AI at Every Layer (Not Just a Chatbot)

```
┌─────────────────────────────────────────────┐
│           MCP Server (Model Context)        │
│  Exposes CRM data to ANY AI agent         │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Deep-Think AI Engine                │
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
│  "Email Cisco VP re: security risks"      │
│  "Call Verizon CISO - intent spiking"     │
└─────────────────────────────────────────────┘
```

### MCP Server - Plug Into ANY AI
TargetDash includes an **MCP (Model Context Protocol) server** — meaning ANY AI agent (Claude, GPT, etc.) can query your CRM data in real-time:

```typescript
// Your AI agent can now do:
"Show me hot leads at Cisco with >90 intent"
"Draft an email to the VP of Engineering at Verizon"
"What's our 6QA gap this week?"
```

---

## 🎯 Key Features

### 🔥 Priority Actions - "What Do I Do Today?"
AI analyzes 2,000+ accounts and tells you:
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
- ✅ **Parameterized SQL** (no injection vectors)
- ✅ **Auth middleware** on all API routes
- ✅ **CORS hardened**
- ✅ **XSS protected** (React sanitizes by default)
- ✅ **Ready for SOC 2** (audit logs, role-based access)

---

## 🚦 Roadmap

- [x] **Phase 1: Core CRM** (accounts, contacts, signals) ✅
- [x] **Phase 2: AI integration** (OpenAI, Deep-Think engine) ✅
- [x] **Phase 3: Multi-channel capture** (email, Slack, LinkedIn, Zoom) ✅
- [x] **Phase 4: MCP server** (AI agent integration) ✅
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

> Just open-sourced the AI-Native CRM I built to replace Salesforce. 🚀
> 
> After seeing the pain at the company (14K contacts, stale data, reps hating Salesforce), I built **TargetDash**:
> 
> ✅ Zero manual entry (AI captures everything)
> ✅ MCP server (any AI agent can query your CRM)
> ✅ Next Best Action (AI tells you what to do today)
> ✅ 6sense + Gong + Clay integrated
> 
> Replace Salesforce in 5 minutes: https://github.com/chzchzchzchz/AI-CRM
> 

> 
> #SalesforceKiller #AI #CRM #OpenSource

---

**Now go star it. Fork it. Build the future.** ⭐
