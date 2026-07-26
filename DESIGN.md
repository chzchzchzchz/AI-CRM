---
name: TargetDash
description: AI prospect-intelligence layer for B2B sales — a dark, data-dense command surface where every signal is real.
colors:
  bg-void: "#0a0a0a"
  surface: "#1a1a1a"
  slate-950: "#020617"
  slate-900: "#0f172a"
  slate-800: "#1e293b"
  slate-700: "#334155"
  ink: "#f2f2f2"
  muted-ink: "#94a3b8"
  primary-purple: "#8b5cf6"
  signal-cyan: "#06b6d4"
  positive-emerald: "#10b981"
  warning-amber: "#eab308"
  danger-red: "#ef4444"
  info-blue: "#3b82f6"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.04em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.bg-void}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.info-blue}"
    textColor: "{colors.bg-void}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.slate-900}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input-search:
    backgroundColor: "{colors.slate-800}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  badge-intent:
    backgroundColor: "{colors.slate-800}"
    textColor: "{colors.signal-cyan}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: TargetDash

## 1. Overview

**Creative North Star: "The Signal Room"**

TargetDash is the dark, quiet room where the noise drops away and the one signal that matters lights up. It is an instrument, not a poster — a rep opens it mid-workflow to see what's moving and what to do, then acts. The surface is near-black (`oklch(0.05)`) so that data, not chrome, carries the color: a cyan number, an emerald sentiment, an amber risk. Depth comes from tonal layering of slate, not from decoration. The personality is sharp, modern, and powerful — cutting-edge without a single gimmick, premium through precision rather than ornament.

It explicitly rejects two things. It is not the generic SaaS dashboard: the sea of identical icon-heading-text cards, interchangeable and forgettable. And it is not Salesforce-style enterprise clutter: grey chrome, endless tabs, everything-configurable-and-nothing-clear. Every screen commits to a point of view — one lead action, one clear hierarchy — because the product's whole promise is judgment, not a data dump.

Because the credibility of the product is that **every number is real and shows its work**, the visual system must never imply precision it doesn't have. A confident figure sits next to the evidence behind it; a missing value is stated, never faked with a plausible-looking placeholder.

**Key Characteristics:**
- Near-black canvas; data supplies the color, chrome recedes.
- Cyan is the voice of intelligence; the rest of the spectrum is reserved for status meaning.
- Tonal slate layering for depth — flat by default, elevation earns its place.
- Mono for every measured number; sans for language.
- White-label ready: distinctive through structure and craft, neutral enough to wear a deployer's brand.

## 2. Colors

A near-black slate foundation that lets a disciplined set of signal colors do all the talking.

### Primary
- **Signal Cyan** (#06b6d4, `oklch(0.70 0.15 210)`): The voice of the AI and of live data — intent scores, AI-success predictions, active metrics, the primary action button. This is the color the eye should learn to trust. It carries the intelligence; everything else is context.

### Secondary
- **Brand Purple** (#8b5cf6, `oklch(0.62 0.21 293)`): The token-level primary and identity accent (nav, brand marks, selected states). Distinct in role from cyan: purple is *identity*, cyan is *signal*. Keep the two from competing on the same element.

### Tertiary — Status
- **Positive Emerald** (#10b981): Won deals, positive sentiment, healthy pipeline, up-trends.
- **Warning Amber** (#eab308): Cooling accounts, at-risk timing, mid-band scores.
- **Danger Red** (#ef4444): Lost opps, negative sentiment, destructive actions, hard alerts.
- **Info Blue** (#3b82f6): Secondary data series and the primary-button hover shift.

### Neutral
- **Void** (#0a0a0a, `oklch(0.05 0 0)`): The app background. Near-black, chroma 0.
- **Surface / Slate-900** (#0f172a): Cards and raised panels.
- **Slate-800** (#1e293b): Inputs, chips, hover fills, dividers on dark.
- **Slate-700** (#334155): Borders and strokes.
- **Ink** (#f2f2f2, `oklch(0.95 0 0)`): Primary text.
- **Muted Ink** (#94a3b8, slate-400): Secondary text and labels — **the contrast watch point** (see Do's & Don'ts).

### Named Rules
**The Cyan-Is-Signal Rule.** Cyan means "this is intelligence or live data." Never spend it on decoration, borders, or a heading just to add color. Its meaning is its value; dilute it and the dashboard loses its most trustworthy cue.

**The Color-Carries-Meaning Rule.** On this near-black canvas, any saturated color is read as a status. Don't introduce a hue that doesn't map to a signal (intent, sentiment, stage, win/loss). Neutral slate is the default; color is earned.

## 3. Typography

**Display / Body Font:** Inter (with ui-sans-serif, system-ui fallback)
**Number / Data Font:** a monospace stack (ui-monospace, SFMono, Menlo)

**Character:** One humanist-geometric sans across the whole language layer, differentiated by weight and size rather than by pairing a second family. Monospace is reserved for measured values so numbers align and read as data, not prose.

### Hierarchy
- **Display** (700, clamp(1.75rem, 3vw, 2.25rem), 1.1, -0.02em): Page titles only (Active Pipeline, 6sense Analytics). One per screen.
- **Headline** (600, 1.25rem, 1.25): Section and card titles.
- **Title** (600, 1rem, 1.3): Sub-sections, dialog headers, account names in a list.
- **Body** (400, 0.875rem, 1.5): Default text; cap prose at 65–75ch.
- **Label** (600, 0.6875rem, +0.04em): Small meta labels and status tags. Sparing uppercase — a functional tag, never a decorative section eyebrow.
- **Mono** (500, 0.875rem): Every measured number — dollar amounts, scores, percentages, counts.

### Named Rules
**The Numbers-Are-Mono Rule.** Any figure a user might compare or trust — intent score, deal amount, probability, count — is set in mono so it aligns and reads as data. Prose numbers ("a few days ago") stay in Inter.

## 4. Elevation

Flat by default. Depth is built almost entirely from **tonal layering** — void → slate-900 card → slate-800 inset — not from drop shadows. On a near-black canvas a heavy shadow reads as grime, not lift; a one-step lightening of the surface reads as elevation cleanly. Shadows appear only as a *response to state*: a soft focus glow, a subtle hover lift on interactive cards.

### Shadow Vocabulary
- **Focus glow** (`box-shadow: 0 0 0 3px rgba(6,182,212,0.35)`): Keyboard/active focus on inputs and primary controls — a cyan ring, not a grey outline.
- **Hover lift** (`box-shadow: 0 4px 20px rgba(0,0,0,0.4)` + `translateY(-2px)`): Only on cards that are themselves a click target.

### Named Rules
**The Tonal-Depth Rule.** To raise a surface, lighten it one slate step; don't reach for a shadow. Shadows are for state (focus, hover), never for resting structure.

## 5. Components

### Buttons
- **Shape:** Gently rounded (8px, `rounded-md`).
- **Primary:** Signal-cyan fill, near-black text, mono-adjacent weight. The one high-intent action per view (Generate, Create, Sync).
- **Hover / Focus:** Shift toward info-blue on hover; cyan focus glow (never a grey ring) on `:focus-visible`.
- **Ghost / Secondary:** Transparent with muted-ink text; fills to slate-800 on hover. For everything that isn't the primary action.

### Chips / Badges
- **Style:** Pill (`rounded-full`), slate-800 fill. Intent/status badges tint the *text* with the matching signal color (cyan for intent, emerald/amber/red for state) rather than flooding the fill.
- **State:** A status must never rely on color alone — pair the tint with a word or glyph (🔥 Hot, ▲ rising) so it reads for color-blind users and in greyscale.

### Cards / Containers
- **Corner Style:** 10px (`rounded-lg`).
- **Background:** Slate-900 on the void; slate-800 for nested insets (avoid nesting a card in a card).
- **Border:** 1px slate-700/800, low-contrast. On hover for interactive cards, border shifts toward cyan at low opacity.
- **Shadow:** None at rest (see Elevation).
- **Internal Padding:** 16px (`md`); 24px for feature panels.

### Inputs / Fields
- **Style:** Slate-800 fill, 1px slate-700 stroke, 8px radius, ink text. Placeholder at muted-ink but **never below 4.5:1**.
- **Focus:** Cyan focus glow + border shift to cyan. No default browser outline.

### Navigation
- **Style:** Persistent top/side nav on the void, purple as the identity accent for the active item; muted-ink for rest, ink on hover. Labels in Inter title weight, not uppercase.

### Signature Component — The Account Signal Card
The recurring unit of the product: an account with its intent score (mono, cyan), a heat/stage badge (tinted text + glyph), and a one-line "why now." It is the atom the whole system is built from — dense but legible, one clear read per card, evidence never more than a glance away.

## 6. Do's and Don'ts

### Do:
- **Do** let data carry the color on the near-black canvas; keep chrome neutral slate.
- **Do** reserve cyan for intelligence and live data (**the Cyan-Is-Signal Rule**).
- **Do** set every measured number in mono (**the Numbers-Are-Mono Rule**).
- **Do** build depth by lightening the surface one slate step, not with shadows (**the Tonal-Depth Rule**).
- **Do** pair every status color with a word or glyph so it survives greyscale and color blindness.
- **Do** keep muted-ink body text at ≥4.5:1 against its slate surface; if it's close, step it toward ink.
- **Do** lead each screen with one action and one hierarchy — judgment, not a data dump.

### Don't:
- **Don't** ship the generic SaaS dashboard: a grid of identical icon-heading-text cards, interchangeable and forgettable.
- **Don't** drift toward Salesforce-style enterprise clutter: grey chrome, endless tabs, dense config with no point of view.
- **Don't** spend a saturated hue on decoration — on this canvas color reads as status; an accent with no meaning is noise.
- **Don't** nest a card inside a card.
- **Don't** use `border-left`/`border-right` > 1px as a colored accent stripe on cards or alerts.
- **Don't** use gradient text (`background-clip: text`) or glassmorphism as decoration.
- **Don't** imply precision the data doesn't have — show the evidence behind a number, and state a gap plainly instead of faking a value.
- **Don't** put muted grey body text on a tinted near-white; this system is dark — keep body text on slate, not the reverse.
