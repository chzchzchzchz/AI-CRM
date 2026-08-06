/**
 * Preflight — turns the integration registry into a specific diagnosis.
 *
 * The point is to make a *silent* misconfiguration impossible. A key that is
 * present but subtly wrong (quoted, whitespace-padded, a Discord URL in the
 * Slack slot, a placeholder someone forgot to replace) otherwise behaves
 * exactly like a correct one right up until a sync returns nothing. Each check
 * below converts one of those into a sentence you can act on before you ever
 * make a live call.
 */

import { CONNECTORS, COMMON_PLACEHOLDERS, type ConnectorSpec, type EnvSpec } from "./registry";
import { isWeakSecret } from "@shared/weak-secret";

export type Severity = "ready" | "incomplete" | "invalid" | "not-configured";

export type EnvFinding = {
  name: string;
  state: "ok" | "missing" | "placeholder" | "malformed" | "whitespace" | "quoted";
  message: string;
  hint: string;
};

export type ConnectorDiagnosis = {
  key: string;
  name: string;
  category: ConnectorSpec["category"];
  capability: string;
  docs: string;
  severity: Severity;
  summary: string;
  findings: EnvFinding[];
};

/** Reads one variable and reports every way it could be wrong. */
function inspect(spec: EnvSpec, raw: string | undefined): EnvFinding {
  const base = { name: spec.name, hint: spec.hint };

  if (raw === undefined || raw === "") {
    return { ...base, state: "missing", message: `${spec.name} is not set.` };
  }

  // Checked before trimming: the whole point is that the stored value is wrong.
  if (raw !== raw.trim()) {
    return {
      ...base,
      state: "whitespace",
      message: `${spec.name} has leading or trailing whitespace — usually a stray space or newline from pasting.`,
    };
  }

  if (/^(['"]).*\1$/.test(raw)) {
    return {
      ...base,
      state: "quoted",
      message: `${spec.name} is wrapped in quotes. .env values are literal — remove the surrounding quotes.`,
    };
  }

  const lowered = raw.toLowerCase();
  const placeholders = [...COMMON_PLACEHOLDERS, ...(spec.placeholders ?? [])];
  if (placeholders.some(p => lowered === p || lowered.includes(p))) {
    return {
      ...base,
      state: "placeholder",
      message: `${spec.name} still holds a template placeholder, not a real value.`,
    };
  }

  if (spec.pattern && !spec.pattern.test(raw)) {
    return {
      ...base,
      state: "malformed",
      message: `${spec.name} doesn't look right — expected ${spec.expected ?? "a different format"}.`,
    };
  }

  if (spec.minLength && raw.length < spec.minLength) {
    return {
      ...base,
      state: "malformed",
      message: `${spec.name} is only ${raw.length} characters; a real value is at least ${spec.minLength}.`,
    };
  }

  return { ...base, state: "ok", message: `${spec.name} is set.` };
}

function diagnose(spec: ConnectorSpec, env: NodeJS.ProcessEnv): ConnectorDiagnosis {
  const findings = spec.env.map(e => inspect(e, env[e.name]));
  const byName = new Map(findings.map(f => [f.name, f]));

  const broken = findings.filter(f => f.state !== "ok" && f.state !== "missing");
  const isSet = (n: string) => byName.get(n)?.state === "ok";

  // A connector with alternative credential sets is satisfied by any one of them.
  // The `anyProvided` guard matters for connectors whose vars are all optional:
  // `[].every(...)` is vacuously true, which would otherwise report an entirely
  // empty connector as "ready".
  const required = spec.env.filter(e => e.required);
  const satisfied = spec.anyOf
    ? spec.anyOf.some(combo => combo.every(isSet))
    : required.length > 0
      ? required.every(e => isSet(e.name))
      : spec.env.some(e => isSet(e.name));

  const anyProvided = findings.some(f => f.state !== "missing");

  let severity: Severity;
  let summary: string;

  if (broken.length > 0) {
    severity = "invalid";
    summary = broken[0].message;
  } else if (satisfied) {
    severity = "ready";
    summary = `Configured — ${spec.capability.toLowerCase()}.`;
  } else if (!anyProvided) {
    severity = "not-configured";
    summary = "Not configured. Optional — the app runs without it.";
  } else {
    severity = "incomplete";
    if (spec.anyOf) {
      const options = spec.anyOf
        .map(c => c.filter(n => !isSet(n)).join(" + "))
        .filter(Boolean);
      summary = `Partially configured. Still needs ${options.join("  — or —  ")}.`;
    } else {
      const missing = spec.env
        .filter(e => e.required && !isSet(e.name))
        .map(e => e.name);
      summary = `Partially configured. Still needs ${missing.join(", ")}.`;
    }
  }

  return {
    key: spec.key,
    name: spec.name,
    category: spec.category,
    capability: spec.capability,
    docs: spec.docs,
    severity,
    summary,
    findings,
  };
}

export function runPreflight(env: NodeJS.ProcessEnv = process.env): ConnectorDiagnosis[] {
  return CONNECTORS.map(spec => diagnose(spec, env));
}

/** Core app settings, which unlike connectors are not optional. */
export type CoreFinding = { name: string; ok: boolean; message: string; fix?: string };

export function checkCore(env: NodeJS.ProcessEnv = process.env): CoreFinding[] {
  const out: CoreFinding[] = [];

  const secret = env.JWT_SECRET ?? "";
  // Same predicate the server signs with, so the doctor cannot say a secret is fine
  // while sdk.getSessionSecret treats it as a placeholder — or, as was the case,
  // the reverse: preflight caught the shipped value and the server did not.
  const weakSecret = isWeakSecret(secret);
  out.push({
    name: "JWT_SECRET",
    ok: !weakSecret,
    message: weakSecret
      ? "Weak or unset. Sessions fall back to a random per-process key, so everyone is logged out on every restart."
      : "Set to a strong value.",
    fix: weakSecret ? "openssl rand -base64 48" : undefined,
  });

  const demo = env.DEMO_MODE !== "false";
  const hasDb = Boolean(env.DATABASE_URL);
  out.push({
    name: "DEMO_MODE",
    ok: true,
    message: demo
      ? "On — running against the bundled demo dataset (demo-db.json)."
      : "Off — running against DATABASE_URL.",
    fix: demo ? "Set DEMO_MODE=false and DATABASE_URL to use a real database." : undefined,
  });

  if (!demo) {
    out.push({
      name: "DATABASE_URL",
      ok: hasDb,
      message: hasDb
        ? "Set."
        : "DEMO_MODE is off but DATABASE_URL is not set — the app has nowhere to read or write.",
      fix: hasDb ? undefined : "mysql://user:pass@host:3306/dbname",
    });
  }

  return out;
}

export type PreflightReport = {
  core: CoreFinding[];
  connectors: ConnectorDiagnosis[];
  counts: Record<Severity, number> & { coreProblems: number };
};

export function buildReport(env: NodeJS.ProcessEnv = process.env): PreflightReport {
  const connectors = runPreflight(env);
  const core = checkCore(env);
  const counts = {
    ready: 0,
    incomplete: 0,
    invalid: 0,
    "not-configured": 0,
    coreProblems: core.filter(c => !c.ok).length,
  } as PreflightReport["counts"];
  for (const c of connectors) counts[c.severity] += 1;
  return { core, connectors, counts };
}
