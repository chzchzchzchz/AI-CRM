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
/**
 * A placeholder is not a credential.
 *
 * .env.example ships `SIXSENSE_API_KEY=your_6sense_api_key` so the file documents the
 * variable. Once the gate started booting from that file — which is the point, it is
 * what users copy — the harness read the placeholder as a configured key, called
 * 6sense with it, and reported the connector as FAILED. "You configured this and it is
 * broken" and "you have not configured this" are different sentences and only one of
 * them was true.
 */
const PLACEHOLDER = /^(your[_-]|xxx|changeme|change[_-]this|replace[_-]?me|todo|placeholder|<|\.\.\.)/i;
const real = (v) => Boolean(v && v.trim() && !PLACEHOLDER.test(v.trim()));

/** Read the registry's own connector count, so the coverage line cannot drift from it. */
function registryCount() {
  const src = fs.readFileSync("server/integrations/registry.ts", "utf8");
  return (src.match(/^\s+key:\s*"[a-z]/gim) || []).length;
}

const CONNECTORS = [
  {
    name: "Gong",
    env: ["GONG_ACCESS_KEY + GONG_ACCESS_KEY_SECRET", "or GONG_API_KEY"],
    configured: () =>
      (real(process.env.GONG_ACCESS_KEY) && real(process.env.GONG_ACCESS_KEY_SECRET)) || real(process.env.GONG_API_KEY),
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
      real(process.env.ZOOMINFO_USERNAME) &&
      (real(process.env.ZOOMINFO_PASSWORD) ||
        (real(process.env.ZOOMINFO_CLIENT_ID) && real(process.env.ZOOMINFO_PRIVATE_KEY))),
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
    configured: () => real(process.env.SIXSENSE_API_KEY),
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
      real(process.env.SALESFORCE_CLIENT_ID) && real(process.env.SALESFORCE_USERNAME),
    run: async () => {
      const sf = await import("../server/salesforce.ts");
      const res = await sf.testConnection();
      if (!res.success) return { ok: false, detail: res.error || res.message };

      // Counting rows proves the credentials work and nothing about the sync. The shape
      // check below fetches one real account with the sync's own SOQL and runs it through
      // the sync's own transform — the part that fails silently when an org's fields
      // don't match, and writes a table full of names with nothing attached to them.
      const shape = await sf.verifySyncShape();
      if (!shape.ok) return { ok: false, detail: shape.detail };

      return {
        ok: true,
        detail: `${res.accountCount ?? "?"} accounts, ${res.contactCount ?? "?"} contacts — ${shape.detail}`,
      };
    },
  },
];

/**
 * Credential checks: one read-only identity request per vendor.
 *
 * These prove less than the four above — a valid key and a response we can still parse,
 * not a working sync — and they are reported as a separate, weaker class for exactly
 * that reason. Folding them into "verified" would inflate the number that matters.
 */
const { identityChecks } = await import("../server/integrations/connectors.ts");
for (const [key, c] of Object.entries(identityChecks)) {
  CONNECTORS.push({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    env: c.env,
    credentialOnly: true,
    configured: c.configured,
    run: async () => {
      const r = await c.run();
      return { ok: r.ok, detail: r.detail };
    },
  });
}

const results = [];
for (const c of CONNECTORS) {
  if (!c.configured()) {
    results.push({
      name: c.name,
      credentialOnly: c.credentialOnly,
      state: "unverified",
      detail: `no credentials (${c.env.join(", ")})`,
    });
    continue;
  }
  try {
    const r = await c.run();
    results.push({
      name: c.name,
      credentialOnly: c.credentialOnly,
      state: r.ok ? (c.credentialOnly ? "credential-ok" : "verified") : "failed",
      detail: r.detail,
    });
  } catch (e) {
    results.push({
      name: c.name,
      credentialOnly: c.credentialOnly,
      state: "failed",
      detail: (e?.message || String(e)).slice(0, 160),
    });
  }
}

const mark = { verified: "✓", "credential-ok": "◍", failed: "✘", unverified: "·" };
const order = ["failed", "verified", "credential-ok", "unverified"];
for (const state of order) {
  for (const r of results.filter((x) => x.state === state)) {
    console.log(`  ${mark[r.state]} ${r.name.padEnd(12)} ${r.state.padEnd(13)} ${r.detail}`);
  }
}

const failed = results.filter((r) => r.state === "failed");
const unverified = results.filter((r) => r.state === "unverified");
const verified = results.filter((r) => r.state === "verified");
const credentialOk = results.filter((r) => r.state === "credential-ok");

console.log(
  `\n${verified.length} verified against a live tenant, ${credentialOk.length} credential-checked, ` +
    `${failed.length} failed, ${unverified.length} unverified (no key)`
);

/**
 * How much of the stack this command can speak for, at all.
 *
 * Without this line the output reads as if these connectors are the whole set — someone
 * seeing "0 failed" would reasonably conclude the integrations are covered. They are not:
 * webhook-delivered connectors (Slack, Discord, Teams, Google Chat, Clay) and PagerDuty's
 * Events v2 routing key have no read endpoint to check against, so no key can ever prove
 * them here. Saying which is which is the difference between a green check and an honest
 * one, and this is a repo where that distinction is the whole point.
 */
const CONNECTORS_IN_REGISTRY = registryCount();
const covered = CONNECTORS.length;
console.log(
  `\nCoverage: ${covered} of ${CONNECTORS_IN_REGISTRY} registered connectors can be checked live at all.` +
    `\n  4 have a deep check (a real query whose result shape is asserted); the rest have a` +
    `\n  read-only credential check. The other ${CONNECTORS_IN_REGISTRY - covered} are webhook-delivered, or have no read` +
    `\n  endpoint at all — no key can verify those from here, today or ever.`
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
