import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { connectorCredentials } from "../drizzle/schema";
import { affectedRows } from "./_core/affected-rows";
import { logSecurityEvent } from "./_core/security";
import { canEncrypt } from "./_core/secret-box";
import { fieldsFor, isKnownProvider, packCredential } from "./_core/connector-credentials";
import { CONNECTORS } from "./integrations/registry";

/**
 * A customer connecting their own Salesforce, Gong, Slack — rather than being refused.
 *
 * Every connector here reads the deployment's environment, one credential set shared by
 * every workspace on the instance. That made every connector action unsafe for anyone but
 * the organization that owns the deployment, and the only responsible thing was to refuse
 * them — which left a paying customer with a row of buttons that say no.
 *
 * Storing their own lifts the refusal for them and for nobody else. The secret is
 * encrypted with AES-256-GCM before it is written, and is never returned by any procedure
 * here: the only question a person has after saving is "is the right one in there", and
 * the last four characters answer it.
 */
export const connectorCredentialsRouter = router({
  /**
   * What this organization has connected, and what it could connect.
   *
   * Values never appear. `configured` is about THIS workspace — a deployment-level key
   * belonging to the operator is deliberately invisible here, because it is not this
   * customer's and they cannot manage it.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new Error("Admin access required");
    const db = await getDb();
    if (!db) return { canStore: canEncrypt(), connectors: [] };

    const rows = await db
      .select({
        id: connectorCredentials.id,
        provider: connectorCredentials.provider,
        hint: connectorCredentials.hint,
        createdAt: connectorCredentials.createdAt,
        updatedAt: connectorCredentials.updatedAt,
      })
      .from(connectorCredentials)
      .where(
        and(
          eq(connectorCredentials.orgId, ctx.orgId),
          isNull(connectorCredentials.revokedAt)
        )
      )
      .orderBy(desc(connectorCredentials.id));

    // Newest row per provider wins, matching how the resolver reads them.
    const live = new Map<string, any>();
    for (const r of rows) if (!live.has(r.provider)) live.set(r.provider, r);

    return {
      // Said plainly rather than letting a save fail later: with no CREDENTIALS_KEY there
      // is nowhere safe to put a secret, and the UI needs to explain that up front.
      canStore: canEncrypt(),
      connectors: [...live.values()],
      // What this workspace COULD connect, from the same registry the docs are built from,
      // so the picker cannot drift from what the resolver understands.
      available: CONNECTORS.filter(c => c.env.length > 0).map(c => ({
        key: c.key,
        name: c.name,
        capability: c.capability,
      })),
    };
  }),

  /** The fields a given connector needs, straight from the registry the docs are built from. */
  fields: protectedProcedure
    .input(z.object({ provider: z.string().min(1) }))
    .query(({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      if (!isKnownProvider(input.provider)) throw new Error("Unknown connector");
      return fieldsFor(input.provider).map(f => ({
        name: f.name,
        hint: f.hint,
        required: !!f.required,
        secret: !!f.secret,
      }));
    }),

  save: protectedProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        // The vendor's own field names, as the registry declares them.
        values: z.record(z.string(), z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      if (!isKnownProvider(input.provider)) throw new Error("Unknown connector");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const spec = fieldsFor(input.provider);
      const allowed = new Set(spec.map(f => f.name));
      // Only fields this connector actually declares. Storing arbitrary keys would let a
      // credential for one vendor smuggle in values another vendor's accessors would read.
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(input.values)) {
        if (allowed.has(k) && String(v ?? "").trim()) values[k] = String(v).trim();
      }

      const missing = spec.filter(f => f.required && !values[f.name]).map(f => f.name);
      if (missing.length) {
        // Half a credential authenticates as nothing, and the scope deliberately does not
        // fall back to the environment to fill the gap — so say which field is missing
        // rather than storing something that can only fail later.
        throw new Error(`Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
      }

      const { secret, hint } = packCredential(values);

      // Revoke the previous one rather than updating it, so the change is auditable and
      // the resolver's "newest live row" rule does the switching.
      await db
        .update(connectorCredentials)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(connectorCredentials.orgId, ctx.orgId),
            eq(connectorCredentials.provider, input.provider),
            isNull(connectorCredentials.revokedAt)
          )
        );

      await db.insert(connectorCredentials).values({
        orgId: ctx.orgId,
        provider: input.provider,
        secret,
        hint,
        createdBy: ctx.user.id,
      });

      logSecurityEvent(
        "CONNECTOR_CREDENTIAL_SAVED",
        { orgId: ctx.orgId, provider: input.provider, by: ctx.user.id },
        "info"
      );
      return { success: true, provider: input.provider, hint };
    }),

  revoke: protectedProcedure
    .input(z.object({ provider: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .update(connectorCredentials)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(connectorCredentials.orgId, ctx.orgId),
            eq(connectorCredentials.provider, input.provider),
            isNull(connectorCredentials.revokedAt)
          )
        );

      // Reporting success for a credential in someone else's org — or one that was never
      // there — would tell an admin they had disconnected a vendor when they had not.
      if (affectedRows(result) === 0) throw new Error("Nothing connected for that vendor.");

      logSecurityEvent(
        "CONNECTOR_CREDENTIAL_REVOKED",
        { orgId: ctx.orgId, provider: input.provider, by: ctx.user.id },
        "info"
      );
      return { success: true };
    }),
});
