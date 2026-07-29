# The quality gate

`pnpm verify` — and CI on every push and pull request.

Every rule below exists because the thing it checks **was actually wrong in this
repo, shipped, and passed every automated check at the time.** Each was found by a
person opening a page and reading it. The gate exists so that none of them can be
found by hand a second time.

If you add a rule here, it should have that same provenance. A rule invented in the
abstract is a rule that will eventually be silenced.

---

## What runs

```
pnpm verify
  ├── pnpm check         typecheck, server + client
  ├── pnpm lint          rules-of-hooks only
  ├── pnpm test          unit tests
  ├── pnpm inventory     regenerate docs/CAPABILITIES.md
  ├── pnpm check:claims  static truth checks
  ├── pnpm build
  └── pnpm gate          browser checks, every route × 2 viewports
```

Run any one on its own. `pnpm gate` boots its own server on port 3399; point it at
a running instance with `BASE_URL=http://localhost:3333 pnpm gate`, and add
`GATE_VERBOSE=1` to print the per-route budget table.

---

## Static checks — `scripts/check-claims.mjs`

| Rule | The defect it prevents |
|---|---|
| No hardcoded type below 12px | 33 `text-[10px]`/`text-[11px]` bypassed the scale entirely, so raising the tokens didn't reach them |
| Docs links resolve | Five links pointed at `google.com/search?q=SETUP.md` — an editor autolink nobody clicked |
| README matches the seed | The README advertised 16 accounts and 40 contacts against a dataset of 1,000 and 10,023 |
| Nothing unrouted | 51 procedures were built and unreachable, discovered only by writing a crawler |
| No fabricated evidence | Content Studio displayed a hardcoded list of filenames as the documents an answer was drawn from |
| One job-title taxonomy | Eight private regexes decided who was a "decision maker". One read "Vice President" as "President"; others matched with `.includes()`, so "Leadership" counted as a lead |
| Every test file runs | `shared/taxonomy.test.ts` sat outside the vitest `include` glob — committed, green, never executed |

## Lint — `eslint.config.js`

One rule, as an error: **`react-hooks/rules-of-hooks`**.

A hook below a component's early return typechecks, builds, passes every unit test,
and then renders a blank page with *"Rendered more hooks than during the previous
render"*. It happened three times here. The third was a **latent** one in
`ActivityTimeline` that browser testing had missed for days, because the query
usually resolved before first paint and the bad transition never occurred.

Nothing stylistic is configured. Prettier owns formatting, TypeScript owns types,
and a config that emits hundreds of warnings is a config nobody reads.

## Browser gate — `scripts/quality-gate.mjs`

Walks all 27 routes at 1440px and 390px, signed in.

| Budget | The defect it prevents |
|---|---|
| No rendered text under 12px | 60% of the dashboard rendered at 12px or less; the most common size on screen was 11px |
| No horizontal overflow | 10 of 25 routes broke at 390px |
| No page errors | a component removed from a render path typechecked clean and produced a blank page |
| Under 6,000 DOM nodes | the accounts list drew 38,549 — every row, unpaged |
| Under 16 screens tall | that same page was 68,215px, roughly 68 metres |
| No placeholder or template output | every account's Next Best Action was one of two strings, picked by whether a title contained "ciso" |
| Global metrics agree across pages | "Decision makers" said 790 on /insights and 619 on /contacts. The real figure was 5,365 |

The last two are the ones that catch a page which looks right. A tile can be
legible, well-spaced, error-free and still be lying; the mechanical tells are that
the sentence is a shape rather than an answer, and that the app contradicts itself.

**Metric agreement** works off two attributes. A tile that claims to describe the
whole book of business carries `data-metric="decision-makers"`,
`data-metric-scope="global"` and `data-metric-value`; the gate collects them across
every route and fails when one key shows two values. A tile showing a filtered,
paged or territory-scoped number sets `data-metric-scope="view"` and is not
compared — it is allowed to be smaller, it just has to say so, which is why the
Contacts tiles switch their own scope when a filter is on.

Height and node budgets are asserted at desktop only: on a phone everything stacks,
so those numbers describe the layout rather than the page's restraint.

---

## When the gate fails

**Fix the page, not the budget.** Every threshold has headroom against the current
worst offender — the tightest is DOM nodes, where the heaviest route sits at 4,618
against a 6,000 ceiling. A breach means something regressed, not that the number
was too strict.

If a budget genuinely needs to move, change it in one place (`BUDGET` at the top of
`scripts/quality-gate.mjs`) and say in the commit message what got bigger and why.

## What the gate does not check

Worth being explicit, so its passing isn't read as more than it is:

- **Whether the copy is any good.** It knows the specific dead phrasings that
  shipped, and it knows a shared taxonomy is being used. It does not know whether
  a new sentence is worth reading. A fresh template, phrased differently, passes.
- **Whether a number is correct.** It can prove the app does not contradict itself
  and that the README matches the seed. Two pages agreeing on 619 is not proof that
  619 is right — only that one definition produced it.
- **Anything behind a real vendor API.** No connector has been verified against a
  live tenant; the AI paths are exercised against a stub standing in for the model.

Those still need a person. The gate's job is to make sure that person is never
spending their attention on something a machine could have caught.
