# TargetDash — Plug-n-Play Setup

Three tiers, each works with **zero paid API keys**. A brand-new user can run the whole thing on
demo data with free local AI.

> **Admin?** Once it runs, see **[ADMIN_SETUP.md](ADMIN_SETUP.md)** for making it yours —
> branding, reps, territory assignment, accounts, and live Salesforce/6sense/Clay/Gong integrations.

## 1. Run it (zero config, demo data)
```bash
pnpm install
DEMO_MODE=true pnpm dev
```
Open http://localhost:3333 — boots with 1,000 demo accounts, 10,023 contacts, $21.3M of open pipeline. No
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

## Check your setup — `pnpm doctor`

Before trusting a deployment, run:

```bash
pnpm doctor
```

It reads your `.env` and prints one line per integration: **ready**, **half
configured** (naming exactly which variable is still missing), **set but
wrong**, or **off**. It exits non-zero only for things that will actually break
the app, so it is safe to run in CI or a deploy step.

It is built to catch the failures that are otherwise silent — a key that is
present but wrong looks identical to a key that is right until a sync quietly
returns nothing hours later:

- a placeholder someone forgot to replace
- a value pasted with surrounding quotes, or trailing whitespace
- a Discord webhook URL sitting in the Slack slot
- a token with the wrong vendor prefix (`sk-…` where HubSpot wants `pat-…`)
- a Pipedrive domain pasted as a full URL instead of the bare subdomain
- a phone number that isn't E.164
- a truncated key
- `DEMO_MODE=false` with no `DATABASE_URL`
- a weak or missing `JWT_SECRET` (which silently logs everyone out on restart)

The same diagnosis appears in-app on the **Integrations** page, so whoever is
doing the setup sees the reason next to the connector rather than a grey dot.

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
