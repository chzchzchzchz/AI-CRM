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
 * Tables holding one customer's data.
 *
 * `users`, `accessRequests` and `auditLogs` are in the list even though most queries on
 * them are auth-path queries that genuinely cannot carry an org filter — login runs
 * before a session exists, so there is nothing to filter by. Those are marked exempt
 * individually, with the reason next to the query.
 *
 * They are in the list because the admin user listing was NOT one of those: it read every
 * user row in the table, so a second organization's admin would have seen the first
 * organization's people, names and email addresses. Leaving the table out of the audit
 * entirely is what let that sit unnoticed while every other table was being scoped —
 * an audit's blind spot is indistinguishable from an audit's approval.
 *
 * `organizations` itself is absent: it IS the tenant list, not tenant data.
 */
export const TENANT_TABLES = [
  "users",
  "accessRequests",
  "auditLogs",
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

/**
 * Blank comments while preserving line structure exactly.
 *
 * check-claims' version replaces a block comment with spaces of the same total length,
 * which is fine when you only match content — but it eats the newlines, so every line
 * number after a `/* … *\/` block is wrong. This file reports file:line and matches an
 * exemption marker by proximity, so both would silently point at the wrong statement.
 * Newlines are kept; everything else in a comment becomes a space.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
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
  const { sites } = auditTenancyFull(root);
  return sites;
}

/**
 * Sites plus the exemptions, so `pnpm tenancy` can show both.
 *
 * A handful of queries genuinely are not org-scoped — a public share link, where the
 * unguessable token in the URL *is* the authorization and there is no session to read an
 * org from. Those are marked in the source with `tenancy-exempt: <reason>` on the line
 * above the statement. Deliberately not an allowlist in this file: an exemption has to
 * appear in the diff, next to the query, with a reason someone can argue with. A list of
 * file paths and line numbers in a script is how a real leak gets quietly reclassified.
 */
export function auditTenancyFull(root) {
  const sites = [];
  const exemptions = [];
  /** Files this audit knows it cannot read. Never silently skipped. */
  const blind = [];
  const tables = TENANT_TABLES.join("|");
  const touches = new RegExp(
    `\\.(?:from|insert|update|delete)\\s*\\(\\s*(${tables})\\s*[,)]|` +
      `\\.(?:leftJoin|innerJoin|rightJoin)\\s*\\(\\s*(${tables})\\s*,`,
    "g",
  );

  for (const file of walk(path.join(root, "server"), [".ts"])) {
    const rel = path.relative(root, file);
    if (rel.endsWith(".test.ts")) continue;
    const raw = fs.readFileSync(file, "utf8");
    const src = stripComments(raw);

    // Resolve aliased imports before matching.
    //
    // This audit matched table names as they appear in the query, so
    // `import { emailSequences as sequences }` made every query in that file invisible —
    // and the file had five unscoped ones while the count read zero. Three files alias a
    // tenant table this way. A blind spot in the thing that certifies the boundary is
    // worse than no boundary check, because it certifies.
    const aliases = new Map();
    // Static `import { X as Y } from "…/schema"` and the dynamic
    // `const { X as Y } = await import("…/schema")` — both are in use in this codebase,
    // and only one of them being handled is how the first blind spot happened.
    const importForms = [
      /import\s*\{([^}]*)\}\s*from\s*["'][^"']*schema["']/g,
      /\{([^}]*)\}\s*=\s*await\s+import\(\s*["'][^"']*schema["']\s*\)/g,
    ];
    for (const form of importForms) {
      for (const im of src.matchAll(form)) {
        for (const part of im[1].split(",")) {
          const as = part.match(/([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/) // destructure rename
            || part.match(/([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/);      // import rename
          if (as && TENANT_TABLES.includes(as[1])) aliases.set(as[2], as[1]);
        }
      }
    }

    // A namespace import puts the table behind a property access (`schema.accounts`),
    // which this audit cannot follow. Nothing does it today. Rather than quietly missing
    // those queries if something starts to — which is precisely how the alias gap came
    // about — say so and let the count fail, because an audit that cannot see a file must
    // not certify it.
    if (/import\s*\*\s*as\s+\w+\s*from\s*["'][^"']*schema["']/.test(src)) {
      blind.push(rel);
    }
    const names = [...TENANT_TABLES, ...aliases.keys()];
    const localTouches = new RegExp(
      `\\.(?:from|insert|update|delete)\\s*\\(\\s*(${names.join("|")})\\s*[,)]|` +
        `\\.(?:leftJoin|innerJoin|rightJoin)\\s*\\(\\s*(${names.join("|")})\\s*,`,
      "g",
    );
    // Comments are blanked (not removed) so offsets still line up with the original.
    const rawLines = raw.split("\n");

    for (const st of statements(src)) {
      const hit = [...st.text.matchAll(localTouches)];
      if (!hit.length) continue;
      if (/\borgId\b/.test(st.text)) continue;

      // A query bounded to the caller's OWN row cannot cross a tenant boundary: the user
      // id came from the session, and a user belongs to exactly one org. Self-scoping is
      // strictly narrower than org-scoping, so it counts as scoped rather than needing
      // seven copies of the same exemption comment on twofa-router's settings queries.
      // Deliberately requires `ctx.user`, not any `.id`: an id from `input` is a caller-
      // supplied value, which is a parameter and not a boundary.
      if (/\bctx\.user[!?]?\.id\b/.test(st.text)) continue;

      const line = lineOf(src, st.offset);
      const found = hit[0][1] ?? hit[0][2];
      const table = aliases.get(found) ?? found;

      // An exemption must carry a reason, on one of the few lines above the statement.
      // The NEAREST marker wins: taking the first match in the window would let an
      // earlier, unrelated exemption several lines up silently cover this statement —
      // and would equally let an earlier bare marker mask a later valid one.
      const window = rawLines.slice(Math.max(0, line - 5), line);
      let reason = null;
      for (let i = window.length - 1; i >= 0; i--) {
        const m = window[i].match(/tenancy-exempt:\s*(.+)/);
        if (m) {
          reason = m[1].trim();
          break;
        }
      }
      if (reason && reason.length > 10) {
        exemptions.push({ file: rel, line, table, reason });
        continue;
      }
      sites.push({ file: rel, line, table });
    }
  }
  const byPlace = (a, b) => a.file.localeCompare(b.file) || a.line - b.line;
  sites.sort(byPlace);
  exemptions.sort(byPlace);
  return { sites, exemptions, blind };
}
