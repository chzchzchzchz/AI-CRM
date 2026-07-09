# TargetDash — Plug-n-Play Setup

Three tiers, each works with **zero paid API keys**. A brand-new user can run the whole thing on
demo data with free local AI.

## 1. Run it (zero config, demo data)
```bash
pnpm install            # or: npm install
DEMO_MODE=true npm run dev
```
Open http://localhost:3333 — boots with 16 demo accounts, 40 contacts, a $1.02M pipeline. No
database, no Salesforce, no keys required (DEMO_MODE reads `demo-db.json`).

## 2. Free AI with NO API keys (local LLM)
The AI features (account briefs, strategic insights, outreach generation, chat) automatically fall
back to a **local Ollama model** when no cloud key is set — so they work for free.

```bash
brew install ollama           # if not already installed
ollama serve &                # start the local LLM server
ollama pull phi3:mini         # ~2GB, fast; the default model
```
That's it — the AI now generates locally. Configure via env if you want a better/faster model:
```bash
LOCAL_LLM_MODEL=qwen3:8b      # higher quality, slower
LOCAL_LLM_URL=http://localhost:11434/v1
```
How it works: `server/_core/llm.ts → resolveProvider()` picks **Forge cloud key if present, else
local Ollama**. Strict `json_schema` is auto-downgraded to `json_object` for small local models.

## 3. (Optional) Best-quality cloud AI
Set a hosted gateway key and the app uses it instead of Ollama automatically:
```bash
BUILT_IN_FORGE_API_KEY=...    # Manus Forge gateway (gemini-2.5-flash)
```

## (Optional) Live integrations — for real data instead of demo
Each is independent; the app runs fine without any of them (demo mode).
| Integration | Env var(s) | Used for |
|---|---|---|
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET`, `SALESFORCE_INSTANCE_URL` | account/contact sync |
| 6sense | `SIXSENSE_API_KEY` | intent signals |
| Clay | `CLAY_WEBHOOK_URL` | contact enrichment |
| Real DB | `DATABASE_URL` + `DEMO_MODE=false` | persistent multi-user data |
| Auth (multi-user) | `OAUTH_SERVER_URL`, `JWT_SECRET` | real login (demo bypasses) |

## What's verified working (local, demo mode)
- 7 core pages render with rich data: Dashboard, Accounts, Account Detail, Opportunities,
  Contacts, Insights, Outreach.
- AI Account Brief generates locally via Ollama (no keys).
- 2 React crash bugs fixed (Rules-of-Hooks in `Home.tsx`, `AccountDetail.tsx`).
- Branding logo fixed (`client/public/logo.svg`).
