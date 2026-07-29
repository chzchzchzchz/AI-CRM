#!/usr/bin/env node
/**
 * Browser quality gate — asserts the things a typecheck and a unit test cannot see.
 *
 * Every budget here has a defect behind it, each of which shipped, passed every
 * automated check at the time, and was found only because a person opened the page
 * and looked:
 *
 *   text below 12px      60% of the dashboard rendered at caption size
 *   page height          the accounts list was 68,215px — 1,000 rows, no paging
 *   DOM nodes            38,549 on one route
 *   horizontal overflow  10 of 25 routes broke at 390px
 *   page errors          a component removed from a render path typechecked clean
 *                        and produced a blank page ("Rendered more hooks…")
 *
 * The point is that none of those needed a human to notice again. This boots the
 * app, walks every route at desktop and mobile, and exits non-zero on any breach.
 *
 * Usage: pnpm gate            (boots its own server)
 *        BASE_URL=… pnpm gate (uses one already running)
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

/**
 * Where Chromium lives.
 *
 * Sandboxes that pre-install it expose a fixed path; CI installs it into
 * Playwright's own cache. Hardcoding either one breaks the other, so use the
 * explicit path only when it actually exists and otherwise let playwright-core
 * resolve its own download.
 */
const EXPLICIT = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";
const CHROME = fs.existsSync(EXPLICIT) ? EXPLICIT : undefined;
const PORT = Number(process.env.GATE_PORT || 3399);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.BASE_URL;

/** Every route a user can reach, with the budget each is held to. */
const ROUTES = [
  "/", "/accounts", "/accounts/2", "/contacts", "/opportunities", "/calls",
  "/insights", "/intent-signals", "/bulk-insights", "/smart-search", "/ai-tools",
  "/outreach", "/sequences", "/content-studio", "/webinar-generator",
  "/transcript-analyzer", "/rfps", "/data-hub", "/lead-processor",
  "/csv-processor", "/validation", "/integrations", "/salesforce-sync",
  "/sixsense-sync", "/sixsense-analytics", "/admin", "/admin/approval",
];

/**
 * Sentences that mean the output is a shape, not an answer.
 *
 * "Email {contact} with value-driven message" was the Next Best Action for every
 * account in the database — one of two strings, chosen by whether a job title
 * contained "ciso". It rendered at a legible size, in a well-spaced card, with no
 * overflow and no errors: every budget below would have passed it. The only thing
 * wrong with it was that it said nothing, and only a person reading the page could
 * tell. These are the specific phrasings that were shipped, so at least this exact
 * failure cannot come back unnoticed.
 */
const TEMPLATE_TELLS = [
  "with value-driven message",
  "with security risk-focused message",
  "Lorem ipsum",
  "TODO:",
  "undefined",
  "NaN",
  "[object Object]",
];

const BUDGET = {
  minFontPx: 12,      // below this is caption size doing body-copy work
  maxNodes: 6000,     // an unpaged list blows straight past this
  maxScreens: 16,     // page height as a multiple of the viewport
  maxOverflowPx: 1,   // sub-pixel rounding only
};

const failures = [];
const note = [];

/**
 * Every global metric seen, keyed by name → value → the routes that showed it.
 *
 * "Decision makers" was a tile on /insights and a tile on /contacts. Over the same
 * 1,500 contacts, one matched seventeen job-title tokens and said 790; the other
 * matched nine and said 619 — and the true figure was 5,365, because both were
 * counting a capped query. Both rendered at a legible size with no overflow and no
 * page errors — every other
 * budget here passed them — and the pages are two clicks apart. A number can be
 * wrong while being perfectly presented, and the only mechanical tell is that the
 * app contradicts itself.
 */
const metrics = new Map();

const waitPort = (port, ms = 90_000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => { s.destroy(); resolve(); });
      s.once("error", () => {
        s.destroy();
        if (Date.now() - t0 > ms) reject(new Error(`port ${port} never opened`));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });

let server;
if (OWN_SERVER) {
  if (!fs.existsSync(".env")) {
    fs.writeFileSync(".env", `DEMO_MODE=true\nPORT=${PORT}\nJWT_SECRET=gate-only-not-a-real-secret-value-here\nNODE_ENV=development\n`);
  }
  server = spawn("pnpm", ["dev"], {
    env: { ...process.env, PORT: String(PORT), DEMO_MODE: "true" },
    stdio: "ignore",
    detached: true,
  });
  await waitPort(PORT);

  // waitPort only proves something answered a TCP connect. A dev server left over
  // from an earlier run can hold the port and then be reaped, and the gate goes on
  // to fail 27 routes with ERR_CONNECTION_REFUSED and an uncaught exception — which
  // reads like the app is broken rather than like the harness never started.
  const ready = await fetch(`${BASE}/login`)
    .then(r => r.ok)
    .catch(() => false);
  if (!ready) {
    console.log(`\n  ✘ quality gate: no server answering on ${BASE}`);
    console.log(`    port ${PORT} accepted a connection but did not serve /login.`);
    console.log(`    Check for a stale dev server: ps aux | grep 'tsx watch'\n`);
    try { process.kill(-server.pid); } catch {}
    process.exit(1);
  }
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

/** Sign in once per viewport; the app is authenticated everywhere. */
async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  const email = await page.locator('input[type="email"]').count();
  if (!email) return false;
  await page.fill('input[type="email"]', process.env.GATE_EMAIL || "demo@ai-crm.com");
  await page.fill('input[type="password"]', process.env.GATE_PASSWORD || "DemoPass123!");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  return !page.url().includes("/login");
}

/** Smallest rendered font size among elements that actually show text. */
const measure = TELLS => ({
  nodes: document.querySelectorAll("*").length,
  height: document.documentElement.scrollHeight,
  screens: +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  // Placeholder and template phrasings that reached the screen.
  tells: (() => {
    const body = document.body.innerText || "";
    return TELLS.filter(t => body.includes(t));
  })(),
  // Tiles that claim to describe the whole book of business, so the same key can
  // be compared across pages. data-metric-scope="view" opts out — a filtered list
  // is allowed to show a smaller number, it just has to say so.
  metrics: [...document.querySelectorAll("[data-metric]")]
    .filter(el => el.getAttribute("data-metric-scope") === "global")
    .map(el => ({
      key: el.getAttribute("data-metric"),
      value: el.getAttribute("data-metric-value"),
    })),
  tiny: (() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      if (el.children.length) continue;
      const tag = el.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") continue;
      const t = (el.textContent || "").trim();
      if (t.length < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const px = parseFloat(cs.fontSize);
      if (px && px < 12) out.push(`${Math.round(px)}px "${t.slice(0, 28)}"`);
    }
    return [...new Set(out)].slice(0, 5);
  })(),
});

for (const width of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message.split("\n")[0].slice(0, 120)));

  if (!(await signIn(page))) {
    failures.push({ route: "/login", rule: "sign in", detail: "could not authenticate" });
    await ctx.close();
    continue;
  }

  for (const route of ROUTES) {
    errors.length = 0;
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(2200);

    let m;
    try {
      m = await page.evaluate(measure, TEMPLATE_TELLS);
    } catch (e) {
      failures.push({ route, width, rule: "renders", detail: e.message.slice(0, 100) });
      continue;
    }

    const at = `${route} @${width}`;
    if (m.overflow > BUDGET.maxOverflowPx)
      failures.push({ route: at, rule: "no horizontal overflow", detail: `${m.overflow}px` });
    if (m.tiny.length)
      failures.push({ route: at, rule: `no text under ${BUDGET.minFontPx}px`, detail: m.tiny.join(", ") });
    if (errors.length)
      failures.push({ route: at, rule: "no page errors", detail: errors[0] });
    if (m.tells.length)
      failures.push({
        route: at,
        rule: "no placeholder or template output",
        detail: m.tells.map(t => `"${t}"`).join(", "),
      });
    for (const { key, value } of m.metrics || []) {
      if (!key || value == null) continue;
      if (!metrics.has(key)) metrics.set(key, new Map());
      const seen = metrics.get(key);
      if (!seen.has(value)) seen.set(value, []);
      seen.get(value).push(at);
    }

    // Budgets are desktop-only: a phone stacks everything, so height and node
    // counts there measure the layout, not the page's restraint.
    if (width === 1440) {
      if (m.nodes > BUDGET.maxNodes)
        failures.push({ route: at, rule: `under ${BUDGET.maxNodes} DOM nodes`, detail: `${m.nodes}` });
      if (m.screens > BUDGET.maxScreens)
        failures.push({ route: at, rule: `under ${BUDGET.maxScreens} screens tall`, detail: `${m.screens} screens (${m.height}px)` });
      note.push(`${route.padEnd(24)} ${String(m.nodes).padStart(5)} nodes  ${String(m.screens).padStart(5)} screens`);
    }
  }
  await ctx.close();
}

await browser.close();
if (server) { try { process.kill(-server.pid); } catch {} }

// A metric that means the whole book of business has to be the same number
// wherever it appears. Anything scoped to a filter or a territory is tagged
// data-metric-scope="view" and is not compared.
for (const [key, byValue] of metrics) {
  if (byValue.size < 2) continue;
  failures.push({
    route: [...byValue.values()].flat().join(", "),
    rule: `"${key}" agrees across pages`,
    detail: [...byValue].map(([v, where]) => `${v} on ${where.join(" & ")}`).join(" vs "),
  });
}

if (process.env.GATE_VERBOSE) note.forEach(n => console.log("  " + n));

if (failures.length) {
  console.log(`\n  ✘ quality gate: ${failures.length} breach(es)\n`);
  for (const f of failures) console.log(`    ${f.route}\n      ${f.rule} — ${f.detail}`);
  process.exit(1);
}
console.log(`  ✓ quality gate: ${ROUTES.length} routes × 2 viewports, all budgets met`);
