/**
 * `pnpm inventory` — crawl the codebase and write docs/CAPABILITIES.md.
 *
 * This exists because "what have we actually built, and is any of it reachable?"
 * was previously answerable only by reading everything. Capability drift is
 * silent: a procedure gets written, the UI that would call it never lands, and
 * months later nobody remembers it exists. An intent-spike detector sat fully
 * implemented and unreferenced for exactly that reason.
 *
 * Generated, not hand-written, so it cannot rot. Re-run it after any change
 * that adds or removes a procedure, a page, or a connector.
 */

import fs from "node:fs";
import path from "node:path";
import { CONNECTORS } from "./integrations/registry";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs", "CAPABILITIES.md");

/* -------------------------------------------------------------------------- */
/* crawling                                                                    */
/* -------------------------------------------------------------------------- */

function walk(dir: string, exts: string[], acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      walk(full, exts, acc);
    } else if (exts.some(e => entry.name.endsWith(e))) {
      acc.push(full);
    }
  }
  return acc;
}

/** Extract the balanced body of an object literal starting at `openIdx`. */
function balanced(src: string, openIdx: number): string {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(openIdx, i);
    }
  }
  return "";
}

type Proc = { router: string; name: string; kind: string; file: string };

const PROC_KINDS = "protectedProcedure|publicProcedure|adminProcedure";

/** Pull `name: xProcedure` entries sitting at exactly `indent` spaces inside `body`. */
function proceduresIn(body: string, indent: number, router: string, file: string): Proc[] {
  const re = new RegExp(`^ {${indent}}(\\w+)\\s*:\\s*(${PROC_KINDS})`, "gm");
  const out: Proc[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    out.push({ router, name: m[1], kind: m[2].replace("Procedure", ""), file });
  }
  return out;
}

function collectProcedures(): Map<string, Proc[]> {
  const byRouter = new Map<string, Proc[]>();
  for (const file of walk(path.join(ROOT, "server"), [".ts"])) {
    if (/\.(test|spec)\.ts$/.test(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    const re = /export const (\w+Router)\s*=\s*router\(\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const routerName = m[1];
      const body = balanced(src, src.indexOf("{", m.index + m[0].length - 1));
      const list = byRouter.get(routerName) ?? [];
      list.push(...proceduresIn(body, 2, routerName, rel));
      byRouter.set(routerName, list);
    }
  }
  return byRouter;
}

/**
 * Sub-routers declared inline on appRouter rather than as their own exported
 * `xRouter` constant — `accounts: router({ ... })`.
 *
 * Nine of them hold 48 procedures, including the whole auth and accounts surface.
 * Matching only `export const xRouter = router({...})` meant none of it was ever
 * counted, so the inventory under-reported by a third while looking complete.
 */
function collectInlineRouters(): Map<string, Proc[]> {
  const file = path.join(ROOT, "server", "routers.ts");
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, "utf8");
  const out = new Map<string, Proc[]>();

  const appIdx = src.search(/export const appRouter\s*=\s*router\(\s*\{/);
  if (appIdx === -1) return out;
  const appBody = balanced(src, src.indexOf("{", appIdx + "export const appRouter = router(".length - 1));

  const re = /^ {2}(\w+)\s*:\s*router\(\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(appBody))) {
    const key = m[1];
    const body = balanced(appBody, appBody.indexOf("{", m.index + m[0].length - 1));
    out.set(key, proceduresIn(body, 4, key, rel));
  }
  return out;
}

/** routerKey (as mounted on appRouter) -> routerName */
function collectMounts(): Map<string, string> {
  const src = fs.readFileSync(path.join(ROOT, "server", "routers.ts"), "utf8");
  const mounts = new Map<string, string>();
  const re = /^\s{2}(\w+)\s*:\s*(\w+Router)\s*,?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) mounts.set(m[1], m[2]);
  return mounts;
}

/* -------------------------------------------------------------------------- */
/* client reachability                                                         */
/* -------------------------------------------------------------------------- */

const CLIENT_SRC = path.join(ROOT, "client", "src");
const CLIENT_ENTRY = path.join(CLIENT_SRC, "main.tsx");

/** Resolve an import specifier to a file on disk, or null if it isn't ours. */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join(CLIENT_SRC, spec.slice(2));
  else if (spec.startsWith("@shared/")) base = path.join(ROOT, "shared", spec.slice(8));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(fromFile), spec);
  else return null; // bare package specifier

  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

/**
 * Every module actually reachable from the browser entry point.
 *
 * Grepping for `trpc.foo.bar` across the client answers "does any file mention this",
 * which is not the same question as "can a user get to it". Four account tab components
 * referenced real procedures while nothing rendered the components — so the procedures
 * counted as wired and the orphans stayed invisible. Walking the import graph from
 * main.tsx is what makes the difference detectable.
 */
function collectReachableModules(): Set<string> {
  const seen = new Set<string>();
  if (!fs.existsSync(CLIENT_ENTRY)) return seen;

  const queue = [CLIENT_ENTRY];
  // Matches static imports, `export ... from`, and dynamic import() — the last one
  // matters because route-level code splitting is done with React.lazy.
  const importRe =
    /(?:import|export)\s[\s\S]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s*["']([^"']+)["']/g;

  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);

    const src = fs.readFileSync(file, "utf8");
    let m: RegExpExecArray | null;
    importRe.lastIndex = 0;
    while ((m = importRe.exec(src))) {
      const spec = m[1] || m[2] || m[3];
      if (!spec) continue;
      const resolved = resolveImport(file, spec);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/**
 * Blank out comments so a mention inside one isn't counted as a call.
 *
 * AIChatBox documents its own usage with `trpc.ai.chat` in a JSDoc block. That made an
 * orphaned component look like it stranded a procedure which is in fact live elsewhere —
 * a false alarm in the one document that exists to be trusted about this.
 *
 * Replaces with spaces rather than deleting, so any future offset-based reporting still
 * lines up. `://` is excluded so a URL in a string isn't mistaken for a line comment.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

type ClientCalls = {
  /** "router.procedure" -> reachable client files that call it */
  live: Map<string, string[]>;
  /** "router.procedure" -> orphaned client files that call it */
  orphaned: Map<string, string[]>;
};

function collectClientCalls(reachable: Set<string>): ClientCalls {
  const live = new Map<string, string[]>();
  const orphaned = new Map<string, string[]>();

  for (const file of walk(CLIENT_SRC, [".ts", ".tsx"])) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    const target = reachable.has(file) ? live : orphaned;
    const re = /trpc\.(\w+)\.(\w+)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const key = `${m[1]}.${m[2]}`;
      const rel = path.relative(CLIENT_SRC, file);
      const arr = target.get(key) ?? [];
      if (!arr.includes(rel)) arr.push(rel);
      target.set(key, arr);
    }
  }
  return { live, orphaned };
}

/** Client modules that exist but nothing imports, directly or transitively. */
function collectOrphanedModules(reachable: Set<string>): string[] {
  return walk(CLIENT_SRC, [".ts", ".tsx"])
    .filter(f => !reachable.has(f))
    .filter(f => !/\.(test|spec|d)\.tsx?$/.test(f))
    .map(f => path.relative(CLIENT_SRC, f))
    .sort();
}

function collectRoutes(): { path: string; component: string }[] {
  const src = fs.readFileSync(path.join(ROOT, "client", "src", "App.tsx"), "utf8");
  const out: { path: string; component: string }[] = [];
  const re = /<Route\s+path=\{?["']([^"']+)["']\}?\s+component=\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push({ path: m[1], component: m[2] });
  return out;
}

/**
 * Some procedures are correctly never called by our own UI: inbound webhooks,
 * health checks, and connector actions meant to be driven by automation. They
 * are listed as "external" rather than counted as drift.
 */
const EXTERNAL_BY_DESIGN: Record<string, string> = {
  "clay.receiveAccount": "inbound webhook (Clay pushes to us)",
  "clay.receiveContact": "inbound webhook (Clay pushes to us)",
  "clay.ping": "connectivity probe for Clay setup",
  "clayWebhook.receive": "inbound webhook",
  "clayWebhook.test": "connectivity probe",
  "zapier.webhook": "inbound webhook (Zapier/Make/n8n)",
  "system.health": "uptime probe",
};

/**
 * Procedures that are unrouted because something better is live, not because the work
 * was forgotten. Listing them under "wire this up" sends someone to reconnect a worse
 * version of a capability the product already has.
 *
 * Kept rather than deleted: they are working, tested API surface, and nothing is served
 * by removing them while this is pre-1.0. But they should not be mistaken for a to-do.
 */
const SUPERSEDED: Record<string, string> = {
  "ai.compileOverview":
    "superseded by `intel.accountBrief` — same engine, but returns markdown instead of the structured judgement the UI renders",
  "ai.generateStrategicInsights":
    "superseded by `intel.accountBrief` — string-splits the same brief on '## Signal Readout' to recover its judgement section",
  "ai.enrichAccount":
    "superseded by `intel.accountBrief` — answers the same question (score, insights, recommendations) without the evidence validation",
  "ai.generateAccountSummary":
    "superseded by `intel.accountBrief` — a summary with no evidence validation behind it",
  "ai.generateEmail":
    "superseded by `outreach.generateEmail` — the wired one carries the grounding rules that stop it inventing facts about the account",
  "ai.generateAccountResearch":
    "superseded by `ai.compileResearch` — both call the same enrichment, but compileResearch caches and is the one the UI uses",
  "ai.generateOutreachRecommendation":
    "declared in the source as an alias that reuses generateOutreachEmail",
  // One signal pack replaced five per-entity reads on the account page. Wiring any of
  // these back would reintroduce the split that let the page and the brief disagree.
  "people.getByAccountId":
    "superseded by `intel.accountSignals` — returns the same contacts, ranked by seniority, in the pack the page already loads",
  "opportunities.getByAccountId":
    "superseded by `intel.accountSignals` — the pack also carries the probability-weighted total this returns raw",
  "intentScores.list":
    "superseded by `intel.accountSignals` — the pack carries the same series plus its computed trend and largest jump",
  "gong.getByAccountId":
    "superseded by `intel.accountSignals` — conversations, topics and open action items arrive with the pack",
  "calls.getByAccountId":
    "superseded by `intel.accountSignals` — same reason as gong.getByAccountId",
  "gong.getByCompany":
    "superseded by `intel.accountSignals` — keyed on a company-name string where the pack is keyed on the account id",
  "people.getByCompany":
    "superseded by `intel.accountSignals` — same reason as gong.getByCompany",
  // The admin router is the one the approvals screen uses; these are an older pair with
  // the same behaviour behind different names.
  "auth.listAccessRequests":
    "superseded by `admin.getPendingRequests`, which is what the approvals screen calls",
  "auth.reviewAccessRequest":
    "superseded by `admin.approveAccessRequest` / `admin.denyAccessRequest`",
  "calls.list":
    "superseded by `gong.listPaginated`, which the Calls page uses and which pages rather than loading every call",
  "calls.create":
    "superseded by the Gong sync — calls arrive from the connector, not by hand",
  "ai.prioritizeContacts":
    "superseded by `people.prioritize`, which the Contacts page uses",
  "opportunities.getById":
    "superseded by `opportunities.list` — there is no single-opportunity page, and the list already carries every field one would show",
  "deepThink.chat":
    "superseded by `ai.chat`, which the assistant uses on every page",
  "people.listPaginated":
    "superseded by `people.list` for UI purposes — `list` caps its result and supports search, which a contact list needs and this doesn't",
  "priorityActions.getRepTerritory":
    "superseded by `priorityActions.getRepStats` + `getEnriched`, which the dashboard uses and which already scope to the rep",
};

/**
 * Server-side aggregates. Correct and available, but every page that would use one
 * already holds the underlying rows for another reason, so calling these would add a
 * round trip rather than remove one. Recorded here so the next person doesn't rediscover
 * them as "missing work".
 */
const AGGREGATE_API: Record<string, string> = {
  "accounts.getStats":
    "aggregate over all accounts — the dashboard already loads `accounts.list` for its cards and counts from that",
  "analytics.overview":
    "aggregate over accounts, contacts and calls — Insights holds all three already and derives the same figures client-side",
};

/**
 * Actions meant to be driven by a connector, a scheduler or another system rather than
 * by a person clicking. Listing them as UI drift is what makes a to-do list untrustworthy.
 */
const AUTOMATION_BY_DESIGN: Record<string, string> = {
  "clayImport.importRawData": "bulk import — driven by a Clay export or automation",
  "clayImport.importAccounts": "bulk import — driven by a Clay export or automation",
  "clayImport.getImportStats": "import telemetry for the automation that ran it",
  "clayPull.triggerEnrichment": "connector action — Clay enrichment run",
  "dust.getAccountIntelligence": "Dust connector action",
  "dust.getContactIntelligence": "Dust connector action",
  "dust.searchGongCalls": "Dust connector action",
  "dust.query": "Dust connector action",
  // Honest about its own limits: queryGemini throws rather than returning placeholder
  // text, so a caller reports the feature as unavailable instead of passing "not
  // available" off as research. Calling this a working connector action would be the
  // same class of overstatement this document exists to catch.
  "gemini.researchAccount":
    "**cannot succeed in this deployment** — needs browser automation that isn't installed; it throws by design. Use the configured LLM provider instead",
  "accounts.enrichWith6sense": "connector action — 6sense enrichment run",
  "sixsense.syncAccountByDomain": "connector action — sync one account from 6sense",
  "sixsense.identifyByIP": "connector action — de-anonymise a visiting IP",
  "system.notifyOwner": "outbound notification, called by other server code",
  // Its own doc comment: "admin/debug — normally runs in the background".
  "intel.brainLearn": "forces a learning cycle that otherwise runs on a schedule",
  "intentScores.create": "write path — connectors push scores in through it",
};

function externalReason(key: string): string | null {
  if (EXTERNAL_BY_DESIGN[key]) return EXTERNAL_BY_DESIGN[key];
  if (AUTOMATION_BY_DESIGN[key]) return AUTOMATION_BY_DESIGN[key];
  if (AGGREGATE_API[key]) return AGGREGATE_API[key];
  if (key.startsWith("integrations.") && key !== "integrations.status" && key !== "integrations.preflight") {
    return "connector action (callable from automation/API)";
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* rendering                                                                   */
/* -------------------------------------------------------------------------- */

function main() {
  const procs = collectProcedures();
  const mounts = collectMounts();
  const inline = collectInlineRouters();
  const reachable = collectReachableModules();
  const calls = collectClientCalls(reachable);
  const orphanedModules = collectOrphanedModules(reachable);
  const routes = collectRoutes();

  type Row = Proc & {
    key: string;
    callers: string[];
    /** Files that call it but which the product cannot reach. */
    deadCallers: string[];
    external: string | null;
  };
  // Named routers mounted by reference, plus routers declared inline on appRouter.
  const mounted: Array<[string, Proc[]]> = [
    ...[...mounts].map(([k, name]) => [k, procs.get(name) ?? []] as [string, Proc[]]),
    ...[...inline],
  ].sort((a, b) => a[0].localeCompare(b[0]));

  const rows: Row[] = [];
  for (const [mountKey, list] of mounted) {
    for (const p of list) {
      const key = `${mountKey}.${p.name}`;
      rows.push({
        ...p,
        key,
        callers: calls.live.get(key) ?? [],
        deadCallers: calls.orphaned.get(key) ?? [],
        external: externalReason(key),
      });
    }
  }

  const wired = rows.filter(r => r.callers.length > 0);
  const external = rows.filter(r => !r.callers.length && r.external);
  const superseded = rows.filter(r => !r.callers.length && !r.external && SUPERSEDED[r.key]);
  const unrouted = rows.filter(
    r => !r.callers.length && !r.external && !SUPERSEDED[r.key]
  );
  // Called only from code the product can't reach — the most misleading state, because
  // a plain grep reports these as wired.
  const strandedOnly = unrouted.filter(r => r.deadCallers.length > 0);

  const L: string[] = [];
  L.push("# Capabilities");
  L.push("");
  L.push("> Generated by `pnpm inventory`. Do not edit by hand — re-run it instead.");
  L.push("");
  L.push(
    "Every backend capability, and whether anything in the product actually reaches it. " +
      "The point is that capability drift stays visible: work that was built but never " +
      "routed shows up here as a line item rather than being rediscovered by accident."
  );
  L.push("");
  L.push("## Summary");
  L.push("");
  L.push("| | Count |");
  L.push("|---|---|");
  L.push(`| Procedures total | ${rows.length} |`);
  L.push(`| Reachable from the UI | ${wired.length} |`);
  L.push(`| External by design (webhooks, probes, connector actions) | ${external.length} |`);
  L.push(`| **Built but not routed anywhere** | **${unrouted.length}** |`);
  L.push(`| ↳ of those, called only by unreachable client code | ${strandedOnly.length} |`);
  L.push(`| Superseded by a live capability (kept, not a to-do) | ${superseded.length} |`);
  L.push(`| App routes | ${routes.length} |`);
  L.push(`| Client modules unreachable from \`main.tsx\` | ${orphanedModules.length} |`);
  L.push(`| Integration connectors | ${CONNECTORS.length} |`);
  L.push("");
  L.push(
    "\"Reachable\" is decided by walking the import graph from `client/src/main.tsx`, " +
      "not by grepping for the procedure name. The difference is not academic: a component " +
      "can call a procedure perfectly while nothing in the product renders that component, " +
      "in which case the procedure is dead and a text search says otherwise."
  );
  L.push("");

  if (unrouted.length) {
    L.push("## Built but not routed");
    L.push("");
    L.push(
      "Real, working code with no path to it from the product. Each line is either " +
        "something to wire up or something to retire — it should not stay in this list " +
        "indefinitely."
    );
    L.push("");
    L.push("| Procedure | Access | Defined in | Called by (unreachable) |");
    L.push("|---|---|---|---|");
    for (const r of unrouted) {
      const dead = r.deadCallers.length ? r.deadCallers.map(c => `\`${c}\``).join(", ") : "—";
      L.push(`| \`${r.key}\` | ${r.kind} | \`${r.file}\` | ${dead} |`);
    }
    L.push("");
  }

  if (superseded.length) {
    L.push("## Superseded");
    L.push("");
    L.push(
      "Working code that nothing calls because something better does the same job. " +
        "Not drift and not a to-do — reconnecting any of these would put a worse answer " +
        "back in front of a rep."
    );
    L.push("");
    L.push("| Procedure | Why |");
    L.push("|---|---|");
    for (const r of superseded) L.push(`| \`${r.key}\` | ${SUPERSEDED[r.key]} |`);
    L.push("");
  }

  if (orphanedModules.length) {
    // A design-system primitive with no current consumer is a library component waiting
    // for one. A feature component with no consumer is work the product lost. Listing
    // them together makes the second kind invisible.
    const isPrimitive = (m: string) => m.startsWith("components/ui/") || m.startsWith("hooks/");
    const strandedFeatures = orphanedModules.filter(m => !isPrimitive(m));
    const unusedPrimitives = orphanedModules.filter(isPrimitive);

    L.push("## Unreachable client modules");
    L.push("");
    L.push(
      "These files compile and typecheck, but no import chain leads to them from " +
        "`main.tsx`, so no user can reach them. They are the reason a procedure can look " +
        "wired while being dead."
    );
    L.push("");

    if (strandedFeatures.length) {
      L.push(`### Stranded features (${strandedFeatures.length})`);
      L.push("");
      L.push("Built to do something, currently doing nothing. Wire or retire.");
      L.push("");
      for (const m of strandedFeatures) {
        // "Strands" means this dead file is the ONLY caller. A procedure that is also
        // called from live code is not stranded by an orphan that happens to mention
        // it — claiming otherwise sends someone to wire up something already wired.
        const procs = [...calls.orphaned.entries()]
          .filter(([key, files]) => files.includes(m) && !calls.live.has(key))
          .map(([key]) => `\`${key}\``);
        L.push(`- \`${m}\`${procs.length ? ` — strands ${procs.join(", ")}` : ""}`);
      }
      L.push("");
    }

    if (unusedPrimitives.length) {
      L.push(`### Unused primitives (${unusedPrimitives.length})`);
      L.push("");
      L.push(
        "Design-system parts with no current consumer. Not drift — a library is allowed " +
          "to be wider than today's screens — but nothing here is exercised, so treat it " +
          "as untested until something imports it."
      );
      L.push("");
      for (const m of unusedPrimitives) L.push(`- \`${m}\``);
      L.push("");
    }
  }

  L.push("## Reachable from the UI");
  L.push("");
  L.push("| Procedure | Called from |");
  L.push("|---|---|");
  for (const r of wired) {
    L.push(`| \`${r.key}\` | ${r.callers.map(c => `\`${c}\``).join(", ")} |`);
  }
  L.push("");

  if (external.length) {
    L.push("## External by design");
    L.push("");
    L.push("Not called by our UI, and should not be — these are entry points for other systems.");
    L.push("");
    L.push("| Procedure | Why |");
    L.push("|---|---|");
    for (const r of external) L.push(`| \`${r.key}\` | ${r.external} |`);
    L.push("");
  }

  L.push("## App routes");
  L.push("");
  L.push("| Path | Page |");
  L.push("|---|---|");
  for (const r of routes) L.push(`| \`${r.path}\` | \`${r.component}\` |`);
  L.push("");

  L.push("## Integration connectors");
  L.push("");
  L.push("Declared in `server/integrations/registry.ts`. `pnpm doctor` validates them.");
  L.push("");
  L.push("| Connector | Category | Capability | Env |");
  L.push("|---|---|---|---|");
  for (const c of CONNECTORS) {
    L.push(
      `| ${c.name} | ${c.category} | ${c.capability} | ${c.env.map(e => `\`${e.name}\``).join(", ")} |`
    );
  }
  L.push("");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, L.join("\n"));

  console.log(`wrote ${path.relative(ROOT, OUT)}`);
  console.log(`  procedures     : ${rows.length}`);
  console.log(`  reachable      : ${wired.length}`);
  console.log(`  external       : ${external.length}`);
  console.log(`  superseded     : ${superseded.length}`);
  console.log(`  NOT ROUTED     : ${unrouted.length} (${strandedOnly.length} called only by dead code)`);
  console.log(`  routes         : ${routes.length}`);
  console.log(`  orphan modules : ${orphanedModules.length}`);
  console.log(`  connectors     : ${CONNECTORS.length}`);
}

main();
