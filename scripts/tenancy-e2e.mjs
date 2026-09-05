#!/usr/bin/env node
/**
 * Tenancy end to end — the thing being sold, exercised the way a customer would.
 *
 * `pnpm tenancy` counts unscoped queries and `pnpm check:claims` pins that count, but
 * both read source. Neither can tell you whether a real person can sign up, get their
 * own workspace, invite a colleague into it, and stay out of everyone else's — which is
 * the entire commercial premise, and the part that had never been walked.
 *
 * Walking it found two defects that every unit test passed straight over:
 *
 *   - The last screen of signup said "Account Pending Approval. You'll receive an email
 *     once your account is approved." to a self-serve customer whose account the server
 *     had already approved, in an organization it had already created, with no admin
 *     anywhere who could approve them and no email that would ever arrive.
 *   - That same signup mailed the incumbent operator a one-click DENY link for the new
 *     customer's own admin account.
 *
 * Both render perfectly. Neither is visible to anything that does not actually sign up.
 *
 * The isolation assertions are made against the real tRPC API using each session's own
 * cookie, from inside that session's browser context — there is no UI for writing a call
 * record, and inventing one to test with would be testing the test.
 *
 * Runs against its own server and its own database file, so it never touches
 * demo-db.json.
 *
 * Usage: pnpm tenancy:e2e
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";

const EXPLICIT = process.env.CHROME_PATH || "/opt/pw-browsers/chromium";
const CHROME = fs.existsSync(EXPLICIT) ? EXPLICIT : undefined;
const PORT = Number(process.env.E2E_PORT || 3399);
const BASE = `http://localhost:${PORT}`;
const DB = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tenancy-e2e-")), "db.json");

// One nonce per run, so a rerun against a leftover database cannot pass on stale rows.
const NONCE = Math.random().toString(36).slice(2, 10);
const PASSWORD = "TenantPass123!";

const failures = [];
const passes = [];

const waitPort = (port, ms = 90_000) =>
  new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => {
        s.destroy();
        resolve();
      });
      s.once("error", () => {
        s.destroy();
        if (Date.now() - t0 > ms) reject(new Error(`port ${port} never opened`));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });

const server = spawn("pnpm", ["dev"], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DEMO_MODE: "true",
    DEMO_DB_PATH: DB,
    // The whole point. Without it every signup lands in org 1 and there is nothing
    // to isolate.
    SIGNUP_MODE: "self-serve",
    VITE_APP_URL: BASE,
  },
  stdio: "ignore",
  detached: true,
});

const stop = () => {
  try {
    process.kill(-server.pid);
  } catch {}
  try {
    fs.rmSync(path.dirname(DB), { recursive: true, force: true });
  } catch {}
};

await waitPort(PORT);
if (!(await fetch(`${BASE}/login`).then(r => r.ok).catch(() => false))) {
  console.log(`\n  ✘ tenancy e2e: nothing serving on ${BASE}\n`);
  stop();
  process.exit(1);
}

const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

async function step(name, fn) {
  try {
    await fn();
    passes.push(name);
  } catch (e) {
    failures.push({ name, detail: String(e.message || e).split("\n")[0].slice(0, 200) });
  }
}

/** A fresh browser context — its own cookie jar, i.e. its own person. */
async function person() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  return { ctx, page };
}

/** Call the real tRPC API from inside a signed-in page, with that page's cookie. */
async function trpc(page, procedure, input) {
  return page.evaluate(
    async ({ procedure, input }) => {
      const opts = input
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ json: input }),
          }
        : { method: "GET" };
      const res = await fetch(`/api/trpc/${procedure}`, { ...opts, credentials: "include" });
      const body = await res.json();
      if (body.error) throw new Error(body.error.json?.message || "trpc error");
      return body.result?.data?.json ?? body.result?.data;
    },
    { procedure, input }
  );
}

/** Sign up through the real form and return what the last screen said. */
async function signUp(page, name, email) {
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.fill('input[placeholder="John Doe"]', name);
  await page.fill('input[type="email"]', email);
  await page.fill('input[placeholder="At least 8 characters"]', PASSWORD);
  await page.fill('input[placeholder="Confirm your password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Demo mode prints the code rather than mailing it, so verification is walkable.
  const code = await page
    .locator("span.tabular-nums.font-semibold")
    .first()
    .textContent()
    .catch(() => null);
  if (code && /^\d{6}$/.test(code.trim())) {
    await page.fill('input[placeholder="123456"]', code.trim());
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
  }
  return (await page.locator("body").innerText()).replace(/\s+/g, " ");
}

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3500);
  assert(!page.url().includes("/login"), `${email} could not sign in`);
}

const acme = `acme-${NONCE}@example.com`;
const globex = `globex-${NONCE}@example.com`;
const teammate = `teammate-${NONCE}@example.com`;
const PRIVATE = `ACME-PRIVATE-${NONCE}`;
const IMPORTED_A = `AcmeImported${NONCE}`;

const A = await person();
const B = await person();
const T = await person();
let acceptUrl = null;

// ── 1. a new customer signs up and is told the truth ────────────────────────
await step("a self-serve signup is not told to wait for an approval it already has", async () => {
  const screen = await signUp(A.page, "Acme Sales", acme);
  // The defect: the server had already approved this account, created its organization
  // and made it an admin, and this screen sent them away to wait for an email.
  assert(
    !/Pending Approval/i.test(screen),
    `signup ended on "Account Pending Approval" for a self-serve customer: ${screen.slice(0, 160)}`
  );
  assert(
    /workspace is ready/i.test(screen),
    `signup did not say the workspace was ready: ${screen.slice(0, 160)}`
  );
});

// ── 2. and can actually get in ──────────────────────────────────────────────
await step("that customer can sign in immediately, with no admin involved", async () => {
  await signIn(A.page, acme);
});

await step("their workspace starts empty rather than holding someone else's data", async () => {
  // A brand-new organization seeing the demo tenant's accounts would be the same bug
  // from the other side.
  const calls = await trpc(A.page, "calls.list");
  assert(Array.isArray(calls), "calls.list did not return a list");
  assert(calls.length === 0, `a new workspace already had ${calls.length} calls in it`);
});

// ── 2b. and the empty workspace says what it is ─────────────────────────────
await step("an empty workspace says so, instead of blaming the filters", async () => {
  // What a paying customer actually met on their first screen: "No accounts found ·
  // Try adjusting your filters", and the same sentence again on contacts. Every word
  // true about a filtered search, said to someone who has never imported a row — it
  // sends them to fix a filter that is not the problem, and no screen reachable from
  // there says what is.
  for (const route of ["/accounts", "/contacts"]) {
    await A.page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
    await A.page
      .waitForSelector("[data-route-loading]", { state: "detached", timeout: 15_000 })
      .catch(() => {});
    await A.page.waitForTimeout(3000);
    const screen = (await A.page.locator("body").innerText()).replace(/\s+/g, " ");
    assert(
      !/Try adjusting your filters/i.test(screen),
      `${route} told a brand-new workspace to adjust its filters`
    );
    // And it must offer a way out, not just a nicer dead end. The import route is
    // walked for real in the next step — a link that goes nowhere useful would be this
    // component's own defect wearing its fix.
    assert(
      /Connect a tool/i.test(screen) && /Import your data/i.test(screen),
      `${route} said the workspace was empty but offered no way to fill it`
    );
  }
});

// ── 2c. and the way out of it actually works ────────────────────────────────
await step("the empty state's import link fills the workspace it came from", async () => {
  // The link is the promise. /csv-processor looked like the obvious place to send
  // someone and builds a file for Salesforce or HubSpot while writing nothing back —
  // they would have mapped every column and returned to the same empty page. So the
  // route this offers is walked: paste rows, import, and see them in the list.
  await A.page.goto(`${BASE}/accounts`, { waitUntil: "domcontentloaded" });
  await A.page.waitForTimeout(2500);
  await A.page.getByRole("link", { name: /Import your data/i }).first().click();
  await A.page.waitForTimeout(2500);
  assert(A.page.url().includes("/import"), `the import link went to ${A.page.url()}`);

  // A lead list: one row per person with their company beside them, which is the shape
  // a customer actually exports. Both records have to come out of it — an accounts-only
  // import left the contacts page pointing at something that could not fill it.
  await A.page.locator("textarea").first().fill(
    `first name,last name,email,job title,company,website\n` +
      `Jordan,Okonkwo,jordan-${NONCE}@acme.example,VP Engineering,${IMPORTED_A},https://www.acme-${NONCE}.example/\n` +
      `Priya,Raman,priya-${NONCE}@globex.example,Head of Security,Second Co,globex-${NONCE}.example`
  );
  await A.page.getByRole("button", { name: /^Import/i }).first().click();
  await A.page.waitForTimeout(3500);

  const said = (await A.page.locator("body").innerText()).replace(/\s+/g, " ");
  assert(
    /2 accounts and 2 contacts in your workspace/i.test(said),
    `the import did not report two accounts and two contacts: ${said.slice(said.indexOf("Import"), 320)}`
  );
  assert(
    /0 rows skipped/i.test(said),
    `an ordinary lead list had rows skipped: ${said.slice(said.indexOf("Accounts:"), 260)}`
  );

  // And the claim has to be true on the page that lists them, not just in the toast.
  await A.page.goto(`${BASE}/accounts`, { waitUntil: "domcontentloaded" });
  await A.page.waitForTimeout(3500);
  const list = (await A.page.locator("body").innerText()).replace(/\s+/g, " ");
  assert(list.includes(IMPORTED_A), `${IMPORTED_A} was reported imported but is not listed`);
  assert(
    !/This workspace is empty/i.test(list),
    "the workspace still reported itself empty after a successful import"
  );

  // The contacts half, on the page whose empty state sent them here.
  await A.page.goto(`${BASE}/contacts`, { waitUntil: "domcontentloaded" });
  await A.page.waitForTimeout(3500);
  const people = (await A.page.locator("body").innerText()).replace(/\s+/g, " ");
  assert(people.includes("Okonkwo"), "the imported contact is not on the contacts page");
  assert(
    !/This workspace is empty/i.test(people),
    "contacts still reported itself empty after importing contacts"
  );
});

// ── 3. they write something private ─────────────────────────────────────────
await step("what they write is theirs", async () => {
  await trpc(A.page, "calls.create", { title: PRIVATE });
  const mine = await trpc(A.page, "calls.list");
  assert(
    mine.some(c => c.title === PRIVATE),
    "the record just written was not in the writer's own list"
  );
});

// ── 4. the commercial promise ───────────────────────────────────────────────
await step("a second customer cannot see the first one's data", async () => {
  const screen = await signUp(B.page, "Globex Sales", globex);
  assert(!/Pending Approval/i.test(screen), "second signup was sent to the approval queue");
  await signIn(B.page, globex);
  const theirs = await trpc(B.page, "calls.list");
  assert(
    !theirs.some(c => c.title === PRIVATE),
    `a different customer could read ${PRIVATE} — tenants are not isolated`
  );

  // Import is a write path of its own, and a new one. Its own scoping is asserted here
  // rather than assumed from the call above.
  const theirAccounts = await trpc(B.page, "accounts.list");
  assert(
    !theirAccounts.some(a => a.name === IMPORTED_A),
    `a different customer could read the account ${IMPORTED_A} — import is not org-scoped`
  );
  assert(theirAccounts.length === 0, `a new workspace held ${theirAccounts.length} accounts`);
});

// ── 5. an admin invites a colleague, through the UI ─────────────────────────
await step("an admin can issue an invitation and is shown the link", async () => {
  await A.page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await A.page.waitForTimeout(2500);
  await A.page.fill('input[placeholder="colleague@company.com"]', teammate);
  await A.page.getByRole("button", { name: "Invite" }).click();
  await A.page.waitForTimeout(2500);
  const link = await A.page.locator("code").first().textContent();
  assert(link && link.includes("/accept-invite?token="), `no invitation link appeared (${link})`);
  acceptUrl = link.trim();
});

// ── 6. the colleague joins THAT workspace, not a new empty one ──────────────
await step("an invited colleague lands inside the inviting organization", async () => {
  assert(acceptUrl, "no invitation link to accept");
  await T.page.goto(acceptUrl, { waitUntil: "domcontentloaded" });
  await T.page.waitForTimeout(2500);
  await T.page.fill("#name", "Acme Teammate");
  await T.page.fill("#password", PASSWORD);
  await T.page.fill("#confirm", PASSWORD);
  await T.page.click('button[type="submit"]');
  await T.page.waitForTimeout(3000);

  await signIn(T.page, teammate);
  const theirs = await trpc(T.page, "calls.list");
  // The whole reason invitations exist: signing up on their own would have given this
  // person an empty workspace of their own instead of their colleague's.
  assert(
    theirs.some(c => c.title === PRIVATE),
    "an invited colleague could not see the workspace they were invited into"
  );
});

// ── 7. the link is spent ────────────────────────────────────────────────────
await step("the same invitation link cannot be used twice", async () => {
  const second = await person();
  await second.page.goto(acceptUrl, { waitUntil: "domcontentloaded" });
  await second.page.waitForTimeout(2500);
  const screen = (await second.page.locator("body").innerText()).replace(/\s+/g, " ");
  // A forwarded link opened by a second person must not quietly hand out another seat.
  assert(
    /already been used|no longer|expired|invalid|revoked/i.test(screen),
    `a spent invitation still offered a signup form: ${screen.slice(0, 160)}`
  );
  await second.ctx.close();
});

await browser.close();
stop();

const width = Math.max(...passes.concat(failures.map(f => f.name)).map(s => s.length), 0);
console.log("");
for (const p of passes) console.log(`  ✓ ${p}`);
for (const f of failures) console.log(`  ✘ ${f.name.padEnd(width)}  ${f.detail}`);
console.log(`\n${passes.length} passed, ${failures.length} failed\n`);
process.exit(failures.length ? 1 : 0);
