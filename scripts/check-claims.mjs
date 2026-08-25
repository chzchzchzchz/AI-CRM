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
    .replace(/\/\*[\s\S]*?\*\//g, m => " ".repeat(m.length))
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

    const pairs = [
      ["accounts", n("accounts")],
      ["contacts", n("contacts")],
    ];
    const bad = [];
    for (const [label, actual] of pairs) {
      const said = claimed(label);
      if (said !== null && said !== actual)
        bad.push(`README says ${said.toLocaleString()} ${label}, seed has ${actual.toLocaleString()}`);
    }
    bad.length
      ? fail("README matches the seed", bad.join("\n    "))
      : ok("README matches the seed");
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
 */
{
  const readmePath = path.join(ROOT, "README.md");
  if (!fs.existsSync(readmePath)) {
    ok("README headline stats (skipped — file missing)");
  } else {
    const readme = fs.readFileSync(readmePath, "utf8");
    const bad = [];

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
    const testMatch = readme.match(/([\d,]+)\s+tests\b/i);
    if (testMatch) {
      const claimedTests = Number(testMatch[1].replace(/,/g, ""));
      if (claimedTests < testCount * 0.75 || claimedTests > testCount * 1.5) {
        bad.push(
          `README says ${claimedTests} tests, ${testCount} found in source (a floor — it.each expands at runtime, so the true count is normally somewhat higher)`
        );
      }
    }

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

    bad.length
      ? fail("README headline stats", bad.join("\n    "))
      : ok("README headline stats");
  }
}

/* --------------------------------------------------------------- 14. report */
for (const c of checks) console.log(`  ✓ ${c}`);
for (const f of failures) console.log(`  ✘ ${f.rule}\n    ${f.detail}`);

console.log(
  `\n${checks.length} passed, ${failures.length} failed` +
    (failures.length ? " — see above" : "")
);
process.exit(failures.length ? 1 : 0);
