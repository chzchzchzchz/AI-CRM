#!/usr/bin/env node
/**
 * Flow gate — asserts the app does something when you use it.
 *
 * scripts/quality-gate.mjs loads every route and measures what rendered. It never
 * clicks anything. So the whole class of "I tried it and nothing happened" was
 * still invisible to CI: a search box that filters nothing, a row that doesn't
 * navigate, a dialog that opens empty. Each of those renders perfectly.
 *
 * Every flow here is a thing a rep does in the first two minutes. Each asserts an
 * observable change — a count that drops, a URL that moves, results that appear —
 * not that a handler exists.
 *
 * Deliberately small. A flaky flow check is worse than none, because it teaches
 * people to re-run CI until it passes. Anything that could not be made
 * deterministic was left out rather than retried into submission.
 *
 * Usage: pnpm flows            (boots its own server)
 *        BASE_URL=… pnpm flows (uses one already running)
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

const EXPLICIT = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";
const CHROME = fs.existsSync(EXPLICIT) ? EXPLICIT : undefined;
const PORT = Number(process.env.GATE_PORT || 3398);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.BASE_URL;

const failures = [];
const passes = [];

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
  server = spawn("pnpm", ["dev"], {
    env: { ...process.env, PORT: String(PORT), DEMO_MODE: "true" },
    stdio: "ignore",
    detached: true,
  });
  await waitPort(PORT);
  const ready = await fetch(`${BASE}/login`).then(r => r.ok).catch(() => false);
  if (!ready) {
    console.log(`\n  ✘ flow gate: nothing serving on ${BASE} — check for a stale dev server\n`);
    try { process.kill(-server.pid); } catch {}
    process.exit(1);
  }
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

/** Wait for the code-split chunk, then let queries settle. */
async function goto(route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-route-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

async function flow(name, fn) {
  try {
    await fn();
    passes.push(name);
  } catch (e) {
    failures.push({ name, detail: String(e.message || e).split("\n")[0].slice(0, 180) });
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ── sign in ─────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', process.env.GATE_EMAIL || "demo@ai-crm.com");
await page.fill('input[type="password"]', process.env.GATE_PASSWORD || "DemoPass123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
if (page.url().includes("/login")) {
  console.log("\n  ✘ flow gate: could not sign in — every flow below needs a session\n");
  await browser.close();
  if (server) { try { process.kill(-server.pid); } catch {} }
  process.exit(1);
}

// ── flows ───────────────────────────────────────────────────────────────────

/**
 * Typing in the contacts search has to actually narrow the list.
 *
 * The list is paged, so "fewer rows" is not the assertion — a filter that matched
 * nothing and a filter that matched everything both leave 50 rows on screen. The
 * Contacts tile reports the size of the filtered set, so that is what moves.
 */
await flow("contacts search narrows the list", async () => {
  await goto("/contacts");
  const read = () =>
    page.getAttribute('[data-metric="contacts"]', "data-metric-value").then(Number);

  const before = await read();
  assert(before > 0, `no contacts to filter (tile read ${before})`);

  await page.fill('input[placeholder="Search contacts..."]', "zzzznotarealname");
  await page.waitForTimeout(1200);
  const empty = await read();
  assert(empty === 0, `a nonsense query still matched ${empty} contacts`);

  await page.fill('input[placeholder="Search contacts..."]', "director");
  await page.waitForTimeout(1200);
  const some = await read();
  assert(some > 0, `"director" matched nothing`);
  assert(some < before, `"director" matched ${some} of ${before} — the filter did not narrow`);
});

/**
 * Clicking an account row has to open that account.
 *
 * A list of links that render but don't navigate looks identical to one that works
 * until you click it.
 */
await flow("clicking an account opens it", async () => {
  await goto("/accounts");
  const first = page.locator('a[href^="/accounts/"]').first();
  assert((await first.count()) > 0, "no account links on /accounts");
  const href = await first.getAttribute("href");
  await first.click();
  await page.waitForTimeout(2500);
  assert(page.url().endsWith(href), `clicked ${href}, landed on ${page.url()}`);
  assert(
    !(await page.locator("[data-not-found]").count()),
    `${href} rendered the 404 page`
  );
  const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  assert(body.length > 400, `the account page rendered ${body.length} characters`);
});

/**
 * Global search has to find something that exists.
 *
 * It queries accounts, contacts and calls. A query drawn from the seed must return
 * at least one of them, and a nonsense query must say so rather than sit blank.
 */
await flow("global search returns results", async () => {
  await goto("/");
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(800);
  const box = page.locator('input[placeholder="Search accounts, contacts, or calls..."]');
  assert((await box.count()) > 0, "Ctrl+K did not open the search dialog");

  await box.fill("a");
  await page.waitForTimeout(2000);
  const dialog = page.locator('[role="dialog"]');
  const withResults = await dialog.innerText();
  assert(
    !/No results found/.test(withResults),
    `a one-letter query found nothing across 1,000 accounts and 10,023 contacts`
  );

  await box.fill("zzzznotarealthing");
  await page.waitForTimeout(2000);
  const withNone = await dialog.innerText();
  assert(
    /No results found/.test(withNone),
    "a nonsense query did not say it found nothing — the empty state is missing"
  );
});

/**
 * The nav has to go where it says.
 *
 * Every sidebar link is walked. A link pointing at a route that no longer exists
 * renders as a perfectly good link — the 404 is only visible after the click.
 */
await flow("every nav link goes somewhere real", async () => {
  await goto("/");
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('nav a[href^="/"]')].map(a => a.getAttribute("href"))
  );
  assert(hrefs.length > 0, "no nav links found");
  const dead = [];
  for (const href of [...new Set(hrefs)]) {
    await goto(href);
    if (await page.locator("[data-not-found]").count()) dead.push(href);
  }
  assert(!dead.length, `nav links to nonexistent routes: ${dead.join(", ")}`);
});

// ── report ──────────────────────────────────────────────────────────────────
await browser.close();
if (server) { try { process.kill(-server.pid); } catch {} }

for (const p of passes) console.log(`  ✓ ${p}`);
for (const f of failures) console.log(`  ✘ ${f.name}\n    ${f.detail}`);

console.log(
  `\n${passes.length} passed, ${failures.length} failed` + (failures.length ? " — see above" : "")
);
process.exit(failures.length ? 1 : 0);
