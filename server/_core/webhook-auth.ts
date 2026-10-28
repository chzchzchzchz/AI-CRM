/**
 * Which organization an inbound webhook belongs to.
 *
 * A webhook receiver is a publicProcedure: an HTTP POST with no session, so there is no
 * `ctx.orgId` to read. With one shared secret in the environment there was also no way to
 * *tell* — every inbound Clay record landed in the same org no matter who sent it. That
 * is why the webhook receivers were the last unscoped queries in the codebase, and why
 * writing a constant into them would have been worse than leaving them counted: the
 * scoping audit would have read zero while inbound data still all went to one tenant.
 *
 * The fix is the same shape as the session: resolve the org FROM the credential the
 * caller presented, and refuse the request when no credential identifies one.
 *
 * Order matters, and it is deliberate:
 *
 *   1. The environment secret, if set, maps to the default org. Every deployment that
 *      works today keeps working with no migration and no new table row.
 *   2. Otherwise, look the presented secret up in webhook_credentials, which is where a
 *      multi-org deployment issues one secret per organization.
 *   3. Demo mode with nothing configured at all resolves to the default org, so the
 *      bundled demo keeps accepting local test posts.
 *   4. Anything else is refused. Outside demo mode an unconfigured receiver rejects
 *      every request rather than accepting unauthenticated writes by omission.
 */

import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { webhookCredentials } from "../../drizzle/schema";
import { timingSafeEqual } from "./security";
import { DEFAULT_ORG_ID } from "./tenancy";

/** The stored form of a webhook secret. See the schema comment for why SHA-256. */
export function hashWebhookSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/** Mint a new credential value. 256 bits from a CSPRNG — never Math.random. */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export type WebhookProvider = "clay" | "zapier";

/**
 * Resolve the org for an inbound webhook, or throw.
 *
 * Returns a number, never null and never a default-on-failure: a receiver that fell back
 * to the default org on an unrecognised secret would write one tenant's inbound data into
 * another's account table, which is the failure this function exists to prevent.
 */
export async function resolveWebhookOrg(
  provider: WebhookProvider,
  providedSecret: string | undefined,
  envSecret: string,
): Promise<number> {
  // 1. The single-tenant environment secret.
  if (envSecret) {
    if (timingSafeEqual(envSecret, providedSecret)) return DEFAULT_ORG_ID;
    // Fall through rather than rejecting: a multi-org deployment can have both an env
    // secret for org 1 and issued credentials for the others.
  }

  // 2. An issued per-org credential.
  if (providedSecret) {
    const db = await getDb();
    if (db) {
      const [row] = await db
        .select({ orgId: webhookCredentials.orgId })
        .from(webhookCredentials)
        .where(
          and(
            eq(webhookCredentials.provider, provider),
            eq(webhookCredentials.secretHash, hashWebhookSecret(providedSecret)),
            // A revoked credential must stop working. Rows are kept rather than deleted
            // so a revocation stays auditable.
            isNull(webhookCredentials.revokedAt),
          ),
        )
        .limit(1);
      if (row) return row.orgId;
    }
  }

  // 3. Demo mode with nothing configured at all.
  if (!envSecret && process.env.DEMO_MODE === "true") return DEFAULT_ORG_ID;

  // 4. Refuse.
  if (!envSecret) {
    console.error(`[webhook] no ${provider} credential configured — rejecting request`);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: `This webhook is not configured (set ${provider.toUpperCase()}_WEBHOOK_SECRET, or issue a per-organization credential)`,
    });
  }
  console.error(`[webhook] invalid ${provider} secret`);
  throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid webhook secret" });
}
