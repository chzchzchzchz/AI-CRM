# PRD: AI-CRM Perfect GitHub Repository

## Feature Overview
Transform the current messy AI-CRM repo into a flawless, production-ready GitHub repository that can be cloned and run with one command.

## Current State (The Mess)
1. **Duplicate components** — `calls.tsx` in `pages/` AND `ui/`, `contacts.tsx` in 2 places, etc.
2. **Junk directories** — `hermes-webui/` (entire separate project inside this one), `patches/`, `presentation-screenshots/`, `presentation/`, `product/`
3. **PII in git history** — CSV files committed, then "git rm --cached" but still in history (partially fixed with filter-repo)
4. **Missing critical files** — `package.json` was accidentally deleted by filter-repo, recreated but WRONG (missing half the deps)
5. **Old docs** — audit reports from December 2025 that don't match current reality
6. **Binary blobs in root** — `*.webp` screenshots, `*.csv` files with real PII
7. **Inconsistent narrative** — README mentions "the company", YC references (removed but narrative broken)

## Goals
1. **Clean architecture** — `client/src/` (ONE set of components), `server/` (clear modules), `drizzle/` (ONE schema)
2. **One command setup** — `git clone && npm install && npm run dev` works immediately
3. **Demo mode by default** — shows FAKE data (Acme Corp, Stark Industries), no real PII
4. **Perfect README** — matches what the tool ACTUALLY does today
5. **Clean git history** — no PII anywhere, not even in old commits
6. **Working build** — `npm run build` succeeds with 0 errors
7. **Ready to push** — flawless GitHub repo

## User Stories

### P0: Clean Architecture
**As a** developer cloning the repo,
**I want** one clean directory structure without duplicates,
**So that** I can understand the codebase immediately.

**Acceptance Criteria:**
- [ ] NO duplicate components (keep `pages/`, remove `ui/` duplicates)
- [ ] Clean `client/src/` with ONLY: `components/`, `pages/`, `contexts/`, `hooks/`, `main.tsx`
- [ ] Clean `server/` with clear modules (no bloat, no `__pycache__`, no `.pyc` files)
- [ ] ONE `drizzle/schema.ts` file
- [ ] NO `hermes-webui/` directory (separate project, doesn't belong here)
- [ ] NO `patches/`, `presentation-screenshots/`, `presentation/`, `product/` directories

### P1: Perfect package.json
**As a** user cloning the repo,
**I want** a correct `package.json` with all dependencies,
**So that** `npm install` works immediately.

**Acceptance Criteria:**
- [ ] `package.json` has ALL dependencies from the ORIGINAL project (before filter-repo accident)
- [ ] `npm install` completes without errors
- [ ] `npm run build` succeeds with 0 TypeScript errors

### P2: Demo Mode by Default
**As a** user cloning the repo,
**I want** the app to show FAKE data by default,
**So that** no real PII is exposed.

**Acceptance Criteria:**
- [ ] `.env.example` has `DEMO_MODE=true`
- [ ] When `DEMO_MODE=true`, shows fake companies (Acme Corp, Stark Industries, etc.)
- [ ] No real PII in demo mode
- [ ] Clear instructions in README for enabling real data

### P3: Perfect README
**As a** visitor to the GitHub repo,
**I want** a clear README that matches what the tool does,
**So that** I understand the value immediately.

**Acceptance Criteria:**
- [ ] No mentions of "the company" or old company references
- [ ] No YC/VC references
- [ ] Clear feature list with ✅/⚠️/❌ status
- [ ] One-command setup instructions
- [ ] Live demo link works
- [ ] All API keys documented in `.env.example`

### P4: Clean Git History
**As a** repo maintainer,
**I want** no PII anywhere in git history,
**So that** I can make the repo public safely.

**Acceptance Criteria:**
- [ ] No CSV files in any commit
- [ ] No JSON files with real PII in any commit
- [ ] No email addresses like `mohssinechazi@gmail.com` in any commit
- [ ] Use BFG or filter-repo to clean ALL history

### P5: Working Build
**As a** developer,
**I want** `npm run build` to succeed,
**So that** I know the code is valid.

**Acceptance Criteria:**
- [ ] `npm run build` completes successfully
- [ ] 0 TypeScript errors
- [ ] All imports resolve correctly
- [ ] No missing dependencies

### P6: Ready to Push
**As a** repo maintainer,
**I want** a flawless GitHub repo,
**So that** I can share it publicly with pride.

**Acceptance Criteria:**
- [ ] `git clone https://github.com/chzchzchz/AI-CRM.git` works
- [ ] `npm install && npm run dev` starts the app
- [ ] Live demo at `https://targetdash-pwcs8qfq.manus.space/` works
- [ ] No PII exposed anywhere
- [ ] Clean commit history with meaningful messages

## Technical Constraints
1. **Don't break working features** — the live site works (2103 accounts, AI insights, outreach)
2. **Preserve server-side code** — all routers, AI modules, integrations stay
3. **Keep `drizzle/` schema** — database structure is solid
4. **Maintain `.env.example`** — already created with all API keys

## Definition of Done
- [ ] `git clone` works
- [ ] `npm install` works
- [ ] `npm run build` succeeds
- [ ] `npm run dev` starts the app
- [ ] No PII in ANY commit
- [ ] README is perfect
- [ ] Live demo works
- [ ] Ready to share publicly
