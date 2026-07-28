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
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
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

/* ---------------------------------------------------------------- 7. report */
for (const c of checks) console.log(`  ✓ ${c}`);
for (const f of failures) console.log(`  ✘ ${f.rule}\n    ${f.detail}`);

console.log(
  `\n${checks.length} passed, ${failures.length} failed` +
    (failures.length ? " — see above" : "")
);
process.exit(failures.length ? 1 : 0);
