---
name: TargetDash
description: AI prospect-intelligence layer for B2B sales — a dark, data-dense command surface where every signal is real.
colors:
  canvas: "oklch(0.155 0.004 265)"
  surface: "oklch(0.198 0.005 265)"
  surface-raised: "oklch(0.228 0.006 265)"
  surface-sunken: "oklch(0.148 0.004 265)"
  border: "oklch(0.288 0.007 265)"
  border-subtle: "oklch(0.242 0.006 265)"
  border-strong: "oklch(0.375 0.009 265)"
  ink: "oklch(0.945 0.003 265)"
  ink-muted: "oklch(0.705 0.009 265)"
  ink-subtle: "oklch(0.585 0.010 265)"
  ink-faint: "oklch(0.475 0.009 265)"
  accent: "oklch(0.655 0.170 262)"
  positive: "oklch(0.715 0.155 155)"
  caution: "oklch(0.775 0.150 72)"
  critical: "oklch(0.655 0.192 24)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0.04em"
  figure:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontVariantNumeric: "tabular-nums"
    fontWeight: 600
    letterSpacing: "-0.01em"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "5px"
  xl: "6px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "oklch(0.145 0.02 262)"
    rounded: "{rounded.md}"
    padding: "0 12px"
  button-primary-hover:
    filter: "brightness(1.08)"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    border: "1px solid {colors.border-subtle}"
    padding: "16px 20px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 10px"
  badge-intent:
    backgroundColor: "color-mix(in oklab, {colors.accent} 12%, transparent)"
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: TargetDash

## 1. Overview

**Creative North Star: "The Signal Room"**

TargetDash is the quiet room where the noise drops away and the one signal that matters lights up. It is an instrument, not a poster — a rep opens it mid-workflow to see what's moving and what to do, then acts. The canvas is a lifted near-black (`oklch(0.155)`, deliberately not pure black) so that data, not chrome, carries the color: an accent on the live action, an amber risk, a red loss. Depth comes from tonal layering plus a hairline, never from decoration. The personality is sharp, modern, and powerful — cutting-edge without a single gimmick, premium through precision rather than ornament. It ships a light theme of equal quality, because half the people who open a CRM at 9am are not in a dark room.

It explicitly rejects two things. It is not the generic SaaS dashboard: the sea of identical icon-heading-text cards, interchangeable and forgettable. And it is not Salesforce-style enterprise clutter: grey chrome, endless tabs, everything-configurable-and-nothing-clear. Every screen commits to a point of view — one lead action, one clear hierarchy — because the product's whole promise is judgment, not a data dump.

Because the credibility of the product is that **every number is real and shows its work**, the visual system must never imply precision it doesn't have. A confident figure sits next to the evidence behind it; a missing value is stated, never faked with a plausible-looking placeholder.

**Key Characteristics:**
- Lifted near-black canvas; data supplies the color, chrome recedes.
- One accent carries identity and signal together; the rest of the spectrum is reserved for status meaning.
- Tonal layering plus a hairline for depth — flat by default, elevation earns its place.
- Near-square geometry (2–6px); full-round is reserved for dots, avatars, and spinners.
- Tabular figures for every measured number; one type family throughout.
- White-label ready: distinctive through structure and craft, neutral enough to wear a deployer's brand.

## 2. Colors

A layered neutral foundation that lets one accent and three status colors do all the talking.

### The Accent
- **Accent** (`oklch(0.655 0.170 262)` dark / `oklch(0.545 0.184 262)` light): The single decorative color in the system. It marks the active nav item, the primary action, focus rings, and links. It is *identity and signal at once* — the earlier split between a purple identity accent and a cyan signal accent meant two saturated hues competed on the same screen, and neither read as authoritative.

### Status
- **Positive** (`oklch(0.715 0.155 155)`): Won deals, positive sentiment, healthy pipeline, up-trends.
- **Caution** (`oklch(0.775 0.150 72)`): Cooling accounts, at-risk timing, mid-band scores.
- **Critical** (`oklch(0.655 0.192 24)`): Lost opps, negative sentiment, destructive actions, hard alerts.

Each has a `-subtle` companion for tinted fills and a `-foreground` for text on a solid fill.

### Intent Ramp
`--intent-1` … `--intent-5`, a five-step cold→hot sequence (blue → cyan → green → amber → red). Any 0–100 score maps onto it, so a hot account is legible before the number is read. This is a *sequential* scale — never use two of its steps as unrelated categories.

### Series
`--series-1` … `--series-6`, a categorical scale for charts. Distinguishable in both themes; use in order, and never to imply magnitude.

### Neutrals
- **Canvas** (`oklch(0.155)`): The app background. Deliberately *not* `#000` — a lifted near-black lets the elevation ramp read; pure black plus a neon accent is the house style of throwaway AI tools.
- **Surface** / **surface-raised** / **surface-sunken**: The three layers above canvas.
- **Ink**, **ink-muted**, **ink-subtle**, **ink-faint**: The four text weights.
- **border-subtle** / **border** / **border-strong**: Hairlines by prominence.

The light theme is a full peer, not an afterthought: warm off-white paper rather than clinical white, with ink at `oklch(0.22)` so it reads as printed.

### Named Rules
**The One-Accent Rule.** There is exactly one decorative color. If a hue is not the accent, it must mean positive, caution, critical, or a position on the intent/series scale. An accent with no meaning is noise.

**The Color-Carries-Meaning Rule.** On this canvas any saturated color reads as a status. Neutral is the default; color is earned.

## 3. Typography

**Display / Body / Figure Font:** Inter (with ui-sans-serif, system-ui fallback)
**Code Font:** a monospace stack (ui-monospace, SFMono, Menlo)

**Character:** One humanist-geometric sans across the entire interface, differentiated by weight and size rather than by pairing a second family. Inter's tabular figures are enabled globally, so numbers align in columns and hold their width as they update — the property monospace was previously being used to buy, without the typewriter texture that reads as "terminal" rather than "instrument". Monospace is now reserved for actual code: env-var names, transcripts, raw model output.

### Hierarchy
- **Display** (700, clamp(1.75rem, 3vw, 2.25rem), 1.1, -0.02em): Page titles only (Active Pipeline, 6sense Analytics). One per screen.
- **Headline** (600, 1.25rem, 1.25): Section and card titles.
- **Title** (600, 1rem, 1.3): Sub-sections, dialog headers, account names in a list.
- **Body** (400, 0.875rem, 1.5): Default text; cap prose at 65–75ch.
- **Label** (600, 0.6875rem, +0.04em): Small meta labels and status tags. Sparing uppercase — a functional tag, never a decorative section eyebrow.
- **Figure** (600, tabular-nums): Every measured number — dollar amounts, scores, percentages, counts. Set in Inter with `font-variant-numeric: tabular-nums`.

### Named Rules
**The Numbers-Are-Tabular Rule.** Any figure a user might compare or trust — intent score, deal amount, probability, count — carries tabular figures so it aligns in a column and does not reflow as it updates. Mark it `data-numeric` (or `.tabular`) and the base stylesheet handles it. Prose numbers ("a few days ago") need nothing.

## 4. Elevation

Flat by default. Depth is built from **tonal layering plus a hairline** — canvas → surface card → surface-sunken inset — with shadow as a supporting cue only. On a near-black canvas a heavy shadow reads as grime, not lift; a one-step lightening of the surface reads as elevation cleanly. Every shadow token is a pair of low-opacity layers rather than one large blur, which is what keeps an elevated panel from looking like it is floating in fog.

### Shadow Vocabulary
- **`--shadow-xs` … `--shadow-xl`**: A five-step ramp, each a *pair* of low-opacity shadows (a tight contact shadow plus a wider ambient one). Resting surfaces use `xs`; menus and dialogs use `md`–`xl`.
- **Focus ring** (`2px solid var(--ring)` at `2px` offset): Keyboard focus on every interactive element — the accent, never a grey outline, and never suppressed.
- **Hover**: Interactive cards shift `border-color` and step up one shadow. Buttons translate down 1px on `:active`. Whole-card `scale` transforms are banned — they make dense lists wobble.

### Named Rules
**The Tonal-Depth Rule.** To raise a surface, lighten it one step (`canvas → surface → surface-raised`) and give it a hairline. Shadow is a supporting cue at low opacity, never the primary one, and never a gradient.

## 5. Components

### Buttons
- **Shape:** Near-square (4px, `rounded-md`), 32px tall by default.
- **Primary / `signal`:** Accent fill with a 1px inset highlight along the top edge, and a 1px downward translate on `:active`. That is the whole trick — it reads as a physical control without a gradient. `signal` is the one high-intent action per view (Generate, Create, Sync).
- **Hover / Focus:** `brightness(1.08)` on hover; a 2px accent ring at 2px offset on `:focus-visible`.
- **Outline / Ghost:** Outline for secondary actions on a surface; ghost (muted ink, fills on hover) for tertiary and icon buttons.

### Chips / Badges
- **Style:** Tinted, not filled — a low-chroma wash, a matching border at ~25% opacity, and full-strength text. A wall of saturated pills is the fastest way to make a dense table unreadable.
- **StatusDot:** For table rows, a 6px dot plus a word. Cheaper than a badge, so it does not shout inside a list.
- **State:** A status must never rely on color alone — pair the tint with a word (`Hot`, `rising`) so it reads in greyscale and for color-blind users. Use a word or a geometric glyph, never an emoji: emoji render inconsistently across platforms and read as consumer chat.

### Cards / Containers
- **Corner Style:** 6px (`rounded-xl` in this scale — the largest radius in the system).
- **Variants:** `default` (surface + hairline + `shadow-xs`), `raised` (menus and dialogs), `sunken` (filter bars, wells, empty states), `ghost` (structure with no container).
- **Border:** 1px `border-subtle`; interactive cards shift to `border-strong` on hover.
- **Internal Padding:** 16px vertical / 20px horizontal.
- **MetricGrid:** Figure tiles butt together with 1px gaps inside a single bordered container, so a row of stats reads as one instrument panel rather than a row of floating cards.

### Inputs / Fields
- **Style:** Surface fill, 1px `border` stroke, 4px radius, 32px tall. Placeholder at `ink-faint`. Font-size is 16px below `md` so iOS Safari does not zoom the page on focus.
- **Focus:** Border shifts to the accent plus a 2px accent ring at 25% opacity.

### Navigation
- **Style:** A persistent left rail, collapsible to a 56px icon strip. Destinations are grouped by the question the user is answering (Workspace, Intelligence, Engage, Data, Admin) rather than by which team built them — twenty-five entries is too many for a flat list. The active item takes a `sidebar-accent` fill plus a 2px accent marker on the rail's outer edge. Labels in sentence case; group headers are the only uppercase in the chrome.
- **Company marks:** Account rows show the real logo, resolved from the domain, falling back to a tinted monogram. Never a bare letter in a saturated square.

### Signature Component — The Account Signal Card
The recurring unit of the product: a company logo, the account name, its intent score on the cold→hot ramp, a stage badge, and the evidence behind the recommendation as labelled rows against a single rule. It is the atom the whole system is built from — dense but legible, one clear read per card, evidence never more than a glance away. The labelled-rows treatment replaced a stack of three tinted panels, which buried the very text they were meant to emphasise.

## 6. Do's and Don'ts

### Do:
- **Do** let data carry the color on the near-black canvas; keep chrome neutral slate.
- **Do** keep to the single accent; everything else must carry status meaning (**the One-Accent Rule**).
- **Do** give every measured number tabular figures (**the Numbers-Are-Tabular Rule**).
- **Do** build depth by lightening the surface one step plus a hairline (**the Tonal-Depth Rule**).
- **Do** pair every status color with a word so it survives greyscale and color blindness.
- **Do** keep muted-ink body text at ≥4.5:1 against its slate surface; if it's close, step it toward ink.
- **Do** lead each screen with one action and one hierarchy — judgment, not a data dump.

### Don't:
- **Don't** ship the generic SaaS dashboard: a grid of identical icon-heading-text cards, interchangeable and forgettable.
- **Don't** drift toward Salesforce-style enterprise clutter: grey chrome, endless tabs, dense config with no point of view.
- **Don't** spend a saturated hue on decoration — on this canvas color reads as status; an accent with no meaning is noise.
- **Don't** nest a card inside a card.
- **Don't** use `border-left`/`border-right` > 1px as a colored accent stripe on cards or alerts.
- **Don't** use gradients anywhere — not as a fill, not behind an icon, not as text. Depth is tonal.
- **Don't** round chrome past 6px, or use `rounded-full` on anything that isn't a dot, an avatar, or a spinner. Bubble geometry reads as consumer chat.
- **Don't** put emoji in the interface. They are a status word's job.
- **Don't** imply precision the data doesn't have — show the evidence behind a number, and state a gap plainly instead of faking a value.
- **Don't** put muted grey body text on a tinted near-white; this system is dark — keep body text on slate, not the reverse.
