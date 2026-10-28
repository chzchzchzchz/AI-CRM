import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { organizations } from "../drizzle/schema";
import { affectedRows } from "./_core/affected-rows";
import { DEFAULT_ORG_ID } from "./_core/tenancy";
import {
  LIMIT_KINDS,
  entitlementsFor,
  monthStart,
  usageFor,
  type Entitlements,
} from "./_core/entitlements";

/**
 * What this workspace has used, and what it is allowed.
 *
 * Usage is visible to any admin of the workspace — it is their consumption and they
 * should not have to ask for it. Setting a LIMIT is restricted to the organization that
 * owns the deployment, because a customer raising their own cap is not a cap.
 *
 * There are no plan names and no prices here. Nothing in this product knows what a seat
 * costs, and a default limit invented to look complete would fire on a real customer,
 * mid-work, for a number nobody chose.
 */
export const entitlementsRouter = router({
  usage: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new Error("Admin access required");
    const db = await getDb();
    const [limits, usage] = await Promise.all([
      entitlementsFor(db, ctx.orgId),
      usageFor(db, ctx.orgId),
    ]);
    return {
      kinds: LIMIT_KINDS,
      limits,
      usage,
      /** The window AI calls are counted over, so the number on screen is unambiguous. */
      periodStart: monthStart().toISOString(),
      /** Only the deployment's own workspace may change a limit. */
      canSetLimits: ctx.orgId === DEFAULT_ORG_ID,
    };
  }),

  /**
   * Set or clear this workspace's limits.
   *
   * Operator-only, and null clears — which restores unlimited rather than setting zero.
   * Those are very different and the difference is a locked-out customer.
   */
  setLimits: protectedProcedure
    .input(
      z.object({
        orgId: z.number().int().positive(),
        limits: z.object({
          seats: z.number().int().min(0).nullable().optional(),
          accounts: z.number().int().min(0).nullable().optional(),
          contacts: z.number().int().min(0).nullable().optional(),
          aiCallsPerMonth: z.number().int().min(0).nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      // A workspace that could raise its own ceiling does not have one. Only the
      // organization that owns the deployment sets limits, for itself or anyone else.
      if (ctx.orgId !== DEFAULT_ORG_ID) {
        throw new Error("Only the workspace that owns this deployment can set limits.");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const current = await entitlementsFor(db, input.orgId);
      const next: Entitlements = { ...current };
      for (const [k, v] of Object.entries(input.limits)) {
        if (v === null) delete (next as any)[k];
        else if (typeof v === "number") (next as any)[k] = v;
      }

      const result = await db
        .update(organizations)
        .set({ entitlements: next })
        .where(eq(organizations.id, input.orgId));

      // Reporting success for an organization that is not there would tell an operator a
      // limit was applied when nothing was written.
      if (affectedRows(result) === 0) throw new Error(`No organization ${input.orgId}.`);

      return { success: true, limits: next };
    }),
});
