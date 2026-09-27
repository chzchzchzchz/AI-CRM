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

/** Wait for the code-split chunk, then for the page's data, then let the rest settle. */
async function goto(route) {
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-route-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
  // "Let queries settle" was what the fixed wait below was for, and a fixed wait is a
  // guess: /insights' account list lands at ~1.7s on an idle machine, past the 1.5s.
  // Clicks survive it because locators auto-wait, but a flow that ASSERTS on content
  // would read an empty skeleton and pass for the wrong reason.
  await page.waitForSelector("[data-page-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
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
 * The accounts page must not claim a filter is on when none is.
 *
 * The intent tiles are a segmented control, and "all" is one of the segments — so
 * `active = intentFilter === segment` was true for "all" on the DEFAULT view, and every
 * first load rendered "Reset intent filter · active" under the total. It offered to reset
 * something already reset, and named a filter as the reason for whatever the list showed.
 * On a workspace with no data that is the whole story: a rep clicks reset, nothing
 * changes, and the product looks broken.
 *
 * Selecting a real intent filter must still say "active", or this check would pass just
 * as happily against a badge that never renders.
 */
await flow("the unfiltered accounts view does not claim a filter is active", async () => {
  await goto("/accounts");
  const tiles = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

  const before = await tiles();
  assert(
    !/· active/.test(before),
    `the default view reported an active filter: ${before.match(/.{0,40}· active/)?.[0]}`
  );
  assert(
    !/Reset intent filter/.test(before),
    "the default view offered to reset a filter that is not applied"
  );

  await page.getByRole("button", { name: /Hot leads/i }).first().click();
  await page.waitForTimeout(1200);
  const after = await tiles();
  assert(/· active/.test(after), "selecting Hot leads did not mark the filter active");
  assert(
    /Reset intent filter/.test(after),
    "with a filter applied there was no way back to all accounts"
  );
});

/**
 * The home page's tiles have to open the list they counted.
 *
 * Hot, Warm and Unworked 6QA linked to /accounts?filter=…, and the accounts page never
 * read the parameter, so each one landed on all 1,000 accounts. The intent filter also let
 * every unscored account through, so even choosing Hot by hand listed 631 under a tile that
 * said 105. Clicked here the way a person would, and the landing count compared with the
 * number on the tile.
 */
await flow("the home page's tiles open the list they counted", async () => {
  const listCount = async () => {
    await page.waitForSelector("[data-route-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
    await page.waitForSelector("[data-page-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const m = text.match(/Target Accounts\s*([\d,]+)\s+accounts/i);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };

  // Hot: identified by its subtitle, which no other tile on the page carries.
  await goto("/");
  const hot = page.getByRole("button").filter({ hasText: "Intent 70+" }).first();
  const hotShown = Number(((await hot.innerText()).match(/\d[\d,]*/) || [""])[0].replace(/,/g, ""));
  assert(hotShown > 0, "could not read the Hot tile's number");
  await hot.click();
  const hotListed = await listCount();
  assert(
    hotListed === hotShown,
    `the Hot tile said ${hotShown} and opened a list of ${hotListed}`
  );

  // Unworked 6QA: the tile declares its own value for the quality gate, so read that.
  await goto("/");
  const unworked = page.locator('[data-metric="unworked-6qa"]').first();
  const unworkedShown = Number(await unworked.getAttribute("data-metric-value"));
  assert(unworkedShown > 0, "could not read the Unworked 6QA tile's number");
  await unworked.click();
  const unworkedListed = await listCount();
  assert(
    unworkedListed === unworkedShown,
    `the Unworked 6QA tile said ${unworkedShown} and opened a list of ${unworkedListed}`
  );

  // The same filter chosen on the accounts page itself, with nothing cached from the home
  // page. This path showed 0: the list was computed before the ids arrived and nothing
  // told it to recompute when they did.
  await goto("/accounts"); // a full page load, so nothing is cached from the home page
  await page.getByRole("combobox").filter({ hasText: "All Intent" }).first().click();
  await page.getByRole("option", { name: "Unworked 6QA" }).click();
  const chosenListed = await listCount();
  assert(
    chosenListed === unworkedShown,
    `choosing Unworked 6QA on the accounts page listed ${chosenListed}; the home tile says ${unworkedShown}`
  );
});

/**
 * Picking a territory has to change the list.
 *
 * The accounts list was memoised without the territory predicate among its dependencies,
 * so choosing a rep re-rendered the page and handed back the list it already had — every
 * account, under a switcher showing one rep's name.
 */
await flow("switching territory re-filters the accounts list", async () => {
  await goto("/accounts");
  const read = async () => {
    await page.waitForTimeout(1200);
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const m = text.match(/Target Accounts\s*([\d,]+)\s+accounts/i);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  };
  const everyone = await read();
  await page.getByRole("combobox", { name: "Select view" }).first().click();
  const rep = page.getByRole("option").nth(1);
  const repName = (await rep.innerText()).trim();
  await rep.click();
  const theirs = await read();
  assert(everyone && theirs !== null, "could not read the account count");
  assert(
    theirs < everyone,
    `switching to ${repName} still listed ${theirs} of ${everyone} accounts`
  );
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

/**
 * An AI action has to end in something a person can read.
 *
 * This is the first-run experience for anyone who clones the repo: no API key, no
 * Ollama, nothing installed. The README promises the AI features "work for free
 * too", and the server is built for it — every provider fails, and invokeLLM
 * degrades to an honest note rather than throwing.
 *
 * What was never checked is what reaches the screen. A degraded response has a
 * different shape from a real one, and the failure modes are all silent: a spinner
 * that never stops, a toast nobody reads, "[object Object]" in the output panel, or
 * an empty box that looks like the feature is broken rather than unconfigured.
 *
 * So: click Generate, wait, and assert the page ends up in one of exactly two
 * states — real content, or a message that says why there isn't any.
 */
await flow("an AI action ends in readable output, with or without a model", async () => {
  await goto("/content-studio");

  const context = page.locator("textarea").first();
  assert((await context.count()) > 0, "no context field on /content-studio");
  await context.fill("A mid-market fintech evaluating identity providers after a failed audit.");

  const generate = page.getByRole("button", { name: /generate/i }).first();
  assert((await generate.count()) > 0, "no Generate button on /content-studio");
  assert(await generate.isEnabled(), "Generate is disabled even with context filled in");
  await generate.click();

  // The LLM path has a 60s total deadline before it degrades, so give it room.
  await page.waitForFunction(
    () => !/Generating/i.test(document.body.innerText),
    undefined,
    { timeout: 90_000 }
  ).catch(() => {});

  const seen = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
  assert(!/Generating…|Generating\.\.\./i.test(seen), "still generating after 90s — the spinner never stops");

  for (const junk of ["[object Object]", "undefined", "NaN", "Lorem ipsum"]) {
    assert(!seen.includes(junk), `"${junk}" reached the screen`);
  }

  // Read the output panel, not the page. Measuring whole-page text was the first
  // version of this check and it was useless: the nav and the form alone clear any
  // threshold, so it reported "produced content" while the panel held an apology.
  const panel = await page.locator("textarea").last().inputValue().catch(() => "");
  const unavailable = /unavailable|no api key|no local model|no model is configured/i.test(panel);

  assert(panel.length > 0, "the output panel is empty — no content and no reason");

  if (unavailable) {
    // Degraded is a fine outcome for a fresh clone. Being told it succeeded is not:
    // this used to render "Generated Blog Post" over the apology, toast "Content
    // generated", and write it to the content library as a real asset.
    const heading = await page.evaluate(() => document.body.innerText);
    assert(
      !/Generated (Blog Post|Email|Ad Copy|Campaign Brief|Battle Card)/i.test(heading),
      "an unavailable model was presented as a successful generation"
    );
    assert(
      !/Content generated/i.test(heading),
      "a success toast fired even though nothing was generated"
    );
  } else {
    assert(panel.length > 200, `the model returned ${panel.length} characters — too short to be the asked-for content`);
  }

  if (process.env.GATE_VERBOSE) {
    console.log(`    → ${unavailable ? "no model: reported as unavailable" : "produced content"}`);
    console.log(`    → panel: ${JSON.stringify(panel.slice(0, 200))}`);
  }
});

/**
 * 2FA enrolment has to be reachable and has to actually enrol.
 *
 * The whole reason this feature was broken for so long is that nothing ever touched
 * it: the router was unmounted, the login path never read `twoFactorEnabled`, and the
 * "backup codes" were never stored. Every one of those was invisible because no test
 * and no page ever opened the thing.
 *
 * This does not enable 2FA — turning it on for the demo user would lock every other
 * check in this file out of the app. It asserts the page is reachable, reports honest
 * status, and produces a real QR code and secret when asked to start.
 */
await flow("2FA enrolment is reachable and produces a real secret", async () => {
  await goto("/security");

  const body = await page.evaluate(() => document.body.innerText);
  assert(!(await page.locator("[data-not-found]").count()), "/security is not routed");
  assert(/two-factor/i.test(body), "the security page does not mention two-factor");
  // Status must be a claim about this account, not a placeholder.
  assert(
    /Off\. Your password alone signs you in\.|recovery codes left/i.test(body),
    `security page shows no 2FA status: ${JSON.stringify(body.slice(0, 200))}`
  );

  const start = page.getByRole("button", { name: /turn on two-factor/i }).first();
  assert((await start.count()) > 0, "no way to start enrolment");
  await start.click();
  await page.waitForTimeout(3000);

  const qr = page.locator('img[alt*="authenticator" i]').first();
  assert((await qr.count()) > 0, "enrolment produced no QR code");
  const src = await qr.getAttribute("src");
  assert(
    (src || "").startsWith("data:image/"),
    `QR code is not an image: ${JSON.stringify((src || "").slice(0, 40))}`
  );

  // The manual-entry key has to be a real base32 secret, not a placeholder.
  const shown = await page.evaluate(() => document.body.innerText);
  const secret = shown.match(/\b[A-Z2-7]{32,}\b/);
  assert(secret, "no base32 secret offered for manual entry");
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
