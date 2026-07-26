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

function collectProcedures(): Map<string, Proc[]> {
  const byRouter = new Map<string, Proc[]>();
  for (const file of walk(path.join(ROOT, "server"), [".ts"])) {
    if (/\.(test|spec)\.ts$/.test(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const re = /export const (\w+Router)\s*=\s*router\(\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const routerName = m[1];
      const body = balanced(src, src.indexOf("{", m.index + m[0].length - 1));
      const procRe = /^\s{2}(\w+)\s*:\s*(protectedProcedure|publicProcedure|adminProcedure)/gm;
      let p: RegExpExecArray | null;
      const list = byRouter.get(routerName) ?? [];
      while ((p = procRe.exec(body))) {
        list.push({
          router: routerName,
          name: p[1],
          kind: p[2].replace("Procedure", ""),
          file: path.relative(ROOT, file),
        });
      }
      byRouter.set(routerName, list);
    }
  }
  return byRouter;
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

/** "router.procedure" -> the client files that call it */
function collectClientCalls(): Map<string, string[]> {
  const calls = new Map<string, string[]>();
  for (const file of walk(path.join(ROOT, "client", "src"), [".ts", ".tsx"])) {
    const src = fs.readFileSync(file, "utf8");
    const re = /trpc\.(\w+)\.(\w+)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      const key = `${m[1]}.${m[2]}`;
      const rel = path.relative(path.join(ROOT, "client", "src"), file);
      const arr = calls.get(key) ?? [];
      if (!arr.includes(rel)) arr.push(rel);
      calls.set(key, arr);
    }
  }
  return calls;
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

function externalReason(key: string): string | null {
  if (EXTERNAL_BY_DESIGN[key]) return EXTERNAL_BY_DESIGN[key];
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
  const calls = collectClientCalls();
  const routes = collectRoutes();

  type Row = Proc & { key: string; callers: string[]; external: string | null };
  const rows: Row[] = [];
  for (const [mountKey, routerName] of [...mounts].sort()) {
    for (const p of procs.get(routerName) ?? []) {
      const key = `${mountKey}.${p.name}`;
      rows.push({ ...p, key, callers: calls.get(key) ?? [], external: externalReason(key) });
    }
  }

  const wired = rows.filter(r => r.callers.length > 0);
  const external = rows.filter(r => !r.callers.length && r.external);
  const unrouted = rows.filter(r => !r.callers.length && !r.external);

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
  L.push(`| App routes | ${routes.length} |`);
  L.push(`| Integration connectors | ${CONNECTORS.length} |`);
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
    L.push("| Procedure | Access | Defined in |");
    L.push("|---|---|---|");
    for (const r of unrouted) L.push(`| \`${r.key}\` | ${r.kind} | \`${r.file}\` |`);
    L.push("");
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
  console.log(`  NOT ROUTED     : ${unrouted.length}`);
  console.log(`  routes         : ${routes.length}`);
  console.log(`  connectors     : ${CONNECTORS.length}`);
}

main();
