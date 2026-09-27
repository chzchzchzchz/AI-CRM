#!/usr/bin/env node
/**
 * Captures docs/screenshots/ from the running app.
 *
 * The screenshots were taken by hand once, and six weeks later they no longer matched
 * the app: "Unworked 6QA" read 6 where the app said 69, the nav was missing Import Data,
 * and the top priority account was a different company. A picture of a product is a
 * claim about it, and a claim nothing re-checks goes stale the same way a number in
 * prose does. So they are generated, from a fresh copy of the seed, the same way every
 * time.
 *
 *   pnpm screenshots               boots its own server
 *   BASE_URL=… pnpm screenshots    uses one already running
 *   pnpm screenshots 01 07         only the shots whose file names start with these
 *
 * Then `node scripts/build-case-study.mjs` to re-inline them into docs/case-study.html.
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const EXPLICIT = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";
const CHROME = fs.existsSync(EXPLICIT) ? EXPLICIT : undefined;
const PORT = Number(process.env.SHOTS_PORT || 3398);
const BASE = process.env.BASE_URL || `http://localhost:${PORT}`;
const OWN_SERVER = !process.env.BASE_URL;
const OUT = path.join(process.cwd(), "docs", "screenshots");

// The file names are load-bearing: build-case-study.mjs inlines them by number.
const SHOTS = [
  {
    file: "01-account-brief",
    route: "/accounts/1",
    // The brief is the one surface that needs a model. Without one, the page renders
    // its facts and says so plainly — correct behaviour, and the wrong picture for a
    // screenshot whose job is to show what the brief is. Overwriting the real capture
    // with the notice would quietly replace the feature with its absence, so a run
    // with no model leaves this file alone and says why.
    skipIf: "No model was reachable",
  },
  { file: "02-accounts-list", route: "/accounts" },
  { file: "03-insights-brain", route: "/insights" },
  { file: "04-pipeline", route: "/opportunities" },
  { file: "05-contacts", route: "/contacts" },
  { file: "06-analytics", route: "/sixsense-analytics" },
  { file: "07-home", route: "/" },
  { file: "08-top-accounts", route: "/top-accounts" },
];

// Checked before anything starts, so a typo can't leave a server or browser running.
const only = process.argv.slice(2);
const selected = only.length ? SHOTS.filter(s => only.some(o => s.file.startsWith(o))) : SHOTS;
if (!selected.length) {
  console.error(`\n  ✘ screenshots: nothing matches ${only.join(", ")}\n`);
  process.exit(1);
}

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
  if (!fs.existsSync(".env")) fs.copyFileSync(".env.example", ".env");
  // A scratch database, deleted first, so the app copies the seed fresh: every run
  // photographs the same data, and nothing here touches a developer's demo-db.json.
  const dbPath = path.join(os.tmpdir(), `targetdash-shots-${process.pid}.json`);
  fs.rmSync(dbPath, { force: true });
  server = spawn("pnpm", ["dev"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DEMO_MODE: "true",
      DEMO_DB_PATH: dbPath,
      // Company logos come from public favicon services. Where those are slow or
      // unreachable the tile sits empty until the request gives up, and the capture
      // photographs a row of blank squares. The demo companies are fictional, so a
      // monogram is what almost everyone sees anyway; "off" makes it certain.
      VITE_LOGO_RESOLVER: "off",
    },
    stdio: "ignore",
    detached: true,
  });
  await waitPort(PORT);
  if (!(await fetch(`${BASE}/login`).then(r => r.ok).catch(() => false))) {
    console.error(`\n  ✘ screenshots: port ${PORT} opened but nothing served /login\n`);
    try { process.kill(-server.pid); } catch {}
    process.exit(1);
  }
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.fill('input[type="email"]', process.env.SHOTS_EMAIL || "demo@ai-crm.com");
await page.fill('input[type="password"]', process.env.SHOTS_PASSWORD || "DemoPass123!");
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
if (page.url().includes("/login")) {
  console.error("\n  ✘ screenshots: could not sign in\n");
  await browser.close();
  if (server) try { process.kill(-server.pid); } catch {}
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const written = [];
const skipped = [];

for (const shot of selected) {
  await page.goto(`${BASE}${shot.route}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  // The same two waits the quality gate uses: the code-split chunk, then the page's
  // data. A fixed delay photographs whatever happened to arrive — for /insights, a
  // spinner on an empty canvas.
  await page.waitForSelector("[data-route-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
  await page.waitForSelector("[data-page-loading]", { state: "detached", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  if (shot.skipIf) {
    const body = await page.evaluate(() => document.body.innerText || "");
    if (body.includes(shot.skipIf)) {
      skipped.push(`${shot.file}.png — page shows "${shot.skipIf}"; kept the existing capture`);
      continue;
    }
  }

  // The cursor is left wherever the sign-in click put it, which on /accounts is over
  // the second row — so one company rendered in its hover colour and the rest didn't.
  // Park it in empty header space, between the page title and the search box.
  await page.mouse.move(800, 28);
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, `${shot.file}.png`) });
  written.push(`${shot.file}.png  ←  ${shot.route}`);
}

await browser.close();
if (server) try { process.kill(-server.pid); } catch {}

for (const w of written) console.log(`  ✓ ${w}`);
for (const s of skipped) console.log(`  · ${s}`);
if (skipped.length) {
  console.log(
    "\n  To refresh a skipped shot, give the app a model (OPENROUTER_API_KEY in .env, or" +
      "\n  `ollama serve`) and run this again."
  );
}
console.log(`\n  ${written.length} written, ${skipped.length} skipped → docs/screenshots/`);
