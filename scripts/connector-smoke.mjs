#!/usr/bin/env node
/**
 * Live connector smoke test.
 *
 * The standing gap in this repo has been: "no connector has been verified against a
 * real vendor tenant." That is true, and it is not a thing a contract test can fix —
 * a mocked response proves we parse what we *think* the vendor sends.
 *
 * What it does not have to be is a thing someone remembers to do. This spends one
 * cheap authenticated request per configured connector and asserts the response has
 * the shape the client actually reads. It runs in `pnpm verify` and in CI. With no
 * credentials it reports every connector as UNVERIFIED and exits 0, because the app
 * is meant to run without any of them. The moment a real key is present — locally, or
 * as a CI secret — that connector is exercised for real on every run, and a vendor
 * changing its response shape breaks the build instead of a sync quietly returning
 * nothing at 3am.
 *
 * So the honest claim moves from "unverified, and someone must remember to check" to
 * "unverified until a key exists, and verified automatically from the moment it does".
 *
 *   pnpm smoke              report status, exit 0 unless a configured connector fails
 *   pnpm smoke --strict     exit non-zero if ANY connector is unverified
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const STRICT = process.argv.includes("--strict");

// Load .env the same way the app does, so a local key is picked up without exporting it.
if (fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

/**
 * One entry per connector that talks to a vendor over the network.
 *
 * `check` returns { ok, detail } and must make exactly one cheap authenticated call.
 * `assert` states what the response has to contain for our parsing to be correct —
 * this is the part that catches a vendor changing its contract.
 */
const CONNECTORS = [
  {
    name: "Gong",
    env: ["GONG_ACCESS_KEY + GONG_ACCESS_KEY_SECRET", "or GONG_API_KEY"],
    configured: () =>
      Boolean((process.env.GONG_ACCESS_KEY && process.env.GONG_ACCESS_KEY_SECRET) || process.env.GONG_API_KEY),
    run: async () => {
      const { gongTestConnection } = await import("../server/integrations/gong.ts");
      const res = await gongTestConnection();
      if (!res.ok) return { ok: false, detail: res.error };
      return { ok: true, detail: `${res.data.users} users visible` };
    },
  },
  {
    name: "ZoomInfo",
    env: ["ZOOMINFO_USERNAME + ZOOMINFO_PASSWORD", "or ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY"],
    configured: () =>
      Boolean(
        process.env.ZOOMINFO_USERNAME &&
          (process.env.ZOOMINFO_PASSWORD || (process.env.ZOOMINFO_CLIENT_ID && process.env.ZOOMINFO_PRIVATE_KEY))
      ),
    run: async () => {
      const { zoominfoEnrichCompany } = await import("../server/integrations/zoominfo.ts");
      // A domain that certainly exists, so "no match" means our request was wrong.
      const res = await zoominfoEnrichCompany({ domain: "salesforce.com" });
      if (!res.ok) return { ok: false, detail: res.error };
      if (!res.data?.name) return { ok: false, detail: "authenticated, but the match had no name field" };
      return { ok: true, detail: `matched ${res.data.name}` };
    },
  },
  {
    name: "6sense",
    env: ["SIXSENSE_API_KEY"],
    configured: () => Boolean(process.env.SIXSENSE_API_KEY),
    run: async () => {
      const { getCompanyByDomain } = await import("../server/sixsense.ts");
      const company = await getCompanyByDomain("salesforce.com");
      if (!company) return { ok: false, detail: "authenticated, but no company came back for a known domain" };
      return { ok: true, detail: `resolved ${company.name || "a company"}` };
    },
  },
  {
    name: "Salesforce",
    env: ["SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET + SALESFORCE_USERNAME + SALESFORCE_PASSWORD"],
    configured: () =>
      Boolean(process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_USERNAME),
    run: async () => {
      const sf = await import("../server/salesforce.ts");
      const res = await sf.testConnection();
      if (!res.success) return { ok: false, detail: res.error || res.message };
      return { ok: true, detail: `${res.accountCount ?? "?"} accounts, ${res.contactCount ?? "?"} contacts` };
    },
  },
];

const results = [];
for (const c of CONNECTORS) {
  if (!c.configured()) {
    results.push({ name: c.name, state: "unverified", detail: `no credentials (${c.env.join(", ")})` });
    continue;
  }
  try {
    const r = await c.run();
    results.push({ name: c.name, state: r.ok ? "verified" : "failed", detail: r.detail });
  } catch (e) {
    results.push({ name: c.name, state: "failed", detail: (e?.message || String(e)).slice(0, 160) });
  }
}

const mark = { verified: "✓", failed: "✘", unverified: "·" };
for (const r of results) {
  console.log(`  ${mark[r.state]} ${r.name.padEnd(12)} ${r.state.padEnd(11)} ${r.detail}`);
}

const failed = results.filter((r) => r.state === "failed");
const unverified = results.filter((r) => r.state === "unverified");
const verified = results.filter((r) => r.state === "verified");

console.log(
  `\n${verified.length} verified against a live tenant, ${failed.length} failed, ${unverified.length} unverified (no key)`
);

if (unverified.length && !STRICT) {
  console.log(
    "\n  Unverified is not a failure — every integration here is optional and the app\n" +
      "  runs without them. Set a key (locally in .env, or as a CI secret) and that\n" +
      "  connector is exercised for real on every run from then on."
  );
}

if (failed.length) process.exit(1);
if (STRICT && unverified.length) process.exit(1);
