# TargetDash — State of the Project & Ship-Ready Plan
_Audit date: 2026-07-07 (analysis only, no changes made)_

## What this project is

**TargetDash** — an AI-powered "prospect relationship layer" that sits on top of Salesforce.
It ingests signals from 6sense (intent), Gong (calls), Clay (enrichment) and Salesforce CSV
exports, scores accounts (VECTOR multi-dimensional scoring), and gives reps Priority Actions,
AI account briefs, and AI-generated outreach emails. It also exposes the CRM to any AI agent
via an MCP server.

**Stack:** React 18 + Vite + Tailwind 4 + Radix/shadcn, tRPC 11, Express, Drizzle ORM +
MySQL (with a JSON-file demo mode), Vitest. ~515 TS/TSX files, 36 DB tables, 33 client pages,
a 2-layer "Deep-Think" LLM pipeline with response caching, RAG knowledge base, CSV processor,
data-validation system, rep/territory assignment, 2FA + email-verification auth, audit logs.

**History (reconstructed from todo.md, PRD, git log):**
1. Built as an internal sales tool at a previous employer (an identity-security vendor),
   loaded with their real Salesforce/6sense/Gong data (~765 accounts, ~4,000 contacts, 549 calls).
2. Originally built on the Manus platform (Manus OAuth, Manus Forge LLM gateway).
3. Then pivoted to a generic, open-core B2B product ("TargetDash") — `tasks/prd-perfect-repo.md`
   is the cleanup PRD, and git history shows that effort mid-flight (junk dirs removed,
   filter-repo run for PII, package.json reconstructed dep-by-dep).
4. GO_TO_MARKET.md contains a full cold-outreach GTM kit — the intent to sell is explicit.

## Current health (verified today)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| Test suite | ⚠️ 75/77 pass — 1 failure in `server/advanced-auth.test.ts` (audit-log login event), 1 skipped |
| Server boot (demo mode) | ⚠️ Boots, `/api/health` returns ok — **but `/` returns 404** (serves from `server/_core/public` build dir that doesn't exist; dev script has no Vite middleware, so a fresh clone shows no UI) |
| Auth at boot | ⚠️ `[OAuth] ERROR: OAUTH_SERVER_URL is not configured` — login path still tied to Manus OAuth |
| LLM | Manus Forge gateway (gemini-2.5-flash) if key set, else local Ollama fallback (per SETUP.md) |
| Git | Repo exists with remote `github.com/chzchzchzchz/AI-CRM`; **46 modified files uncommitted** (~1,146 insertions of in-flight work) |
| README accuracy | ❌ References `config/company-config.json` (doesn't exist), `scripts/import-6sense-data.mjs` (actual: `.ts`), claims Phase 3 "multi-channel capture (email, Slack, LinkedIn, Zoom)" complete (no such integrations found in server/) |

## 🚨 Blockers before this can be sold or made public

### 1. Legal / IP ownership (decide before anything else)
This was built at a previous company, apparently on their data and possibly on their time.
Most employment agreements assign IP created for the employer to the employer. **Selling this
as a B2B tool without confirming ownership is a real legal risk.** Options, in increasing safety:
- Check the previous employment/IP agreement; get written sign-off if possible.
- Portfolio use with fully synthetic data and a genericized narrative is much lower risk than
  commercial sale, but still benefits from the code being demonstrably rewritten/generic.
- If ownership is unclear, the safest commercial path is a **clean rebuild of the generic
  product** (the architecture and lessons are yours; the specific artifact may not be).

### 2. Previous-employer data still in the repo
- `SFDC-Final-Target-Accounts-*.csv` — half-anonymized: fake names ("Umbrella Corp", "globex.io")
  but **real company descriptions/columns leak through** (e.g. Coalition Inc.).
- `Find-people-Table-*.csv` — contact-shaped export (names/emails/LinkedIn risk).
- `server/sequences/ping-context.ts` — hardcoded Ping Identity sequence context with the previous
  employer's actual value props ("reduce attack surface by over 80%", etc.).
- `README.md` — publishes the employer's real 6sense intent data: "Cisco (98 intent),
  Verizon (97), McKesson (97)", 2,103 accounts, 6QA gap numbers. That's their confidential
  business data, in a public-facing README.
- `demo-db.json` / `demo-db.backup.json` / `presentation-materials.tar.gz` — need audit for real names.
- Local MySQL DB (`DATABASE_URL` in `.env`) presumably still holds the full real dataset.
- Git history: CSVs appear untracked now (filter-repo ran), but needs a proper history scan before
  any public push.

### 3. First-run experience is broken
`pnpm dev` boots the API but serves no UI (404) — the exact opposite of the "5-minute setup"
promise. The PRD's own P0 goal ("clone && install && dev works") currently fails.

---

# The Plan

## Phase 0 — Decisions (you, not code)
- [ ] Resolve the IP question (see Blocker 1). Decide track:
      **A)** Portfolio-first (safe, fast) → **B)** sellable B2B tool (needs ownership clarity).
- [ ] Review + commit or discard the 46 uncommitted files (there's real in-flight work there —
      `server/agents/`, salesforce router changes, security changes).

## Phase 1 — Scrub (required for either track)
- [ ] Delete real/semi-real CSVs from working tree; regenerate 100% synthetic demo data
      (extend `seed-rich-demo.mjs`); audit `demo-db*.json` and delete `presentation-materials.tar.gz`.
- [ ] Genericize `server/sequences/ping-context.ts` → config-driven "your product context"
      (this also fixes the design flaw of a hardcoded vendor in a "generic" product).
- [ ] Rewrite README metrics section with demo-data numbers; remove employer-derived stats.
- [ ] Run BFG/filter-repo history scan for CSVs, JSON dumps, real emails; verify with
      `git log --all -p` greps before any public push.
- [ ] Rotate `JWT_SECRET`; confirm `.env` is gitignored (it is untracked today — keep it that way).

## Phase 2 — Make first-run flawless (PRD P0/P1, still unmet)
- [ ] Fix dev serving: add Vite dev middleware to the Express server (or a `concurrently`
      vite + API script with proxy). Acceptance: fresh clone → `pnpm install && pnpm dev` → UI at :3333.
- [ ] Demo mode truly zero-config: silence/remove Manus OAuth error path when `DEMO_MODE=true`;
      auto-login demo user (the `db.ts` demo user already exists).
- [ ] Replace Manus OAuth as the primary auth with the existing local email/password + 2FA stack
      (Login/SignUp/2FA/email-verification pages and routers already exist — wire them as default).
- [ ] Fix the failing audit-log test; unskip the skipped one or delete it.
- [ ] Make README match reality: create `config/company-config.json` (or drop it from docs),
      fix script paths, downgrade unbuilt features from ✅ to roadmap.
- [ ] Add CI (GitHub Actions: install → tsc → vitest → build) so it stays green.

## Phase 3 — Productize (Track B) / Polish (Track A)
**Track A (portfolio):**
- [ ] Redeploy live demo (the manus.space link is a dependency on the old platform — move to
      Railway/Fly/Render with demo mode + Ollama-or-cheap-LLM).
- [ ] Screenshots/GIF in README, tighten the story (the landing page in `landing/` is good raw material).
- [ ] Move the 29 root-level one-off scripts (`*.mjs`, `*.py`, `*.sh`) into `scripts/` or delete;
      delete `fix-*-errors.sh`, `vitest_output.log`, `company/` (the AI-employee sim is a separate
      experiment — it confuses the repo).

**Track B (sellable, adds to A):**
- [ ] Swap Manus Forge default → direct Anthropic/OpenAI keys (Forge is a dead dependency for customers).
- [ ] Postgres support (mysql2 is fine but Postgres is what B2B buyers deploy); Docker Compose for
      one-command self-host — that's a sellable single-tenant model without building multi-tenancy yet.
- [ ] Real Salesforce OAuth sync (today it's CSV import + "Open in Salesforce" links; the README
      oversells this). 6sense/Gong live APIs behind feature flags.
- [ ] Multi-tenancy + Stripe + self-serve onboarding = Phase 5 of the original roadmap. Only after
      first design-partner interest; don't build it speculatively.

## Suggested order of work
1. Phase 0 decisions → 2. Phase 1 scrub → 3. Phase 2 first-run → 4. Track A polish (always worth it)
→ 5. Track B only once IP is clear and someone wants to pay.
