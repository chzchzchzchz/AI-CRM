import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  canEncrypt,
  decryptSecret,
  encryptSecret,
  maskSecret,
  MissingCredentialsKeyError,
  SecretDecryptError,
} from "./_core/secret-box";
import {
  credential,
  fieldsFor,
  inCredentialScope,
  isKnownProvider,
  packCredential,
  resolveCredentials,
  withCredentials,
} from "./_core/connector-credentials";

/**
 * A customer bringing their own Salesforce instead of being refused.
 *
 * Every connector read the deployment's environment — one SALESFORCE_*, one GONG_*, one
 * TWILIO_* shared by every workspace on the instance — so a connector action was either
 * the operator's to make or nobody's. The guard that closed that hole left every other
 * customer with a row of buttons that say no. This is the half that gives them a yes.
 */

const KEY = crypto.randomBytes(32).toString("base64");
const DB_PATH = path.join(process.cwd(), "connector-creds-test-db.json");

function seed() {
  fs.writeFileSync(
    DB_PATH,
    JSON.stringify(
      { organizations: [{ id: 1, name: "One" }, { id: 2, name: "Two" }], users: [], connector_credentials: [] },
      null,
      2
    )
  );
}

beforeEach(() => {
  process.env.DEMO_DB_PATH = DB_PATH;
  process.env.DEMO_MODE = "true";
  process.env.CREDENTIALS_KEY = KEY;
  seed();
  vi.resetModules();
});

afterEach(() => {
  delete process.env.CREDENTIALS_KEY;
  delete process.env.SALESFORCE_CLIENT_ID;
  delete process.env.SALESFORCE_CLIENT_SECRET;
  fs.rmSync(DB_PATH, { force: true });
  vi.resetModules();
});

describe("encrypting a credential at rest", () => {
  it("round-trips", () => {
    const blob = encryptSecret(JSON.stringify({ SALESFORCE_CLIENT_ID: "abc123" }));
    expect(JSON.parse(decryptSecret(blob))).toEqual({ SALESFORCE_CLIENT_ID: "abc123" });
  });

  it("does not leave the value readable in the stored blob", () => {
    // The whole point. A column that merely looks encrypted is the failure this codebase
    // keeps finding, and here the thing that looks fine would be a key to someone's CRM.
    const blob = encryptSecret("super-secret-token-value");
    expect(blob).not.toContain("super-secret");
    expect(Buffer.from(blob, "utf8").toString("base64")).not.toContain("super-secret");
  });

  it("refuses to encrypt with no key rather than storing plaintext", () => {
    delete process.env.CREDENTIALS_KEY;
    expect(canEncrypt()).toBe(false);
    expect(() => encryptSecret("x")).toThrow(MissingCredentialsKeyError);
    expect(() => encryptSecret("x")).toThrow(/openssl rand/);
  });

  it("rejects a key that is not 32 bytes, instead of silently truncating", () => {
    process.env.CREDENTIALS_KEY = Buffer.from("too short").toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
  });

  it("detects a tampered row instead of returning different bytes", () => {
    // AES-GCM is authenticated, so an edited ciphertext fails rather than decrypting to
    // something plausible.
    const blob = encryptSecret("original");
    const parts = blob.split(".");
    const data = Buffer.from(parts[3], "base64");
    data[0] ^= 0xff;
    parts[3] = data.toString("base64");
    expect(() => decryptSecret(parts.join("."))).toThrow(SecretDecryptError);
  });

  it("fails closed when the key has changed since the row was written", () => {
    const blob = encryptSecret("original");
    process.env.CREDENTIALS_KEY = crypto.randomBytes(32).toString("base64");
    expect(() => decryptSecret(blob)).toThrow(/CREDENTIALS_KEY may have changed/);
  });

  it("shows four characters and never the value", () => {
    expect(maskSecret("sk_live_abcdef123456")).toBe("••••3456");
    expect(maskSecret("ab")).toBe("••••");
  });
});

describe("whose credentials a call uses", () => {
  it("reads the environment when no scope is active", () => {
    // The deployment's own workspace, the CLI, and the connector smoke test all want this.
    process.env.SALESFORCE_CLIENT_ID = "from-environment";
    expect(inCredentialScope()).toBe(false);
    expect(credential("SALESFORCE_CLIENT_ID")).toBe("from-environment");
  });

  it("reads ONLY the scope when one is active", () => {
    process.env.SALESFORCE_CLIENT_ID = "from-environment";
    withCredentials({ SALESFORCE_CLIENT_ID: "from-the-org" }, () => {
      expect(credential("SALESFORCE_CLIENT_ID")).toBe("from-the-org");
    });
  });

  it("does NOT fall back to the environment for a field the org left blank", () => {
    // The load-bearing rule. A half-filled organization credential has to fail as a
    // half-filled organization credential — if it borrowed the operator's client secret to
    // fill the gap we would be back to one tenant spending another's account, with the
    // added insult that everyone believed it was fixed.
    process.env.SALESFORCE_CLIENT_ID = "operator-id";
    process.env.SALESFORCE_CLIENT_SECRET = "operator-secret";
    withCredentials({ SALESFORCE_CLIENT_ID: "customer-id" }, () => {
      expect(credential("SALESFORCE_CLIENT_ID")).toBe("customer-id");
      expect(credential("SALESFORCE_CLIENT_SECRET")).toBeUndefined();
    });
  });

  it("survives an await, because every connector call has one", () => {
    process.env.SALESFORCE_CLIENT_ID = "operator-id";
    return withCredentials({ SALESFORCE_CLIENT_ID: "customer-id" }, async () => {
      await new Promise(r => setTimeout(r, 5));
      expect(credential("SALESFORCE_CLIENT_ID")).toBe("customer-id");
    });
  });

  it("puts the scope back when the call finishes", () => {
    process.env.SALESFORCE_CLIENT_ID = "from-environment";
    withCredentials({ SALESFORCE_CLIENT_ID: "from-the-org" }, () => {});
    expect(credential("SALESFORCE_CLIENT_ID")).toBe("from-environment");
  });
});

describe("resolveCredentials", () => {
  const store = () => JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

  async function save(orgId: number, values: Record<string, string>) {
    const { getDb } = await import("./db");
    const { connectorCredentials } = await import("../drizzle/schema");
    const db: any = await getDb();
    const { secret, hint } = packCredential(values);
    await db.insert(connectorCredentials).values({ orgId, provider: "salesforce", secret, hint });
  }

  it("prefers the organization's own credentials", async () => {
    process.env.SALESFORCE_CLIENT_ID = "operator-id";
    await save(2, { SALESFORCE_CLIENT_ID: "org-two-id", SALESFORCE_CLIENT_SECRET: "org-two-secret" });

    const { getDb } = await import("./db");
    const r = await resolveCredentials(await getDb(), 2, "salesforce");
    expect(r?.source).toBe("organization");
    expect(r?.values.SALESFORCE_CLIENT_ID).toBe("org-two-id");
  });

  it("gives another organization nothing, even with the deployment configured", async () => {
    // The refusal this whole mechanism exists to make escapable — still in force for an
    // org that has not brought its own.
    process.env.SALESFORCE_CLIENT_ID = "operator-id";
    const { getDb } = await import("./db");
    expect(await resolveCredentials(await getDb(), 2, "salesforce")).toBeNull();
  });

  it("lets the deployment's own organization use the environment", async () => {
    process.env.SALESFORCE_CLIENT_ID = "operator-id";
    const { getDb } = await import("./db");
    const r = await resolveCredentials(await getDb(), 1, "salesforce");
    expect(r?.source).toBe("deployment");
    expect(r?.values.SALESFORCE_CLIENT_ID).toBe("operator-id");
  });

  it("returns nothing when there is nothing anywhere", async () => {
    const { getDb } = await import("./db");
    expect(await resolveCredentials(await getDb(), 1, "salesforce")).toBeNull();
  });

  it("does not hand one organization another's stored credentials", async () => {
    await save(1, { SALESFORCE_CLIENT_ID: "org-one-id" });
    const { getDb } = await import("./db");
    expect(await resolveCredentials(await getDb(), 2, "salesforce")).toBeNull();
  });
});

describe("the registry drives the fields", () => {
  it("knows what Salesforce needs, without a second list to drift", () => {
    const names = fieldsFor("salesforce").map(f => f.name);
    expect(names).toContain("SALESFORCE_CLIENT_ID");
    expect(names).toContain("SALESFORCE_CLIENT_SECRET");
  });

  it("rejects a provider nobody declared", () => {
    expect(isKnownProvider("salesforce")).toBe(true);
    expect(isKnownProvider("not-a-vendor")).toBe(false);
    expect(fieldsFor("not-a-vendor")).toEqual([]);
  });

  it("drops blank values rather than storing empty fields", () => {
    const { secret } = packCredential({ A: "kept", B: "   ", C: "" });
    expect(JSON.parse(decryptSecret(secret))).toEqual({ A: "kept" });
  });
});
