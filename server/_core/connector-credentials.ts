import { AsyncLocalStorage } from "node:async_hooks";
import { and, desc, eq, isNull } from "drizzle-orm";
import { connectorCredentials } from "../../drizzle/schema";
import { CONNECTORS, type EnvSpec } from "../integrations/registry";
import { DEFAULT_ORG_ID } from "./tenancy";
import { decryptSecret, encryptSecret, maskSecret } from "./secret-box";

/**
 * Whose vendor account a connector call spends.
 *
 * Every connector here reads its credentials from the deployment's environment — one
 * SALESFORCE_*, one GONG_*, one TWILIO_* for the whole instance. With more than one
 * organization on that instance, "sync" meant "copy whatever the operator connected into
 * whichever workspace asked", so the only safe answer was to refuse every org but the
 * deployment's own. That is a guard, not a solution: it left every other customer unable
 * to use any connector at all.
 *
 * This is the solution half. An organization stores its own credentials, encrypted, and
 * calls made for that organization use them.
 *
 * ── The rule that makes it safe ──────────────────────────────────────────────────────
 *
 * When a credential scope is active, `credential()` reads ONLY from that scope. It does
 * not fall back to process.env, ever. A partially-filled org credential must fail as a
 * partially-filled org credential — if it quietly borrowed the operator's client secret to
 * fill the gap, we would be back to one tenant spending another's account, with the extra
 * insult that everyone believed it was fixed.
 */

const scope = new AsyncLocalStorage<Record<string, string>>();

export type CredentialSource = "organization" | "deployment";

export type ResolvedCredentials = {
  source: CredentialSource;
  values: Record<string, string>;
};

/** The environment variables a given connector owns, straight from the registry. */
export function fieldsFor(provider: string): EnvSpec[] {
  return CONNECTORS.find(c => c.key === provider)?.env ?? [];
}

export function isKnownProvider(provider: string): boolean {
  return CONNECTORS.some(c => c.key === provider);
}

/**
 * Read one credential field.
 *
 * Inside `withCredentials` this is the organization's value and nothing else. Outside it,
 * it is the deployment's environment — which is correct for the org that owns the
 * deployment, for CLI tooling, and for the connector smoke test.
 */
export function credential(name: string): string | undefined {
  const scoped = scope.getStore();
  if (scoped) {
    const v = scoped[name];
    return v && v.length > 0 ? v : undefined;
  }
  const env = process.env[name];
  return env && env.length > 0 ? env : undefined;
}

/** Run `fn` with this organization's credentials in force. */
export function withCredentials<T>(values: Record<string, string>, fn: () => T): T {
  return scope.run(values, fn);
}

/** True while a call is running against an organization's own credentials. */
export function inCredentialScope(): boolean {
  return scope.getStore() !== undefined;
}

/**
 * The live credential an organization has stored for a vendor, decrypted.
 *
 * Newest non-revoked row wins, which is what makes "save a new one" behave like replacing
 * the old one without deleting the audit trail.
 */
export async function loadOrgCredentials(
  db: any,
  orgId: number,
  provider: string
): Promise<Record<string, string> | null> {
  if (!db) return null;
  const [row] = await db
    .select()
    .from(connectorCredentials)
    .where(
      and(
        eq(connectorCredentials.orgId, orgId),
        eq(connectorCredentials.provider, provider),
        // A revoked credential must stop working immediately. `isNull`, not `eq(.., null)`:
        // nothing equals NULL.
        isNull(connectorCredentials.revokedAt)
      )
    )
    .orderBy(desc(connectorCredentials.id))
    .limit(1);
  if (!row) return null;

  const parsed = JSON.parse(decryptSecret(row.secret));
  return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : null;
}

/**
 * Which credentials this organization may use for this vendor, if any.
 *
 * Its own if it has stored some. Otherwise the deployment's — but only for the
 * organization that owns the deployment. Everyone else gets null, and the caller refuses.
 */
export async function resolveCredentials(
  db: any,
  orgId: number,
  provider: string
): Promise<ResolvedCredentials | null> {
  const own = await loadOrgCredentials(db, orgId, provider).catch(() => null);
  if (own && Object.keys(own).length > 0) return { source: "organization", values: own };

  if (orgId === DEFAULT_ORG_ID) {
    const values: Record<string, string> = {};
    for (const field of fieldsFor(provider)) {
      const v = process.env[field.name];
      if (v) values[field.name] = v;
    }
    if (Object.keys(values).length > 0) return { source: "deployment", values };
  }
  return null;
}

/** Encrypt a credential for storage, and derive the hint shown back to a person. */
export function packCredential(values: Record<string, string>): { secret: string; hint: string } {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    const trimmed = String(v ?? "").trim();
    if (trimmed) cleaned[k] = trimmed;
  }
  // The hint comes from the first field with a value, so a person can tell which account
  // is saved without the value ever being shown again.
  const first = Object.values(cleaned)[0] ?? "";
  return { secret: encryptSecret(JSON.stringify(cleaned)), hint: maskSecret(first) };
}
