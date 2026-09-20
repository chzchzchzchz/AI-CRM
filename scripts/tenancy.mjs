#!/usr/bin/env node
/**
 * `pnpm tenancy` — what is left before this deployment can hold two customers.
 *
 * Prints every query on a tenant-owned table that still runs without an org filter, so
 * the migration has a worklist instead of a feeling. The count is the same one
 * shared/tenancy-status.ts carries and server/_core/tenancy.ts refuses a second
 * organization on; `pnpm check:claims` fails the build if the two disagree.
 */

import { auditTenancyFull } from "./tenancy-audit.mjs";

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = s => paint("1", s);
const dim = s => paint("2", s);
const green = s => paint("32", s);
const yellow = s => paint("33", s);

const { sites, exemptions } = auditTenancyFull(process.cwd());

console.log();
console.log(bold("  Org scoping"));
console.log();

function printExemptions() {
  if (!exemptions.length) return;
  // Never folded into the "done" number silently. An exemption is a claim that a query
  // does not need the boundary, and a claim should be readable.
  console.log(`  ${bold("Exempt")} ${dim(`(${exemptions.length}) — not org-scoped, with a stated reason`)}`);
  for (const e of exemptions) {
    console.log(`     ${dim(`${e.file}:${e.line}`)}  ${e.table}`);
    console.log(`       ${dim(e.reason)}`);
  }
  console.log();
}

if (sites.length === 0) {
  printExemptions();
  console.log(`  ${green("Every query on a tenant table carries an org filter.")}`);
  console.log(`  ${dim("Multi-org is enabled: server/_core/tenancy.ts no longer refuses a second organization.")}`);
  console.log();
  process.exit(0);
}

const byFile = new Map();
for (const s of sites) {
  if (!byFile.has(s.file)) byFile.set(s.file, []);
  byFile.get(s.file).push(s);
}

for (const [file, rows] of [...byFile].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${bold(file)} ${dim(`(${rows.length})`)}`);
  for (const r of rows) console.log(`     ${dim(`${file}:${r.line}`)}  ${r.table}`);
  console.log();
}

printExemptions();

console.log(
  `  ${yellow(`${sites.length} unscoped`)} across ${byFile.size} files — ` +
    `a second organization is refused until this reaches 0.`
);
console.log(
  `  ${dim("Scope one by filtering on the table's orgId column with ctx.orgId, then lower")}`
);
console.log(`  ${dim("UNSCOPED_QUERY_SITES in shared/tenancy-status.ts to match.")}`);
console.log();
