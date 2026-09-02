# Developing

The local loop and the conventions this codebase holds itself to. If you're trying to find where
something lives, read [`ARCHITECTURE.md`](ARCHITECTURE.md) first — this is about how to work in
it once you know.

---

## Setup

```bash
pnpm install
cp .env.example .env      # ships with DEMO_MODE=true and PORT=3333
pnpm dev                  # → http://localhost:3333
```

Demo mode reads `demo-db.json` and needs no database and no keys. To work against a real
database, set `DATABASE_URL` and `DEMO_MODE=false`, then `pnpm db:push`.

---

## Before you commit

```bash
pnpm verify
```

That's the whole gate, and it's exactly what CI runs — a green local run means a green push. It
takes a few minutes. The pieces, if you want to run one on its own:

| Command | What it does |
|---|---|
| `pnpm check` | typechecks **both** TS projects (server and client are separate configs) |
| `pnpm lint` | rules-of-hooks only — deliberately narrow, so it's never noise |
| `pnpm test` | vitest, 498 tests |
| `pnpm inventory` | regenerates `docs/CAPABILITIES.md` |
| `pnpm check:claims` | asserts the docs' factual claims against the code and the seed data |
| `pnpm build` | client + server bundles |
| `pnpm gate` | walks every route in a real browser at desktop and mobile |
| `pnpm flows` | uses the app: filters a list, opens a record, searches, walks the nav |
| `pnpm audit` | must report zero advisories |

[`QUALITY-GATE.md`](QUALITY-GATE.md) explains what each rule catches and names the defect that
put it there. If you add a rule, it should have that same provenance — a rule invented in the
abstract is one that eventually gets silenced.

---

## Conventions

### The one that matters

**Every number is real, and it shows its work.** A value on screen is computed from data, or it
isn't shown. Concretely, the things this rules out:

- Reporting success for work that didn't run — no toast over a disabled mutation
- Rendering model output as fact when the model was unreachable or given nothing to work with
- Filling a gap with a plausible-looking placeholder, a `* 0.8` estimate, or a rounded guess
- Labelling data as scoped when it isn't (a territory header over a global aggregate)

When the data isn't there, say so in the UI. "We couldn't verify this" is a real answer;
a confident wrong one is not.

### TypeScript

- Static types everywhere; `any` needs a reason next to it
- `const` by default
- Comments explain *why*, not *what* — and if a line exists because something broke, say what broke

### React

- Function components and hooks; keep them small enough to read in one screen
- **Use design tokens, never raw palette classes.** `bg-surface`, `text-ink-muted` — not
  `bg-slate-800`. [`../DESIGN.md`](../DESIGN.md) has the full set. The gate checks this.
- Surface errors. A swallowed mutation error is a bug, not tidiness.

### Server

- Every procedure validates its input with Zod
- Parameterized queries only (Drizzle) — never string-built SQL
- Anything a procedure can reach must be reachable from the UI or listed as external-by-design in
  `server/inventory.ts`. `pnpm inventory` fails the build otherwise.
- **Fence untrusted text before it enters a prompt.** Call transcripts, scraped pages, pasted
  input, and the model's own prior output all go through `wrapUntrusted()` from
  `server/_core/untrusted.ts`. `server/prompt-injection.test.ts` checks each interpolation site
  individually — a file-level check would pass while a sibling interpolation sat unwrapped.

### Tests

- A bug fix comes with a test that fails without it
- Tests must not mutate the committed demo data — set `DEMO_DB_PATH` to an isolated copy
- Prefer a test that reproduces the real failure over one that asserts the shape of the fix

---

## The demo dataset

`demo-db.seed.json` is committed and is the source of truth. `demo-db.json` is the gitignored
runtime copy the app reads and writes.

```bash
node scripts/seed-demo.mjs     # regenerate demo-db.json from the seed
node scripts/gen-demo.mjs      # regenerate the seed itself
```

`gen-demo.mjs` is deterministic (seeded mulberry32), so the same script produces the same dataset
every time. If you reshape it, re-run `pnpm check:claims` — the README quotes counts from it and
the build fails when they drift.
