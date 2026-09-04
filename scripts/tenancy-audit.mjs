/**
 * Counts database queries on tenant-owned tables that carry no org filter.
 *
 * Shared by `pnpm check:claims` (which fails the build when the checked-in number in
 * shared/tenancy-status.ts disagrees with what this finds) and by `pnpm tenancy` (which
 * prints the remaining sites so the migration has a worklist rather than a vibe).
 *
 * The number matters because server/_core/tenancy.ts refuses to admit a second
 * organization while it is above zero. That is the whole safety property: a partly
 * scoped deployment cannot be put into the state where the missing scoping leaks. An
 * audit that could be edited to say zero would remove the property silently, so it is
 * recomputed from source on every run and never trusted from the file.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * Tables holding one customer's data. Reference tables (users, organizations,
 * accessRequests, auditLogs, the auth code tables) are deliberately absent: they are
 * either scoped through the user row itself or are not tenant data at all.
 */
export const TENANT_TABLES = [
  "accounts",
  "contacts",
  "calls",
  "rfps",
  "intentScores",
  "aiContext",
  "documents",
  "enrichmentLogs",
  "validationCache",
  "contextStore",
  "aiInsights",
  "emailSequences",
  "followUps",
  "outreachCampaigns",
  "newsItems",
  "sixsense6QA",
  "sixsenseKeywords",
  "sixsenseBuyingStageMetrics",
  "sixsenseEngagementMetrics",
  "sixsense6QAPerformance",
  "emailHistory",
  "aiChatHistory",
  "aiResponseCache",
  "knowledgeBase",
  "documentChunks",
  "userInteractions",
  "dataProcessingJobs",
  "generatedContent",
  "transcriptReports",
  "dustCache",
  "opportunities",
];

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
      if (["node_modules", "dist", ".git", ".worktrees"].includes(e.name)) continue;
      walk(full, exts, acc);
    } else if (exts.some(x => e.name.endsWith(x))) acc.push(full);
  }
  return acc;
}

/**
 * One drizzle statement, from `db.select()` / `db.insert(x)` up to the `;` that ends it.
 *
 * Chained across lines, so a line-based scan would see `.from(accounts)` and
 * `.where(...)` as unrelated and call every multi-line query unscoped. Statements are
 * cut at a semicolon that is not inside brackets, which is where drizzle's builder ends.
 */
function statements(src) {
  const out = [];
  const starts = [...src.matchAll(/\b(?:db|tx|this\.db)\s*\.\s*(?:select|insert|update|delete)\s*\(/g)];
  for (const m of starts) {
    let depth = 0;
    let i = m.index;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      else if (c === ")" || c === "]" || c === "}") depth--;
      else if (c === ";" && depth <= 0) break;
    }
    out.push({ text: src.slice(m.index, i), offset: m.index });
  }
  return out;
}

const lineOf = (src, offset) => src.slice(0, offset).split("\n").length;

/**
 * Find every unscoped query site under server/.
 *
 * A site counts as scoped when the statement mentions `orgId` at all — an org filter, an
 * inserted orgId column, or a helper that takes one. That is a deliberately generous
 * test: it can call a wrong filter right, but it cannot call a MISSING one right, and a
 * missing one is the leak. Rule 15 in check-claims separately pins that the number does
 * not drift, so a site cannot quietly stop being counted.
 */
export function auditTenancy(root) {
  const sites = [];
  const tables = TENANT_TABLES.join("|");
  const touches = new RegExp(
    `\\.(?:from|insert|update|delete)\\s*\\(\\s*(${tables})\\s*[,)]|` +
      `\\.(?:leftJoin|innerJoin|rightJoin)\\s*\\(\\s*(${tables})\\s*,`,
    "g",
  );

  for (const file of walk(path.join(root, "server"), [".ts"])) {
    const rel = path.relative(root, file);
    if (rel.endsWith(".test.ts")) continue;
    const src = stripComments(fs.readFileSync(file, "utf8"));

    for (const st of statements(src)) {
      const hit = [...st.text.matchAll(touches)];
      if (!hit.length) continue;
      if (/\borgId\b/.test(st.text)) continue;
      const table = hit[0][1] ?? hit[0][2];
      sites.push({ file: rel, line: lineOf(src, st.offset), table });
    }
  }
  sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return sites;
}
