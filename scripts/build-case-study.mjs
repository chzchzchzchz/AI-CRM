#!/usr/bin/env node
/**
 * Builds docs/case-study.html from docs/case-study.src.html.
 *
 * The published case study has to be a single self-contained file — it gets opened straight
 * from disk and published as an artifact, where a relative <img src> resolves to nothing. So
 * every screenshot is inlined as a data URI at build time.
 *
 * The source keeps `__IMG_NN__` placeholders instead of paths so it stays readable and
 * diffable; the built file is 1MB of base64 and is not something anyone should edit by hand.
 * It was built by hand once, which is why the test count in it went stale — hence this script.
 *
 *   node scripts/build-case-study.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "docs", "case-study.src.html");
const OUT = path.join(ROOT, "docs", "case-study.html");
const SHOTS = path.join(ROOT, "docs", "screenshots");

const src = fs.readFileSync(SRC, "utf8");

// docs/screenshots/07-home.png → the __IMG_07__ placeholder.
const byNumber = new Map();
for (const file of fs.readdirSync(SHOTS)) {
  const m = /^(\d+)-.*\.(png|jpe?g)$/i.exec(file);
  if (m) byNumber.set(m[1], file);
}

const missing = [];
const used = new Set();
const out = src.replace(/__IMG_(\d+)__/g, (whole, num) => {
  const file = byNumber.get(num);
  if (!file) {
    missing.push(whole);
    return whole;
  }
  used.add(num);
  const mime = /\.png$/i.test(file) ? "image/png" : "image/jpeg";
  const b64 = fs.readFileSync(path.join(SHOTS, file)).toString("base64");
  return `data:${mime};base64,${b64}`;
});

if (missing.length) {
  console.error(`No screenshot for: ${missing.join(", ")} — expected docs/screenshots/NN-*.png`);
  process.exit(1);
}

fs.writeFileSync(OUT, out);

const unused = [...byNumber.keys()].filter(n => !used.has(n)).sort();
const mb = (Buffer.byteLength(out) / 1024 / 1024).toFixed(2);
console.log(`Built docs/case-study.html — ${used.size} screenshots inlined, ${mb} MB`);
if (unused.length) console.log(`Note: screenshots present but unused: ${unused.join(", ")}`);
