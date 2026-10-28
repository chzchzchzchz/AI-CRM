import { describe, it, expect } from "vitest";
import { runPreflight, checkCore, buildReport } from "./integrations/preflight";
import { CONNECTORS } from "./integrations/registry";

/** Build an env with only what the test cares about. */
function env(vars: Record<string, string> = {}): NodeJS.ProcessEnv {
  return vars as NodeJS.ProcessEnv;
}

function find(e: NodeJS.ProcessEnv, key: string) {
  const d = runPreflight(e).find(c => c.key === key);
  if (!d) throw new Error(`no connector named ${key}`);
  return d;
}

describe("preflight — registry integrity", () => {
  it("every connector declares at least one env var and a docs link", () => {
    for (const c of CONNECTORS) {
      expect(c.env.length, `${c.key} has no env vars`).toBeGreaterThan(0);
      expect(c.docs, `${c.key} has no docs link`).toMatch(/^https:\/\//);
    }
  });

  it("connector keys are unique", () => {
    const keys = CONNECTORS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every env var name is referenced by exactly one connector", () => {
    const seen = new Map<string, string>();
    for (const c of CONNECTORS) {
      for (const e of c.env) {
        expect(seen.has(e.name), `${e.name} declared by both ${seen.get(e.name)} and ${c.key}`).toBe(false);
        seen.set(e.name, c.key);
      }
    }
  });

  it("anyOf combinations only reference vars the connector declares", () => {
    for (const c of CONNECTORS) {
      if (!c.anyOf) continue;
      const declared = new Set(c.env.map(e => e.name));
      for (const combo of c.anyOf) {
        for (const name of combo) {
          expect(declared.has(name), `${c.key}: anyOf references undeclared ${name}`).toBe(true);
        }
      }
    }
  });
});

describe("preflight — silent failure modes", () => {
  it("reports nothing-set as not-configured, never as ready", () => {
    for (const d of runPreflight(env())) {
      expect(d.severity, `${d.key} should be not-configured when empty`).toBe("not-configured");
    }
  });

  it("catches a value left as a template placeholder", () => {
    const d = find(env({ SIXSENSE_API_KEY: "your_api_key" }), "sixsense");
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/placeholder/i);
  });

  it("catches surrounding quotes copied out of a config file", () => {
    const d = find(env({ APOLLO_API_KEY: '"abcdefghijklmnop123"' }), "apollo");
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/quotes/i);
  });

  it("catches trailing whitespace from a bad paste", () => {
    const d = find(env({ GONG_API_KEY: "abcdefghijklmnop123 " }), "gong");
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/whitespace/i);
  });

  it("catches a webhook URL pointed at the wrong vendor", () => {
    const d = find(
      env({ SLACK_WEBHOOK_URL: "https://discord.com/api/webhooks/123/abc" }),
      "slack",
    );
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/hooks\.slack\.com/);
  });

  it("catches a token with the wrong prefix", () => {
    const d = find(env({ HUBSPOT_ACCESS_TOKEN: "sk-not-a-hubspot-token" }), "hubspot");
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/pat-/);
  });

  it("catches a truncated key", () => {
    const d = find(env({ SIXSENSE_API_KEY: "abc123" }), "sixsense");
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/characters/i);
  });

  it("catches a Pipedrive domain pasted as a full URL", () => {
    const d = find(
      env({ PIPEDRIVE_API_TOKEN: "tok", PIPEDRIVE_DOMAIN: "https://acme.pipedrive.com" }),
      "pipedrive",
    );
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/bare subdomain/i);
  });

  it("catches a Twilio number that is not E.164", () => {
    const d = find(
      env({
        TWILIO_ACCOUNT_SID: "AC" + "0".repeat(32),
        TWILIO_AUTH_TOKEN: "tok",
        TWILIO_FROM_NUMBER: "(415) 555-1234",
      }),
      "twilio",
    );
    expect(d.severity).toBe("invalid");
    expect(d.summary).toMatch(/E\.164/);
  });
});

describe("preflight — partial configuration", () => {
  it("reports a half-filled connector as incomplete and names what is missing", () => {
    const d = find(env({ LINEAR_API_KEY: "lin_api_abc123" }), "linear");
    expect(d.severity).toBe("incomplete");
    expect(d.summary).toContain("LINEAR_TEAM_ID");
  });

  it("does not call a connector ready when none of its optional vars are set", () => {
    // Regression: `[].every()` is vacuously true, which reported empty
    // connectors as ready.
    const d = find(env({}), "clay");
    expect(d.severity).toBe("not-configured");
  });
});

describe("preflight — alternative credential sets", () => {
  it("accepts ZoomInfo password auth", () => {
    const d = find(env({ ZOOMINFO_USERNAME: "u", ZOOMINFO_PASSWORD: "p" }), "zoominfo");
    expect(d.severity).toBe("ready");
  });

  it("accepts ZoomInfo PKI auth", () => {
    const d = find(
      env({ ZOOMINFO_USERNAME: "u", ZOOMINFO_CLIENT_ID: "c", ZOOMINFO_PRIVATE_KEY: "k" }),
      "zoominfo",
    );
    expect(d.severity).toBe("ready");
  });

  it("explains both options when only the username is present", () => {
    const d = find(env({ ZOOMINFO_USERNAME: "u" }), "zoominfo");
    expect(d.severity).toBe("incomplete");
    expect(d.summary).toContain("ZOOMINFO_PASSWORD");
    expect(d.summary).toContain("ZOOMINFO_CLIENT_ID");
  });
});

describe("preflight — core settings", () => {
  it("flags a missing JWT_SECRET with the command to generate one", () => {
    const jwt = checkCore(env()).find(c => c.name === "JWT_SECRET")!;
    expect(jwt.ok).toBe(false);
    expect(jwt.fix).toContain("openssl");
  });

  it("flags the shipped placeholder secret", () => {
    const jwt = checkCore(env({ JWT_SECRET: "change-this-to-a-long-random-string" }))
      .find(c => c.name === "JWT_SECRET")!;
    expect(jwt.ok).toBe(false);
  });

  it("accepts a strong secret", () => {
    const jwt = checkCore(env({ JWT_SECRET: "P".repeat(48) })).find(c => c.name === "JWT_SECRET")!;
    expect(jwt.ok).toBe(true);
  });

  it("flags DEMO_MODE=false with no DATABASE_URL — the app would have nowhere to write", () => {
    const db = checkCore(env({ DEMO_MODE: "false" })).find(c => c.name === "DATABASE_URL")!;
    expect(db.ok).toBe(false);
  });

  it("does not ask for DATABASE_URL while in demo mode", () => {
    expect(checkCore(env()).find(c => c.name === "DATABASE_URL")).toBeUndefined();
  });
});

describe("preflight — report", () => {
  it("counts every connector exactly once", async () => {
    const r = await buildReport(env({ SIXSENSE_API_KEY: "a".repeat(20) }));
    const total = r.counts.ready + r.counts.incomplete + r.counts.invalid + r.counts["not-configured"];
    expect(total).toBe(CONNECTORS.length);
    expect(r.counts.ready).toBe(1);
  });

  it("surfaces core problems separately from connector state", async () => {
    const r = await buildReport(env());
    expect(r.counts.coreProblems).toBeGreaterThan(0);
  });

  it("reports whether auth throttling state is shared across instances", async () => {
    // Login lockout, rate limiting and 2FA challenges live in one store. An operator
    // running two pods against a per-instance store gets N × the attempts they
    // configured, and nothing in the running app would tell them — so `pnpm doctor`
    // has to, and has to say it either way rather than only warning on the bad case.
    const r = await buildReport(env());
    const auth = r.core.find(c => c.name === "Auth state")!;
    expect(auth).toBeDefined();
    // No REDIS_URL in CI: per-instance is the correct, non-failing state to report.
    expect(auth.ok).toBe(true);
    expect(auth.message).toMatch(/per-instance/i);
  });
});
