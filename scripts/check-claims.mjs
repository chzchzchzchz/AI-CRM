#!/usr/bin/env node
/**
 * Static truth checks — the ones that don't need a browser.
 *
 * Every rule here exists because the thing it checks was actually wrong in this
 * repo and shipped, and was found by a person reading the page rather than by
 * anything automated. A rule without that history doesn't belong here; a defect
 * found by hand does, so it can never be found by hand twice.
 *
 * Exits non-zero on any violation. Wired into `pnpm verify` and CI.
 */
import fs from "node:fs";
import path from "node:path";
import { auditTenancyFull } from "./tenancy-audit.mjs";

const ROOT = process.cwd();
const failures = [];
const checks = [];

const fail = (rule, detail) => failures.push({ rule, detail });
const ok = rule => checks.push(rule);

/**
 * Blank comments before scanning source.
 *
 * Without this, a comment explaining that a defect was removed trips the rule that
 * detects the defect — this file's first run flagged its own documentation of the
 * fabricated-filenames fix. The capability crawler had the identical bug.
 */
function stripComments(src) {
  return src
    // Newlines are preserved, so a line number computed from the stripped text still
    // points at the same line of the original. The first version replaced a block
    // comment with spaces of the same TOTAL length, which ate its newlines — every line
    // number after a `/* … */` was wrong, silently. Rule 18 reports file:line and reads
    // the raw file for an exemption marker near that line, so both would have pointed at
    // unrelated code; the same defect was found and fixed in scripts/tenancy-audit.mjs.
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // `.worktrees/` holds gitignored scratch checkouts. CI never sees them, so scanning
      // them locally only produces failures for code that isn't in the repo.
      if (
        e.name === "node_modules" ||
        e.name === "dist" ||
        e.name === ".git" ||
        e.name === ".worktrees"
      )
        continue;
      walk(full, exts, acc);
    } else if (exts.some(x => e.name.endsWith(x))) acc.push(full);
  }
  return acc;
}

/* ------------------------------------------------------------------ 1. type */
/**
 * Nothing may hardcode a font size below the smallest scale token.
 *
 * The scale was raised because 60% of the dashboard rendered at 12px or less;
 * 33 hardcoded `text-[10px]`/`text-[11px]` were bypassing the tokens entirely,
 * so fixing the tokens alone would not have reached them.
 */
{
  const offenders = [];
  for (const file of walk(path.join(ROOT, "client", "src"), [".tsx", ".ts"])) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of src.matchAll(/text-\[(\d+(?:\.\d+)?)(px|rem)\]/g)) {
      const px = m[2] === "rem" ? parseFloat(m[1]) * 16 : parseFloat(m[1]);
      if (px < 12) offenders.push(`${path.relative(ROOT, file)}: ${m[0]} (${px}px)`);
    }
  }
  offenders.length
    ? fail("no hardcoded type below 12px", offenders.join("\n    "))
    : ok("no hardcoded type below 12px");
}

/* ----------------------------------------------------------------- 2. links */
/** Every relative link in the docs must resolve. Five once pointed at Google searches. */
{
  const broken = [];
  const docs = [...walk(ROOT, [".md"])].filter(
    f => !f.includes("node_modules") && !f.includes("/dist/")
  );
  for (const file of docs) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/\]\(([^)\s#]+)\)/g)) {
      const target = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(target)) {
        if (target.includes("google.com/search"))
          broken.push(`${path.relative(ROOT, file)}: search-engine link → ${target}`);
        continue;
      }
      const resolved = path.resolve(path.dirname(file), target.split("#")[0]);
      if (!fs.existsSync(resolved))
        broken.push(`${path.relative(ROOT, file)}: dead link → ${target}`);
    }
  }
  broken.length ? fail("docs links resolve", broken.join("\n    ")) : ok("docs links resolve");
}

/* ------------------------------------------------------- 3. advertised data */
/**
 * Numbers the README quotes about the demo dataset must match the dataset.
 * They were once wrong by two orders of magnitude — 16 accounts advertised
 * against 1,000 actual — which makes every other figure on the page suspect.
 */
{
  const seedPath = path.join(ROOT, "demo-db.seed.json");
  const readmePath = path.join(ROOT, "README.md");
  if (!fs.existsSync(seedPath) || !fs.existsSync(readmePath)) {
    ok("README matches the seed (skipped — file missing)");
  } else {
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    const readme = fs.readFileSync(readmePath, "utf8");
    const n = k => (seed[k] || []).length;

    // Any comma-grouped integer the README claims, checked against the real counts.
    const claimed = k => {
      const re = new RegExp(`([\\d,]+)\\s+${k}`, "i");
      const m = readme.match(re);
      return m ? Number(m[1].replace(/,/g, "")) : null;
    };

    const bad = [];
    const check = (label, actual, said) => {
      if (said !== null && said !== actual)
        bad.push(`README says ${said.toLocaleString()} ${label}, seed has ${actual.toLocaleString()}`);
    };

    for (const [label, actual] of [
      ["accounts", n("accounts")],
      ["contacts", n("contacts")],
      ["calls", n("calls")],
      ["RFPs", n("rfps")],
    ]) {
      check(label, actual, claimed(label));
    }

    // The rest of the block, each phrased its own way.
    //
    // Only accounts and contacts used to be checked, while the caption under the block
    // says `pnpm check:claims` "fails the build if this block drifts from the data" —
    // a claim about verification that was broader than the verification. Eight of the
    // ten numbers could have gone stale in silence, on the one page whose whole argument
    // is that its numbers are checked. They were all correct when this was widened; that
    // is luck, not a control.
    const accounts = seed.accounts || [];
    const opps = seed.opportunities || [];
    const scoreOf = a => a.intentScore || 0;
    const openOpps = opps.filter(o => !String(o.stage || "").toLowerCase().startsWith("closed"));

    const num = re => {
      const m = readme.match(re);
      return m ? Number(m[1].replace(/,/g, "")) : null;
    };

    check("accounts with intent data", accounts.filter(a => a.intentScore).length,
      num(/([\d,]+)\s+with intent data/i));
    check("accounts at intent 70+", accounts.filter(a => scoreOf(a) >= 70).length,
      num(/([\d,]+)\s+accounts at intent 70\+/i));
    check("accounts at intent 40–69", accounts.filter(a => scoreOf(a) >= 40 && scoreOf(a) <= 69).length,
      num(/([\d,]+)\s+at 40[–-]69/i));
    check("open opportunities", openOpps.length, num(/([\d,]+)\s+open opportunities/i));
    check("intent-score history points", n("intentScores"),
      num(/([\d,]+)\s+intent-score history points/i));

    // Pipeline is quoted to one decimal in millions, so compare at that precision
    // rather than demanding an exact match on a rounded figure.
    const pipeline = openOpps.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const saidPipeline = readme.match(/\$([\d.]+)M open pipeline/i);
    if (saidPipeline) {
      const claimedM = Number(saidPipeline[1]);
      const actualM = Math.round((pipeline / 1_000_000) * 10) / 10;
      if (claimedM !== actualM)
        bad.push(`README says $${claimedM}M open pipeline, seed has $${actualM}M`);
    }

    bad.length
      ? fail("README matches the seed", bad.join("\n    "))
      : ok(`README matches the seed (10 figures)`);
  }
}

/* ------------------------------------------------------------ 4. capability */
/**
 * Nothing may be built and left unreachable. `pnpm inventory` writes the count;
 * this asserts it is zero, so a new procedure without a caller fails the build
 * rather than sitting in a list nobody reads.
 */
{
  const capPath = path.join(ROOT, "docs", "CAPABILITIES.md");
  if (!fs.existsSync(capPath)) {
    fail("capability report present", "docs/CAPABILITIES.md missing — run `pnpm inventory`");
  } else {
    const cap = fs.readFileSync(capPath, "utf8");
    const m = cap.match(/\*\*Built but not routed anywhere\*\*\s*\|\s*\*\*(\d+)\*\*/);
    if (!m) fail("capability report parseable", "could not find the unrouted count");
    else if (Number(m[1]) > 0)
      fail("nothing unrouted", `${m[1]} procedures built but unreachable — see docs/CAPABILITIES.md`);
    else ok("nothing unrouted");
  }
}

/* ------------------------------------------------------------ 5. first run */
/**
 * The seeded demo user must actually be able to log in.
 *
 * Both seeded users shipped with `passwordHash: null` and the login path rejects
 * exactly that — so a fresh clone reached the sign-in screen and could go no
 * further. Signup needs admin approval, and the admin could not log in either.
 * The README promised a working demo in about two minutes; the entire dataset was
 * unreachable. Nothing caught it because nobody had cloned it fresh in months.
 */
{
  const seedPath = path.join(ROOT, "demo-db.seed.json");
  if (!fs.existsSync(seedPath)) {
    ok("demo user can sign in (skipped — no seed)");
  } else {
    const users = JSON.parse(fs.readFileSync(seedPath, "utf8")).users || [];
    const usable = users.filter(
      u => typeof u.passwordHash === "string" && u.passwordHash.startsWith("$2") && u.isApproved
    );
    usable.length
      ? ok(`demo user can sign in (${usable.length} seeded)`)
      : fail(
          "demo user can sign in",
          "no seeded user has both a bcrypt passwordHash and isApproved — a fresh clone cannot get past /login"
        );
  }
}

/* --------------------------------------------------------------- 6. honesty */
/**
 * Phrases that describe generated output as something it isn't. Each of these
 * was a real claim in this repo: a two-branch string template called
 * "AI-generated", and a hardcoded list of filenames presented as the documents
 * an answer was drawn from.
 */
{
  const banned = [
    [/Product Overview\.pdf/, "hardcoded filename presented as a real RAG source"],
    [/Competitor Analysis\.docx/, "hardcoded filename presented as a real RAG source"],
    [/Simulate RAG sources/i, "fabricated sources"],
    [/Simulate other content types/i, "placeholder generation described as real"],
  ];
  const hits = [];
  for (const file of walk(path.join(ROOT, "client", "src"), [".tsx", ".ts"])) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    for (const [re, why] of banned)
      if (re.test(src)) hits.push(`${path.relative(ROOT, file)}: ${why}`);
  }
  hits.length ? fail("no fabricated evidence", hits.join("\n    ")) : ok("no fabricated evidence");
}

/* --------------------------------------------------------------- 7. meaning */
/**
 * A word that appears on screen must mean one thing.
 *
 * "Decision makers" was a tile on /insights and a tile on /contacts. Over the same
 * 1,500 contacts, Insights matched seventeen title tokens and said 790; Contacts
 * matched nine and said 619. Each was correct against its own private regex, and
 * the two pages are two clicks apart. There were eight of those regexes — Insights,
 * Contacts twice, Outreach, priority-actions, hot-leads, intel/signals and ai.ts
 * — no two alike, and one of them read "Vice President" as "President".
 *
 * There is now one, in shared/taxonomy.ts. This rule is what stops a ninth: any
 * file that lists three or more executive title tokens is building its own
 * taxonomy, whatever it calls the variable.
 */
{
  const TITLE_TOKENS = /\b(ciso|cto|cio|cfo|ceo|coo|cmo|cro|svp|evp|vice president|c-level)\b/gi;
  const CANONICAL = path.join("shared", "taxonomy.ts");
  const hits = [];
  const sources = [
    ...walk(path.join(ROOT, "client", "src"), [".tsx", ".ts"]),
    ...walk(path.join(ROOT, "server"), [".ts"]),
    ...walk(path.join(ROOT, "shared"), [".ts"]),
  ];
  for (const file of sources) {
    const rel = path.relative(ROOT, file);
    // The definition itself, and tests that must be able to name titles literally.
    if (rel === CANONICAL || rel.endsWith(".test.ts") || rel.endsWith(".spec.ts")) continue;
    const src = stripComments(fs.readFileSync(file, "utf8"));
    // Only lines that look like a pattern or a list — a title inside a prose string,
    // a demo transcript or a placeholder is someone writing English, not classifying.
    for (const line of src.split("\n")) {
      if (!/[/[]/.test(line)) continue;
      const found = [...new Set((line.match(TITLE_TOKENS) || []).map(s => s.toLowerCase()))];
      if (found.length >= 3) hits.push(`${rel}: ${found.join(", ")} — import from @shared/taxonomy`);
    }
  }
  hits.length
    ? fail("one job-title taxonomy", hits.join("\n    "))
    : ok("one job-title taxonomy");
}

/* ----------------------------------------------------------------- 8. tests */
/**
 * Every test file must actually be run.
 *
 * shared/taxonomy.test.ts was written, committed and reported green while never
 * executing once: the vitest `include` glob covered `server/**` only, so the file
 * was invisible to the runner. A test outside the glob is worse than no test —
 * it looks like coverage. When it was finally wired in it failed immediately, on
 * the "Vice President" bug above.
 */
{
  const cfgPath = path.join(ROOT, "vitest.config.ts");
  if (!fs.existsSync(cfgPath)) {
    ok("every test file runs (skipped — no vitest config)");
  } else {
    const cfg = fs.readFileSync(cfgPath, "utf8");
    const block = cfg.match(/include:\s*\[([\s\S]*?)\]/);
    const globs = block ? [...block[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map(m => m[1]) : [];
    // "server/**/*.test.ts" → the directory it roots at.
    const roots = globs.map(g => g.split("/**")[0]).filter(Boolean);
    const orphans = walk(ROOT, [".test.ts", ".spec.ts"])
      .map(f => path.relative(ROOT, f))
      .filter(rel => !rel.startsWith("node_modules") && !rel.startsWith("dist"))
      .filter(rel => !roots.some(r => rel.startsWith(r + path.sep)));
    orphans.length
      ? fail(
          "every test file runs",
          `${orphans.join(", ")} — not matched by any vitest include glob (${globs.join(", ")})`
        )
      : ok(`every test file runs (${globs.length} globs)`);
  }
}

/* ------------------------------------------------------------------- 9. llm */
/**
 * A caller that reads model output must be able to tell it apart from an apology.
 *
 * With no key and no local Ollama, invokeLLM degrades to a readable note rather than
 * throwing. That is the right behaviour and it was invisible: every caller did
 * `response.choices[0].message.content` and passed it on, so the note became the
 * account summary, the chat reply, the generated blog post — and got written to the
 * content library and the context store as though a model had produced it.
 *
 * Reading `choices[0]` directly is now the thing to look for. Use `llmText()`, which
 * returns `{ content, available }`, and say something honest when available is false.
 */
{
  const offenders = [];
  for (const file of walk(path.join(ROOT, "server"), [".ts"])) {
    const rel = path.relative(ROOT, file);
    if (rel === path.join("server", "_core", "llm.ts")) continue; // defines it
    if (rel.endsWith(".test.ts")) continue;
    const src = stripComments(fs.readFileSync(file, "utf8"));
    if (!/\binvokeLLM\s*\(/.test(src)) continue;

    // Reaching into the response shape by hand bypasses the check entirely.
    const raw = [...src.matchAll(/\.choices\s*\[\s*0\s*\]/g)].length;
    if (raw) {
      offenders.push(`${rel}: reads choices[0] ${raw}× directly — use llmText()`);
      continue;
    }

    // Every llmText() call must be destructured so `available` is actually bound.
    //
    // Two weaker versions of this rule shipped green before this one. The first only
    // asked whether llmText appeared in the file — a mechanical substitution turned
    // seven files green without handling a single outage. The second asked whether
    // the word "available" appeared anywhere, which three files satisfied with the
    // string "Database not available". Match the binding, not the vocabulary.
    const calls = [...src.matchAll(/\bllmText\s*\(/g)].length;
    const bound = [...src.matchAll(/\{[^}]*\bavailable\b[^}]*\}\s*=\s*llmText\s*\(/g)].length;
    if (calls > bound) {
      offenders.push(
        `${rel}: ${calls - bound} of ${calls} llmText() calls drop \`available\` — ` +
          `destructure it and say something honest when it is false`
      );
    }
  }
  offenders.length
    ? fail("LLM callers check availability", offenders.join("\n    "))
    : ok("LLM callers check availability");
}

/* ------------------------------------------------------------ 10. two impls */
/**
 * No server module may be unreachable from the router.
 *
 * server/account-summary.ts and server/contact-summary.ts were complete, plausible
 * implementations of generateAccountSummary and generateContactSummary that nothing
 * imported — the live versions live in aiContext.ts. Fixing the availability bug, I
 * opened the obviously-named file, edited it, and fixed nothing. A dead file with
 * the right name is worse than no file, because it answers the question you were
 * about to ask.
 */
{
  const entry = new Set();
  const queue = ["server/_core/index.ts", "server/routers.ts"];
  const resolve = (fromFile, spec) => {
    if (spec.startsWith("@shared/")) return path.join(ROOT, "shared", spec.slice(8) + ".ts");
    if (!spec.startsWith(".")) return null;
    const base = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
    for (const c of [`${base}.ts`, path.join(base, "index.ts")]) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  };
  while (queue.length) {
    const rel = queue.pop();
    if (entry.has(rel) || !fs.existsSync(path.join(ROOT, rel))) continue;
    entry.add(rel);
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    for (const m of src.matchAll(/(?:from|import\()\s*["']([^"']+)["']/g)) {
      const target = resolve(rel, m[1]);
      if (target) queue.push(path.relative(ROOT, target));
    }
  }
  const orphans = walk(path.join(ROOT, "server"), [".ts"])
    .map(f => path.relative(ROOT, f))
    .filter(rel => !rel.endsWith(".test.ts") && !rel.includes("_core") && !entry.has(rel))
    // Entry points, tooling and test helpers are run directly or imported by tests,
    // neither of which the router graph can see.
    .filter(
      rel =>
        ![
          "server/inventory.ts",
          "server/mcp-server.ts",
          "server/doctor.ts",
          "server/test-utils.ts",
        ].includes(rel)
    );
  orphans.length
    ? fail(
        "no unreachable server modules",
        `${orphans.join(", ")} — not reachable from routers.ts or _core/index.ts. ` +
          `Delete it, or wire it up; a dead file with a plausible name gets edited by mistake.`
      )
    : ok("no unreachable server modules");
}

/* ------------------------------------------------------- 11. advertised keys */
/**
 * A connector you can configure must be a connector that does something.
 *
 * `GONG_API_KEY` was in the integration registry, `pnpm doctor` reported it "ready"
 * when set, SETUP.md documented where to get it, and the README had a "Gong Call
 * Intelligence" section. There was no Gong client. Not an unfinished one — none. The
 * key was decoration, and setting it changed nothing.
 *
 * Nothing could have caught that: the capability inventory counts tRPC procedures, the
 * unreachable-module check finds files nobody imports, and neither notices a vendor
 * that was never coded against at all. This walks the other way — from the credential
 * the app asks you for, to the code that spends it.
 *
 * Inbound-only connectors (a webhook we receive, rather than an API we call) are
 * listed explicitly, because "no outbound client" is correct for those.
 */
{
  const regPath = path.join(ROOT, "server", "integrations", "registry.ts");
  if (!fs.existsSync(regPath)) {
    ok("advertised connectors have a client (skipped — no registry)");
  } else {
    // Connectors that receive data rather than fetch it, so no outbound client exists.
    const INBOUND_ONLY = new Set(["clay"]);

    const reg = fs.readFileSync(regPath, "utf8");
    const keys = [...reg.matchAll(/key:\s*"([^"]+)"/g)].map(m => m[1]);

    // A client is one of exactly two things, both precise:
    //
    //   1. a dedicated module named for the vendor, or
    //   2. an exported function in connectors.ts whose name starts with the vendor key
    //
    // The first version of this rule asked whether any file "mentions the vendor and
    // contains fetch(". Deleting server/integrations/gong.ts entirely left the rule
    // green, because routers.ts mentions gong and contains a fetch somewhere. Naming
    // the implementation is the only thing a missing implementation cannot satisfy.
    const connectorsPath = path.join(ROOT, "server", "integrations", "connectors.ts");
    const inlineExports = fs.existsSync(connectorsPath)
      ? [
          ...stripComments(fs.readFileSync(connectorsPath, "utf8")).matchAll(
            /export\s+(?:async\s+)?function\s+(\w+)/g
          ),
        ].map(m => m[1].toLowerCase())
      : [];

    const hasModule = key =>
      [
        path.join(ROOT, "server", `${key}.ts`),
        path.join(ROOT, "server", "integrations", `${key}.ts`),
      ].some(p => fs.existsSync(p) && /\bfetch\s*\(|\baxios\b/.test(fs.readFileSync(p, "utf8")));

    const orphans = [];
    for (const key of keys) {
      if (INBOUND_ONLY.has(key)) continue;
      const served = hasModule(key) || inlineExports.some(fn => fn.startsWith(key.toLowerCase()));
      if (!served) orphans.push(key);
    }

    orphans.length
      ? fail(
          "advertised connectors have a client",
          `${orphans.join(", ")} — the registry asks for credentials that no code spends. ` +
            `Write the client, mark it inbound-only, or stop advertising it.`
        )
      : ok(`advertised connectors have a client (${keys.length} checked)`);
  }
}

/* ------------------------------------------------------- 12. tests that pass */
/**
 * A test must be able to fail.
 *
 * server/sixsense.test.ts contained one test that called the live 6sense API and,
 * with no key configured, did this:
 *
 *     if (!apiKey) {
 *       console.log("Skipping 6sense test - no API key configured");
 *       return;
 *     }
 *
 * No key is ever configured in CI, so it returned immediately having asserted
 * nothing, on every run this repo has ever had. It passed. It counted toward the
 * total. It is why a survey of connector coverage reported 6sense as tested.
 *
 * Bailing out is the right instinct — a suite must not need a vendor key. The wrong
 * part is bailing out *silently into a pass*. Skip properly (`it.skip`, or `this.skip()`)
 * so the runner reports it, or assert something that does not need the key.
 */
{
  const offenders = [];
  const testFiles = walk(ROOT, [".test.ts"])
    .map(f => path.relative(ROOT, f))
    .filter(rel => !rel.startsWith("node_modules") && !rel.startsWith("dist"));

  for (const rel of testFiles) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    // Each test body, roughly: from `it("…"` to the next one.
    const blocks = src.split(/\b(?:it|test)\s*(?:\.\w+)?\s*\(/).slice(1);
    for (const block of blocks) {
      const bare = block.search(/(?:^|\n)\s*return\s*;/);
      if (bare === -1) continue;
      const firstExpect = block.search(/\bexpect\s*\(/);
      // A bare `return;` reached before this test has asserted anything at all.
      if (firstExpect === -1 || bare < firstExpect) {
        const name = (block.match(/^\s*["'`]([^"'`]{0,70})/) || [, "(unnamed)"])[1];
        offenders.push(`${rel}: "${name}" can return before asserting anything`);
        break; // one report per file is enough to go and look
      }
    }
  }

  offenders.length
    ? fail(
        "no test can pass without asserting",
        offenders.join("\n    ") +
          "\n    Use it.skip so the runner reports it, or assert something that needs no credentials."
      )
    : ok(`no test can pass without asserting (${testFiles.length} files)`);
}

/* ------------------------------------------------- 13. headline stats drift */
/**
 * The README's own opening line quotes a test count and a line count — plain
 * numbers with no automated check behind them, which is exactly how they went
 * stale: "326 tests, ~45k lines" sat there through several PRs that added both
 * tests and code, on the same page whose own table calls "a number that isn't
 * the number it's labelled" out by name as the failure this project exists to
 * catch. Rule 3 checks the demo-dataset numbers the same way; this is the
 * codebase's own two headline stats.
 *
 * The identical "326 tests" figure was ALSO quoted in docs/DEVELOPMENT.md's
 * `pnpm test` row — fixing the README's copy didn't touch it, because nothing
 * connected the two. Checked here too, by the specific table-row text rather
 * than a bare "number near the word tests" scan, since that file is otherwise
 * full of intentionally-historical counts (defects a rule was written to catch)
 * that must never be "corrected" to match the present.
 */
{
  const readmePath = path.join(ROOT, "README.md");
  const devPath = path.join(ROOT, "docs", "DEVELOPMENT.md");

  // Same block-split technique as rule 12, over the files rule 8 confirms are
  // actually wired into the runner — a floor, not an exact count: it.each and
  // friends expand to more cases at runtime than there are call sites in source.
  const testFiles = walk(ROOT, [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"])
    .map(f => path.relative(ROOT, f))
    .filter(rel => !rel.startsWith("node_modules") && !rel.startsWith("dist"));
  let testCount = 0;
  for (const rel of testFiles) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    testCount += src.split(/\b(?:it|test)\s*(?:\.\w+)?\s*\(/).length - 1;
  }

  const bad = [];
  const checkTestClaim = (label, text, re) => {
    const m = text.match(re);
    if (!m) return;
    const claimed = Number(m[1].replace(/,/g, ""));
    if (claimed < testCount * 0.75 || claimed > testCount * 1.5) {
      bad.push(
        `${label} says ${claimed} tests, ${testCount} found in source (a floor — it.each expands at runtime, so the true count is normally somewhat higher)`
      );
    }
  };

  if (fs.existsSync(readmePath)) {
    checkTestClaim("README.md", fs.readFileSync(readmePath, "utf8"), /([\d,]+)\s+tests\b/i);
  }
  if (fs.existsSync(devPath)) {
    checkTestClaim(
      "docs/DEVELOPMENT.md",
      fs.readFileSync(devPath, "utf8"),
      /`pnpm test`[^|\n]*\|[^|\n]*?([\d,]+)\s+tests/i
    );
  }

  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, "utf8");

    // The three real source roots — same ones the rest of this file treats as "the
    // app" (e.g. rule 9's server-only LLM scan).
    let totalLines = 0;
    for (const root of ["server", "client/src", "shared"]) {
      for (const f of walk(path.join(ROOT, root), [".ts", ".tsx"])) {
        totalLines += fs.readFileSync(f, "utf8").split("\n").length;
      }
    }
    const linesMatch = readme.match(/~([\d,]+)k lines/i);
    if (linesMatch) {
      const claimedLines = Number(linesMatch[1].replace(/,/g, "")) * 1000;
      if (claimedLines < totalLines * 0.7 || claimedLines > totalLines * 1.3) {
        bad.push(
          `README says ~${linesMatch[1]}k lines, ${Math.round(totalLines / 1000)}k found under server/, client/src/, shared/`
        );
      }
    }
  }

  bad.length
    ? fail("README headline stats", bad.join("\n    "))
    : ok("README headline stats");
}

/* ------------------------------------------------------ 14. shared auth state */
/**
 * Auth throttling state must not live in a module-level Map.
 *
 * Rate limiting, login lockout, the send cooldown and 2FA challenges were four
 * module-level Maps. Correct for exactly one process, and silently wrong for two: each
 * instance keeps its own counters, so an attacker gets N instances x 5 login attempts,
 * and a 2FA challenge minted by one instance cannot be redeemed by another. Nothing in
 * the app surfaces either failure — it looks like it is throttling and isn't.
 *
 * They now go through server/_core/shared-store.ts, which is per-process by default and
 * Redis-backed when REDIS_URL is set. The regression to catch is someone adding the
 * fifth one: a `const x = new Map()` at module scope in an auth file is how all four of
 * the originals got there, one reasonable-looking commit at a time.
 */
{
  const AUTH_FILES = [
    "server/_core/security.ts",
    "server/twofa.ts",
    "server/email-verification-router.ts",
  ];

  // In-process concurrency primitives are not throttling state and are exempt by name.
  // Anything else holding auth state per process is the bug this rule exists for.
  const ALLOWED = new Set(["userLocks"]);

  const offenders = [];
  for (const rel of AUTH_FILES) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      offenders.push(`${rel}: listed here but missing — update this rule or restore the file`);
      continue;
    }
    const src = stripComments(fs.readFileSync(abs, "utf8"));

    // Module scope only: an indented `new Map()` is a local inside some function.
    for (const m of src.matchAll(/^(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*new\s+Map\b/gm)) {
      if (!ALLOWED.has(m[1])) {
        offenders.push(
          `${rel}: \`${m[1]}\` is a module-level Map — per-process state that a second ` +
            `instance silently does not share. Use getStore() from _core/shared-store.`
        );
      }
    }

    // The store is the only sanctioned home for this state, so an auth file that
    // throttles must reach it. Catches the other direction: state moved into a fresh
    // module-level object/array literal to dodge the Map check above.
    const throttles = /\b(lockout|cooldown|rateLimit|challenge)/i.test(src);
    if (throttles && !/from\s+["'][^"']*shared-store["']/.test(src)) {
      offenders.push(
        `${rel}: holds throttling state but never imports shared-store — ` +
          `per-instance counters are not enforcement across instances`
      );
    }
  }

  offenders.length
    ? fail("Auth throttling state is shared", offenders.join("\n    "))
    : ok("Auth throttling state is shared");
}

/* --------------------------------------------------- 15. tenancy scoping count */
/**
 * The org-scoping burn-down number must be the real one.
 *
 * `protectedProcedure` means "any signed-in user" and said nothing about whose data,
 * because no query carried an owner. Scoping all of them is a large mechanical migration,
 * and a HALF-done one is worse than none: an operator reads "multi-tenant", onboards a
 * second customer, and the unconverted queries hand them the first customer's accounts.
 *
 * So server/_core/tenancy.ts refuses to admit a second organization while any query is
 * still unscoped, and shared/tenancy-status.ts carries the count that refusal reads. A
 * number that could be edited down to zero would remove the protection silently — a claim
 * the code never checked, which is the failure this whole file exists to prevent. It is
 * therefore recomputed here from source and never trusted from the file.
 */
{
  const statusPath = path.join(ROOT, "shared", "tenancy-status.ts");
  if (!fs.existsSync(statusPath)) {
    fail("tenancy scoping count is real", "shared/tenancy-status.ts missing");
  } else {
    const { sites, exemptions, blind } = auditTenancyFull(ROOT);
    const actual = sites.length;
    const statusSrc = fs.readFileSync(statusPath, "utf8");
    const m = statusSrc
      // Tolerates the `: number` annotation (there so `=== 0` stays a runtime question
      // rather than being narrowed away as impossible).
      .match(/UNSCOPED_QUERY_SITES\s*(?::\s*number\s*)?=\s*(\d+)/);
    const em = statusSrc.match(/EXEMPT_QUERY_SITES\s*(?::\s*number\s*)?=\s*(\d+)/);

    if (blind.length) {
      // An audit that cannot read a file must not certify it. A namespace import puts
      // the table behind a property access this scan cannot follow.
      fail(
        "tenancy scoping count is real",
        `cannot see through a namespace import of the schema in: ${blind.join(", ")} — ` +
          `import the tables by name so the org filter on each query is checkable`
      );
    } else if (!m) {
      fail("tenancy scoping count is real", "could not read UNSCOPED_QUERY_SITES");
    } else if (Number(m[1]) !== actual) {
      const claimed = Number(m[1]);
      fail(
        "tenancy scoping count is real",
        `shared/tenancy-status.ts says ${claimed} unscoped queries, ${actual} found in source` +
          (claimed < actual
            ? ` — claiming fewer is what lets a second org in before it is safe. Run \`pnpm tenancy\` for the list.`
            : ` — scoping went further than the file admits; lower it to ${actual}.`)
      );
    } else if (!em) {
      fail("tenancy scoping count is real", "could not read EXEMPT_QUERY_SITES");
    } else if (Number(em[1]) !== exemptions.length) {
      // Without this, the escape hatch swallows the control: exempt a real leak, leave
      // UNSCOPED_QUERY_SITES at zero, and the build still passes. Moving this number is
      // what puts a new exemption in the diff next to the reason written for it.
      fail(
        "tenancy scoping count is real",
        `shared/tenancy-status.ts says ${em[1]} exempt queries, ${exemptions.length} marked in source — ` +
          `every \`tenancy-exempt:\` is a claim that a query needs no tenant boundary. Run \`pnpm tenancy\`.`
      );
    } else {
      ok(
        actual === 0
          ? `tenancy scoping count is real (0 unscoped, ${exemptions.length} exempt — multi-org is enabled)`
          : `tenancy scoping count is real (${actual} unscoped, second org refused)`
      );
    }
  }
}

/* ------------------------------------------------- 16. live-check coverage */
/**
 * A new connector must not silently arrive with no way to verify it.
 *
 * "The connectors have never touched a real tenant" is the biggest honest caveat in this
 * repo, and `pnpm smoke` exists to shrink it: with a key present, a connector is exercised
 * for real on every run. That only holds for connectors the harness knows about. Adding
 * the twenty-fifth connector with no live check would leave the caveat wider than the
 * README says while every number on the page stayed green.
 *
 * This pins how many of the registry's connectors are checkable, so growing the registry
 * without growing the harness shows up in the diff as a number that has to move — and the
 * person moving it has to decide whether the new connector genuinely cannot be checked
 * (webhook-delivered, no read endpoint) or was just not wired up.
 */
{
  const registryPath = path.join(ROOT, "server", "integrations", "registry.ts");
  const smokePath = path.join(ROOT, "scripts", "connector-smoke.mjs");
  const clientsPath = path.join(ROOT, "server", "integrations", "connectors.ts");

  if (![registryPath, smokePath, clientsPath].every(p => fs.existsSync(p))) {
    fail("connector live-check coverage", "registry, smoke harness or clients file missing");
  } else {
    const registry = fs.readFileSync(registryPath, "utf8");
    const registered = (registry.match(/^\s+key:\s*"[a-z]/gim) || []).length;

    // Deep checks are the four hand-written entries in the harness; credential checks are
    // the identityChecks map. Counted from source so neither can drift from reality.
    const smoke = stripComments(fs.readFileSync(smokePath, "utf8"));
    const deep = (smoke.match(/^\s+name:\s*"/gm) || []).length;
    const clients = stripComments(fs.readFileSync(clientsPath, "utf8"));
    const identityBlock = clients.slice(clients.indexOf("export const identityChecks"));
    const credential = (identityBlock.match(/^\s{2}[a-z][a-zA-Z]*:\s*\{/gm) || []).length;

    const covered = deep + credential;
    const EXPECTED_COVERED = 16;
    const EXPECTED_REGISTERED = 24;

    if (registered !== EXPECTED_REGISTERED || covered !== EXPECTED_COVERED) {
      fail(
        "connector live-check coverage",
        `${covered} of ${registered} connectors have a live check; this rule expects ` +
          `${EXPECTED_COVERED} of ${EXPECTED_REGISTERED}. If you added a connector, either give it a check in ` +
          `scripts/connector-smoke.mjs (deep) or identityChecks in server/integrations/connectors.ts ` +
          `(credential), or raise the expected numbers here and say in the commit why it cannot be checked.`
      );
    } else {
      ok(`connector live-check coverage (${covered}/${registered} checkable)`);
    }
  }
}

/* ---------------------------------------------- 17. no documented-and-left bugs */
/**
 * A comment must not describe a live defect as somebody else's problem.
 *
 * This file's premise is that a defect found by hand belongs in a rule, so it can never
 * be found by hand twice. That covers defects someone noticed. It did not cover the
 * likelier case: a defect someone noticed, wrote down accurately, routed around, and
 * left.
 *
 * server/bulk-insights-router.test.ts carried this for months:
 *
 *   "that store's MockDrizzle query builder (server/db.ts, not owned by this feature)
 *    treats gte() as an equality filter, so 'intent score 70+' only ever matches
 *    accounts scored exactly 70 in demo mode — a separate, pre-existing bug outside
 *    this router's control."
 *
 * Every word of it was true. `gte(intentScore, 70)` returned 5 accounts of an actual
 * 105, so this router was picking five arbitrary accounts and calling them the top hot
 * leads — in the mode essentially everyone runs. The comment was the reason nobody
 * looked again: it had already been assessed, named and filed under not-mine.
 *
 * Historical notes are the opposite of this and are everywhere in this repo by design
 * ("this used to return X", "the original did Y"). What is banned is the present tense:
 * a defect asserted to exist right now, with a reason it was not fixed.
 */
{
  // Deliberately narrow. Each phrase asserts a CURRENT defect and a reason to leave it,
  // which is the shape that legitimises one; "this used to" and "the original" do not
  // match and must not.
  const PHRASES = [
    /\bpre-?existing bug\b/i,
    /\bknown bug\b/i,
    /\bseparate,?\s+(?:pre-?existing\s+)?bug\b/i,
    // Deliberately NOT "bug elsewhere" or "bug in another file": those appear in
    // ordinary historical notes ("worse than the same bug elsewhere in this session")
    // that describe something already fixed. Only "outside", which asserts the defect
    // is live and out of scope, is the shape this rule is for.
    /\bbug outside\b/i,
    /\bnot owned by this (?:feature|file|module)\b/i,
    /\bsomeone else'?s bug\b/i,
  ];

  const offenders = [];
  for (const root of ["server", "client/src", "shared", "scripts"]) {
    for (const file of walk(path.join(ROOT, root), [".ts", ".tsx", ".mjs"])) {
      const rel = path.relative(ROOT, file);
      // This rule quotes the phrases it bans, so it would flag itself.
      if (rel === path.join("scripts", "check-claims.mjs")) continue;

      const src = fs.readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue; // comments only
        for (const rx of PHRASES) {
          if (rx.test(line)) {
            offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
            break;
          }
        }
      }
    }
  }

  offenders.length
    ? fail(
        "no documented-and-left bugs",
        offenders.join("\n    ") +
          "\n    A comment naming a live defect and a reason it is not yours is where a defect" +
          "\n    lives longest. Fix it, or delete the excuse and leave the description."
      )
    : ok("no documented-and-left bugs");
}

/* ------------------------------------------- 18. writes that report what they did */
/**
 * A write that reports success must have checked that it wrote something.
 *
 * Found three times in this codebase, each time by hand:
 *
 *   1. admin-router's approveUser / deleteUser / setRole — "a bare UPDATE with no
 *      affectedRows check reported success for a userId that matched nothing —
 *      confirmed live, id 999999999 and id -1 both returned {success:true}".
 *   2. validation.fixIssue — "Updated industry on account 4021" for an account that does
 *      not exist, after which the Data Validation page struck the issue off as resolved.
 *   3. follow-ups' complete / reopen / remove — an attempt on a colleague's follow-up
 *      came back done and the UI removed it from their list.
 *
 * The third one is the reason this is a rule and not three fixes. Its own comment read
 * "an id alone must never be enough to close someone else's commitment": the WHERE was
 * right, and the return value did not reflect it. That is a shape, not an oversight, and
 * org scoping made it likelier rather than rarer — another tenant's id is now a routine
 * zero-row write, and it must never read back as a completed action.
 *
 * A write passes if it does either honest thing: capture its result (so the caller can
 * check affectedRows), or sit behind a lookup that already threw when the row was absent.
 *
 * A third case exists and is narrow: a fire-and-forget side effect whose enclosing
 * `success: true` is a claim about something else entirely. Those carry
 * `write-unchecked: <reason>` on the line above, and the count of them is pinned below,
 * so adding one is a number someone has to move in the diff — the same discipline the
 * tenancy exemptions use, for the same reason.
 */
{
  const offenders = [];
  const exempted = [];
  for (const file of walk(path.join(ROOT, "server"), [".ts"])) {
    const rel = path.relative(ROOT, file);
    if (rel.endsWith(".test.ts")) continue;
    const src = stripComments(fs.readFileSync(file, "utf8"));
    const lines = src.split("\n");

    // Scanned over the whole source rather than line by line, because the shape this rule
    // exists for is written across lines:
    //
    //     await db
    //       .delete(followUps)
    //       .where(...);
    //     return { success: true };
    //
    // A per-line regex cannot match `await db` and `.delete(` together, so the first
    // version of this rule missed all three follow-up mutations — the very instances that
    // motivated writing it. Caught by replaying each historical bug against the rule
    // instead of trusting that it would have.
    for (const m of src.matchAll(/await\s+db\s*\.\s*(update|delete)\s*\(/g)) {
      const i = src.slice(0, m.index).split("\n").length - 1;

      // Captured (`const x = await db.update(...)`) or returned — the caller can see it.
      const lineStart = src.lastIndexOf("\n", m.index) + 1;
      const before = src.slice(lineStart, m.index).trimEnd();
      if (before.endsWith("=") || before.endsWith("return")) continue;

      // Does a success claim follow closely enough to be about this write?
      const after = lines.slice(i, i + 15).join("\n");
      if (!/success:\s*true/.test(after)) continue;

      // Guarded by a lookup that already threw for a missing row — a perfectly good way
      // to be honest, and how snooze, the transcript delete and the verification-code
      // writes all do it.
      //
      // Scoped to the ENCLOSING HANDLER rather than a fixed number of lines back: a
      // 25-line window flagged five writes whose guard sat just outside it, which would
      // have taught everyone to reach for the exemption marker instead of reading the
      // code. The handler starts at the nearest `.mutation(`/`.query(` above.
      const handlerStart = Math.max(
        src.lastIndexOf(".mutation(", m.index),
        src.lastIndexOf(".query(", m.index)
      );
      const window = src.slice(handlerStart < 0 ? 0 : handlerStart, m.index);
      const guarded = /\.select\s*\(/.test(window) && /\bthrow\b/.test(window);
      if (guarded) continue;

      // An explicit, reasoned exemption on one of the two lines above. Comments are
      // blanked by stripComments, so read the raw file for this.
      const raw = fs.readFileSync(file, "utf8").split("\n");
      const near = raw.slice(Math.max(0, i - 3), i).join("\n");
      const reason = near.match(/write-unchecked:\s*(.+)/);
      if (reason && reason[1].trim().length > 15) {
        exempted.push(`${rel}:${i + 1} — ${reason[1].trim()}`);
        continue;
      }

      offenders.push(`${rel}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
    }
  }

  // Pinned, so an exemption cannot be added silently. Raise it deliberately, in a commit
  // that says why the enclosing success claim is about something other than this write.
  const EXPECTED_EXEMPT = 2;

  if (offenders.length) {
    fail(
      "writes report what they did",
      offenders.join("\n    ") +
        "\n    This write returns success without checking it matched a row. Capture the" +
        "\n    result and check affectedRows(), or guard it with a lookup that throws first." +
        "\n    A refused or missed write must not read back as a completed action."
    );
  } else if (exempted.length !== EXPECTED_EXEMPT) {
    fail(
      "writes report what they did",
      `${exempted.length} write-unchecked exemptions, expected ${EXPECTED_EXEMPT}:\n    ` +
        exempted.join("\n    ") +
        "\n    Each is a claim that a nearby `success: true` is about something other than" +
        "\n    that write. Raise the expected count here and say why in the commit."
    );
  } else {
    ok(`writes report what they did (${exempted.length} reasoned exemptions)`);
  }
}

/* ------------------------------------- 19. the two-customer walk is actually run */
/**
 * The README says two customers signing up, inviting colleagues and staying isolated
 * "is verified in a browser, not just in tests".
 *
 * That sentence was in the README before anything walked it. Every other tenancy check
 * reads source: `pnpm tenancy` counts unscoped queries, rule 15 pins the count. None of
 * them can tell you whether a person can actually complete the journey, and walking it
 * by hand immediately found two things source-reading cannot see — signup's last screen
 * telling a self-serve customer to wait for an approval the server had already granted,
 * and that signup mailing the incumbent operator a one-click DENY link for the new
 * customer's own admin account.
 *
 * So the claim needs the walk to exist AND to run. A script nobody invokes is the same
 * as no script, and it is the easier of the two to end up with.
 */
{
  const script = path.join(ROOT, "scripts/tenancy-e2e.mjs");
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const verify = pkg.scripts?.verify ?? "";
  const claimed = /verified in a browser/i.test(fs.readFileSync(path.join(ROOT, "README.md"), "utf8"));

  const problems = [];
  if (!fs.existsSync(script)) problems.push("scripts/tenancy-e2e.mjs does not exist");
  if (!pkg.scripts?.["tenancy:e2e"]) problems.push("package.json has no tenancy:e2e script");
  if (!verify.includes("tenancy:e2e")) problems.push("pnpm verify does not run tenancy:e2e");

  if (!claimed) {
    // The README stopped making the claim. Nothing to enforce — but say so, rather than
    // passing silently and leaving a rule that guards nothing.
    ok("two-customer walk (README no longer claims it)");
  } else if (problems.length) {
    fail(
      "two-customer walk is actually run",
      problems.join("\n    ") +
        "\n    The README claims this journey is verified in a browser. Either it runs on" +
        "\n    every build or the README must stop saying so."
    );
  } else {
    ok("two-customer walk is actually run");
  }
}

/* ------------------------------------------------- 20. the flow count is real */
/**
 * docs/QUALITY-GATE.md names how many flow checks there are. It said "Four flows" over
 * a table of five, and by the time anyone counted there were seven.
 *
 * A number in prose that nobody recomputes is a number that drifts, and the drift is
 * invisible precisely because the sentence still reads fine. This is the same shape as
 * rule 13 (README headline stats) and rule 15 (the tenancy count): if a document states
 * a figure about the code, the code decides what it is.
 */
{
  const WORDS = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12,
  };

  const script = fs.readFileSync(path.join(ROOT, "scripts/flow-gate.mjs"), "utf8");
  // Comments are blanked first: this file's own prose about the rule would otherwise
  // count as a flow, which is the bug rule 1 of this script was written to avoid.
  const actual = (stripComments(script).match(/await flow\(/g) || []).length;

  const doc = fs.readFileSync(path.join(ROOT, "docs/QUALITY-GATE.md"), "utf8");
  const claim = doc.match(/^(\w+) flows,/im);

  if (!claim) {
    fail("the flow count is real", "docs/QUALITY-GATE.md no longer states a flow count");
  } else {
    const stated = WORDS[claim[1].toLowerCase()] ?? Number(claim[1]);
    if (stated !== actual) {
      fail(
        "the flow count is real",
        `docs/QUALITY-GATE.md says "${claim[1]} flows"; flow-gate.mjs has ${actual}.` +
          "\n    Update the sentence and the table under it — a flow with no row is a" +
          "\n    check nobody knows runs."
      );
    } else {
      ok(`the flow count is real (${actual})`);
    }
  }
}

/* --------------------------------------------------------------- 21. report */
for (const c of checks) console.log(`  ✓ ${c}`);
for (const f of failures) console.log(`  ✘ ${f.rule}\n    ${f.detail}`);

console.log(
  `\n${checks.length} passed, ${failures.length} failed` +
    (failures.length ? " — see above" : "")
);
process.exit(failures.length ? 1 : 0);
