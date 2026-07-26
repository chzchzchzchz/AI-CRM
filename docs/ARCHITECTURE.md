# Architecture

How the codebase fits together, and why it is shaped this way. If you are trying
to find where something lives, or add a page without fighting the grain of the
app, start here.

For the visual language — colour, type, geometry, component rules — see
[`DESIGN.md`](../DESIGN.md). This document covers structure.

---

## 1. Repository layout

```
client/src/          React app (Vite)
  _core/             Auth hooks and platform glue
  components/
    app-shell/       Sidebar, topbar, page header, brand, nav model
    ui/              Design-system primitives (button, card, table, charts…)
    *.tsx            Feature components (HotLeadsWidget, ContextualAI…)
  contexts/          Theme, rep-territory selection
  hooks/             Shared React hooks
  lib/               trpc client, utils
  pages/             One file per route
  index.css          The design system: tokens, base layer, utilities
server/
  _core/             HTTP entry, security middleware, cookies, SDK, Vite glue
  *.ts               tRPC routers and domain logic
  *.test.ts          Vitest suites (server-side)
shared/              Types and schema shared by both sides
```

Two TypeScript projects, both checked by `pnpm check`:

| Config | Covers | Why separate |
|---|---|---|
| `tsconfig.json` | `server/`, `shared/` | Node target, no JSX |
| `tsconfig.client.json` | `client/src/`, `shared/` | DOM libs, `react-jsx`, Vite env types |

> The client was historically excluded from typechecking entirely. That is how a
> `<Navigation>` with no import and a `<File/>` resolving to the DOM global both
> shipped to `main` — each a guaranteed runtime crash on its route. Keep both
> projects in `pnpm check`.

---

## 2. Request path

```
Browser ──▶ Express (server/_core/index.ts)
             ├── corsMiddleware
             ├── securityHeaders
             ├── rateLimiter          ← mounted on /api only
             ├── /api/trpc/*          → appRouter (server/routers.ts)
             ├── /api/oauth/*         → OAuth callback
             └── dev: Vite middleware │ prod: static dist/public
```

**The rate limiter is scoped to `/api` deliberately.** Mounted globally it also
counted static assets, and a single page load pulls hundreds of them — a few
refreshes locked a legitimate user out for fifteen minutes. Auth endpoints keep
their own stricter per-account brute-force protection regardless.

### Sessions

`server/_core/cookies.ts` derives cookie attributes per request:

- **HTTPS** → `SameSite=None; Secure` (allows cross-site framing)
- **HTTP** → `SameSite=Lax` (local dev, internal deployments)

`SameSite=None` is only legal alongside `Secure`; browsers silently drop a cookie
that sets one without the other. Hardcoding `none` meant every plain-HTTP origin
issued a cookie the browser threw away — login appeared to succeed and the very
next request was unauthenticated.

`JWT_SECRET` signs the session. If it is missing, shorter than 16 characters, or
left as a known placeholder, the server falls back to a **random per-process
secret** — sessions then die on every restart. In production with `DEMO_MODE`
off, it refuses to start instead. Generate a real one:

```bash
openssl rand -base64 48
```

---

## 3. The app shell

`client/src/App.tsx` wraps the router in a single `<AppShell>`. Pages render
their content and nothing else — no navigation, no page chrome, no
`min-h-screen` wrapper.

```
AppShell
├── Sidebar          collapsible rail, grouped nav, account menu
├── header           page title, ⌘K search trigger
└── main             ← the routed page
```

`AppShell` returns children bare for **auth routes** (`/login`, `/signup`,
`/request-access`, `/forgot-password`) and for signed-out visitors; those screens
own the full viewport themselves.

### Navigation model

`components/app-shell/nav-model.ts` is the single source of truth for the 30
routes. Destinations are grouped by the question the user is answering —
Workspace, Intelligence, Engage, Data, Admin — not by which team built them.

```ts
export const NAV_SECTIONS: NavSection[] = [ … ]
findActiveItem(location)   // longest-prefix match: /accounts/42 → Accounts
visibleSections(role)      // filters adminOnly entries
```

**To add a page:** create `pages/Thing.tsx`, add a `lazyLoad` + `<Route>` in
`App.tsx`, and add one entry to `NAV_SECTIONS`. Nothing else needs to change —
the sidebar, active state, and topbar title all derive from that entry.

---

## 4. The design system

`client/src/index.css` holds every token. Components consume them through
Tailwind utilities (`bg-surface`, `text-ink-muted`, `border-border-subtle`) and
never through raw palette classes.

| Layer | Tokens |
|---|---|
| Surfaces | `canvas`, `surface`, `surface-raised`, `surface-sunken` |
| Ink | `foreground`, `ink-muted`, `ink-subtle`, `ink-faint` |
| Lines | `border-subtle`, `border`, `border-strong` |
| Accent | `accent`, `accent-muted`, `accent-subtle` — **the only decorative colour** |
| Status | `positive`, `caution`, `critical` (each with `-subtle`, `-foreground`) |
| Sequential | `intent-1…5`, a cold→hot ramp for 0–100 scores |
| Categorical | `series-1…6`, for charts |

Rules worth internalising, all enforceable by review:

1. **One accent.** Any other saturated hue must mean positive, caution, critical,
   or a position on the intent/series scale.
2. **No gradients.** Depth is a lighter surface plus a hairline, with shadow as a
   supporting cue at low opacity.
3. **Tabular figures.** Mark numbers `data-numeric`; the base layer applies
   `font-variant-numeric: tabular-nums` so columns align and values do not
   reflow as they update.
4. **Near-square geometry.** Radii top out at 6px. `rounded-full` is for dots,
   avatars, and spinners only.
5. **No emoji in chrome.** A status word does that job and survives greyscale.

Both themes are first-class. Light is warm off-white paper, not clinical white;
dark is a lifted near-black, not `#000` — pure black plus a neon accent is the
house style of throwaway AI tools, and it flattens the elevation ramp.

### Shared building blocks

| Component | Use |
|---|---|
| `app-shell/PageHeader` | Eyebrow, title, description, actions — every page opens this way |
| `app-shell/Section` | Titled band inside a page |
| `ui/metric` — `Metric`, `MetricGrid`, `StatCard` | Figure tiles butted together as one instrument panel |
| `ui/charts` | `RankedBars`, `Sparkline`, `BarSeries`, `Donut`, `ScoreBar` |
| `ui/company-logo` | Real company mark from a domain, tinted monogram fallback |
| `ui/empty-state` | What would go here, and the one action that fills it |
| `ui/badge` — `Badge`, `StatusDot` | Tinted pill; dot for dense rows |

Charts are hand-drawn SVG. The dependency they replaced weighed ~500kB (and
carried a vulnerable `lodash`) to render what are, in this app, five shapes.

### Company logos

`CompanyLogo` resolves a mark from an account's domain through a fallback chain,
landing on a monogram whose tint is derived from the domain — so the same
company always gets the same colour.

```bash
VITE_LOGO_RESOLVER="https://logos.internal/{domain}?s={size}"  # custom service
VITE_LOGO_RESOLVER=off                                          # monograms only
```

Useful behind a strict CSP or in an air-gapped deployment. The previous call
sites pointed at Clearbit's logo endpoint, which no longer serves
unauthenticated requests, so every account rendered a broken image.

---

## 5. Build and bundle

`pnpm build` produces a Vite client bundle plus an esbuild server bundle.

Two deliberate splits keep the initial payload small:

1. **`SafeStreamdown` lazy-loads `streamdown`.** It carries a markdown pipeline,
   Shiki grammars, KaTeX, and Mermaid — the largest thing in the app, and none of
   it is needed until a model streams a reply. The split lives inside the
   wrapper, so its eleven call sites do not know about it.
2. **`manualChunks`** separates `vendor-react`, `vendor-ui`, and `vendor-data`.
   A one-line UI fix should not force every visitor to re-download React.

Initial JS is **~179 kB gzip**, down from 451 kB in a single chunk.

---

## 6. Verification

```bash
pnpm check     # tsc over server AND client
pnpm test      # vitest, server suites
pnpm build     # client + server bundles
pnpm audit     # expects zero advisories
```

CI runs `check`, `test`, and `build` on every PR. Dependency policy:

- Bump the direct dependency when one exists.
- Use `pnpm.overrides` for transitive packages with no upgrade path, pinning the
  lowest patched version rather than a floating major.
- `packageManager` in `package.json` is the single source of the pnpm version;
  do **not** also pass `version:` to `pnpm/action-setup` — specifying both fails
  the workflow with `ERR_PNPM_BAD_PM_VERSION`.

---

## 7. Local development

```bash
cp .env.example .env     # then set a real JWT_SECRET
pnpm install
pnpm dev                 # http://localhost:3000
```

`DEMO_MODE=true` runs against `demo-db.json`, seeded from the committed
`demo-db.seed.json` on first boot. The runtime file is gitignored and mutable,
so it is safe to experiment against.

Note that `.env` is read once at startup — `tsx watch` reloads on source
changes, not on env changes. Restart the server after editing it.
