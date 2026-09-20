/**
 * `pnpm doctor` — the one command to run before you trust a deployment.
 *
 * Prints what is configured, what is half-configured, and what is set but
 * wrong, with the exact fix next to each. Exits non-zero only for problems
 * that will actually break the app: an unconfigured optional connector is a
 * normal state, not an error.
 */

import "dotenv/config";
import { buildReport, type Severity } from "./integrations/preflight";

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => paint("1", s);
const dim = (s: string) => paint("2", s);
const green = (s: string) => paint("32", s);
const yellow = (s: string) => paint("33", s);
const red = (s: string) => paint("31", s);
const cyan = (s: string) => paint("36", s);

const MARK: Record<Severity, string> = {
  ready: green("✔"),
  incomplete: yellow("◐"),
  invalid: red("✘"),
  "not-configured": dim("·"),
};

async function main() {
  const report = await buildReport();

  console.log();
  console.log(bold("  Setup check"));
  console.log();

  // ---- Core ---------------------------------------------------------------
  console.log(bold("  Core"));
  for (const c of report.core) {
    const mark = c.ok ? green("✔") : red("✘");
    console.log(`   ${mark} ${bold(c.name.padEnd(14))} ${c.message}`);
    if (c.fix) console.log(`     ${dim("→ " + c.fix)}`);
  }
  console.log();

  // ---- Connectors, problems first ----------------------------------------
  const order: Severity[] = ["invalid", "incomplete", "ready", "not-configured"];
  const heading: Record<Severity, string> = {
    invalid: red("Set but wrong — these will fail"),
    incomplete: yellow("Half configured"),
    ready: green("Ready"),
    "not-configured": dim("Not configured (optional)"),
  };

  for (const sev of order) {
    const group = report.connectors.filter(c => c.severity === sev);
    if (!group.length) continue;

    console.log(`  ${bold(heading[sev])}`);
    for (const c of group) {
      console.log(`   ${MARK[sev]} ${bold(c.name.padEnd(18))} ${c.summary}`);

      // Only spell out individual variables when something needs doing, and
      // skip the one already quoted in the summary line above.
      if (sev === "invalid" || sev === "incomplete") {
        const detail = c.findings.filter(f => f.state !== "ok" && f.message !== c.summary);
        for (const f of detail) {
          console.log(`     ${dim("·")} ${f.message}`);
          console.log(`       ${dim(f.hint)}`);
        }
        const primary = c.findings.find(f => f.message === c.summary);
        if (primary) console.log(`       ${dim(primary.hint)}`);
        console.log(`     ${dim("docs: " + c.docs)}`);
      }
      if (sev === "not-configured") {
        const names = c.findings.map(f => f.name).join(", ");
        console.log(`     ${dim(names)}`);
      }
    }
    console.log();
  }

  // ---- Verdict ------------------------------------------------------------
  const { counts } = report;
  const bad = counts.invalid + counts.coreProblems;

  console.log(bold("  Summary"));
  console.log(
    `   ${green(String(counts.ready))} ready · ` +
      `${yellow(String(counts.incomplete))} half configured · ` +
      `${red(String(counts.invalid))} wrong · ` +
      `${dim(String(counts["not-configured"]) + " off")}`
  );
  console.log();

  if (bad > 0) {
    console.log(`  ${red("Fix the items marked ✘ above before deploying.")}`);
    console.log();
    process.exit(1);
  }

  if (counts.ready === 0) {
    console.log(`  ${cyan("Nothing is connected yet — the app runs on demo data.")}`);
    console.log(`  ${dim("Add one key to .env and run this again; it will tell you if it's right.")}`);
  } else {
    console.log(`  ${green("No problems found.")}`);
  }
  console.log();
}

main();
