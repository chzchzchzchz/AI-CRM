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
  ├── pnpm gate          browser checks, every route × 2 viewports
  └── pnpm flows         uses the app: filter, open, search, walk the nav
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

Walks every route at 1440px and 390px, signed in.

The route list is **read from `client/src/App.tsx`**, not typed into the script. It
used to be hand-maintained and it drifted: `/smart-search`, `/ai-tools` and
`/intent-signals` were all in it, none of them existed, and all three rendered the
404 page — which is small, legible, and error-free, so it met every budget. The
gate reported "27 routes × 2 viewports, all budgets met" while testing three
phantoms and never testing `/contacts/:id` or `/top-accounts` at all.

Deriving the list means a route added tomorrow is walked without anyone
remembering, and a route that doesn't exist can't be in it. The 404 page also
carries `data-not-found` now, so even a param route with a bad id fails loudly
rather than passing quietly.

| Budget | The defect it prevents |
|---|---|
| No rendered text under 12px | 60% of the dashboard rendered at 12px or less; the most common size on screen was 11px |
| No horizontal overflow | 10 of 25 routes broke at 390px |
| No page errors | a component removed from a render path typechecked clean and produced a blank page |
| Under 6,000 DOM nodes | the accounts list drew 38,549 — every row, unpaged |
| Under 16 screens tall | that same page was 68,215px, roughly 68 metres |
| No placeholder or template output | every account's Next Best Action was one of two strings, picked by whether a title contained "ciso" |
| Global metrics agree across pages | "Decision makers" said 790 on /insights and 619 on /contacts. The real figure was 5,365 |
| Route exists | three URLs in this gate's own list were 404s, and it passed all three |
| At least 120 characters of content | a page can render its shell, show nothing, and meet every budget above |
| No console errors | a failed query logs and renders an empty state rather than throwing, so `pageerror` never sees it |
| Route finishes loading | every route is code-split; a fixed wait measures whichever ones happened to arrive |

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

## Flow gate — `scripts/flow-gate.mjs`

The browser gate loads every route and measures what rendered. **It never clicks
anything.** So the whole class of "I tried it and nothing happened" was invisible:
a search box that filters nothing, a row that doesn't navigate, a dialog that
opens empty. Every one of those renders perfectly.

Four flows, each a thing a rep does in the first two minutes, each asserting an
observable change rather than that a handler exists:

| Flow | What it asserts |
|---|---|
| Contacts search narrows the list | a nonsense query matches 0, `director` matches some but not all |
| Clicking an account opens it | the URL moves to the row's own href, and the page isn't a 404 or a stub |
| Global search returns results | Ctrl+K opens, a real query finds something, a nonsense one says so |
| Every nav link goes somewhere real | every sidebar link is followed and none lands on the 404 page |

Deliberately small. A flaky flow check is worse than none, because it teaches
people to re-run CI until it goes green. Anything that couldn't be made
deterministic was left out rather than retried into submission.

> **Contacts search is filtered twice** — once server-side in `people.list`, once
> again on the client. Breaking either one alone leaves search working, so the
> flow check only fails when search is genuinely broken from the user's side.
> That's the right behaviour for a flow test, and it's worth knowing the
> redundancy is there: a single-layer regression will not surface here.

## Rules considered and rejected

**Buttons with no click handler.** The obvious heuristic — a `<Button>` tag with no
`onClick`, `type="submit"`, `asChild` or `href` — found 7 candidates in this repo
and **6 were false positives**: `DialogTrigger asChild` and `Link` wrappers, where
the parent owns the click. The seventh was a dropzone whose parent `<div>` handles
`onClick`, so it works too.

A rule that is 86% noise is a rule that gets silenced, and a silenced rule is worse
than no rule because it still looks like coverage. Recorded here so the next person
to have the idea knows it was measured rather than skipped.

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
