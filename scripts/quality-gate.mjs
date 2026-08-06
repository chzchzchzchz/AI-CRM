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

/**
 * Every route a user can reach — read from the router, not typed out here.
 *
 * This list used to be hand-maintained, and it drifted: `/smart-search`,
 * `/ai-tools` and `/intent-signals` were in it and none of them existed. The real
 * paths are `/search` and `/tools`, and the third was never a page at all. All
 * three rendered the 404 component, and the gate reported "27 routes × 2
 * viewports, all budgets met" — because a 404 page is small, legible and
 * error-free, so it passes every budget in this file.
 *
 * Deriving the list means a route added tomorrow is walked without anyone
 * remembering to add it, and a route that does not exist cannot be in it.
 */
const AUTH_ROUTES = new Set(["/login", "/signup", "/request-access", "/forgot-password"]);
const ROUTES = (() => {
  const src = fs.readFileSync("client/src/App.tsx", "utf8");
  const paths = [...src.matchAll(/<Route\s+path=\{?["']([^"']+)["']/g)].map(m => m[1]);
  const seen = new Set();
  return paths
    .filter(p => !AUTH_ROUTES.has(p) && p !== "/404")
    // A param route needs a real value; id 2 exists in the seed for both.
    .map(p => p.replace(/:\w+/g, "2"))
    .filter(p => (seen.has(p) ? false : seen.add(p)));
})();

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
  // A page that renders its shell and nothing else. The 404 page measures 108
  // characters and the emptiest real route (/rfps) measures 165, so this sits
  // between them: below it, there is nothing on the page worth the trip.
  minContentChars: Number(process.env.GATE_MIN_CONTENT ?? 120),
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
  // Boot from the .env the README tells people to copy, not one invented here.
  //
  // This used to write its own four-line file. That meant CI proved a configuration
  // no user has, while `cp .env.example .env` — the documented first step — was never
  // exercised by anything. The two had already drifted: .env.example carries a
  // DATABASE_URL, company config, connector placeholders and a JWT_SECRET the gate's
  // version didn't, any of which could have broken a real first run without CI
  // noticing. Every run is now a cold start against the documented file.
  if (!fs.existsSync(".env")) {
    if (!fs.existsSync(".env.example")) {
      console.log("\n  ✘ quality gate: no .env and no .env.example to copy — a fresh clone has nothing to boot from\n");
      process.exit(1);
    }
    fs.copyFileSync(".env.example", ".env");
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

/**
 * Text that means the page gave up.
 *
 * A route that renders its shell and then shows "Failed to load" passes every other
 * budget in this file: legible, no overflow, no uncaught error, a sane node count.
 * The only thing wrong with it is that there is nothing on it.
 */
const BROKEN_TELLS = [
  "Failed to load",
  "Something went wrong",
  "Error loading",
  "Unable to load",
  "An error occurred",
];

/** Smallest rendered font size among elements that actually show text. */
const measure = TELLS => ({
  nodes: document.querySelectorAll("*").length,
  height: document.documentElement.scrollHeight,
  screens: +(document.documentElement.scrollHeight / window.innerHeight).toFixed(1),
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  // Placeholder and template phrasings that reached the screen.
  tells: (() => {
    const body = document.body.innerText || "";
    return TELLS.template.filter(t => body.includes(t));
  })(),
  broken: (() => {
    const body = document.body.innerText || "";
    return TELLS.broken.filter(t => body.includes(t));
  })(),
  // How much a reader actually gets. Nav chrome is excluded — a page whose only
  // text is the sidebar is an empty page, however many characters that sidebar has.
  notFound: !!document.querySelector("[data-not-found]"),
  content: (() => {
    const main = document.querySelector("main") || document.body;
    const clone = main.cloneNode(true);
    for (const el of clone.querySelectorAll("nav, aside, header, footer, script, style")) {
      el.remove();
    }
    return (clone.innerText || "").replace(/\s+/g, " ").trim().length;
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
  // A failed query logs and renders an empty state rather than throwing, so
  // pageerror alone never sees it. React's key/prop warnings land here too.
  page.on("console", m => {
    if (m.type() !== "error") return;
    const t = m.text().slice(0, 120);
    // Chrome logs every non-2xx fetch to the console; tRPC surfaces those itself.
    if (/Failed to load resource/.test(t)) return;
    errors.push(t);
  });

  if (!(await signIn(page))) {
    failures.push({ route: "/login", rule: "sign in", detail: "could not authenticate" });
    await ctx.close();
    continue;
  }

  for (const route of ROUTES) {
    errors.length = 0;
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" }).catch(() => {});

    // Every route is code-split, so a fixed wait is a race — and a chunk that has
    // not arrived looks exactly like a page with nothing on it. Wait for the
    // Suspense fallback to go, then settle, so each measurement is of the same
    // thing every run. A route still loading after 15s is a finding, not a retry.
    const loaded = await page
      .waitForSelector("[data-route-loading]", { state: "detached", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!loaded) {
      failures.push({
        route: `${route} @${width}`,
        rule: "route finishes loading",
        detail: "still showing the loading spinner after 15s",
      });
    }
    await page.waitForTimeout(1200);

    let m;
    try {
      m = await page.evaluate(measure, { template: TEMPLATE_TELLS, broken: BROKEN_TELLS });
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
    if (m.notFound)
      failures.push({
        route: at,
        rule: "route exists",
        detail: "rendered the 404 page — this URL is not registered in App.tsx",
      });
    if (m.broken.length)
      failures.push({
        route: at,
        rule: "page is not in an error state",
        detail: m.broken.map(t => `"${t}"`).join(", "),
      });
    if (m.content < BUDGET.minContentChars)
      failures.push({
        route: at,
        rule: `at least ${BUDGET.minContentChars} characters of content`,
        detail: `${m.content} — the page rendered its shell and little else`,
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
      note.push(`${route.padEnd(24)} ${String(m.nodes).padStart(5)} nodes  ${String(m.screens).padStart(5)} screens  ${String(m.content).padStart(6)} chars`);
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
