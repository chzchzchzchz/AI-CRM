import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { organizations } from "../drizzle/schema";
import { affectedRows } from "./_core/affected-rows";
import {
  PROFILE_FIELDS,
  forgetProfile,
  loadProfile,
  mayInheritDeploymentIdentity,
  type CompanyProfile,
} from "./_core/company-profile";

/**
 * Who this workspace is, for the AI to write as.
 *
 * Until this existed, `COMPANY_NAME`, the differentiators and the competitor list were one
 * set of values per deployment — so a second customer's outreach went out written as the
 * operator's company, pitching the operator's product against the operator's named
 * competitors, to the customer's own prospects.
 */
export const companyProfileRouter = router({
  get: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new Error("Admin access required");
    const profile = (await loadProfile(await getDb(), ctx.orgId)) ?? {};
    return {
      profile,
      fields: PROFILE_FIELDS,
      /**
       * Whether an unset field falls back to the deployment's value.
       *
       * True only for the workspace that owns the deployment. Everyone else needs to know
       * that a blank field is blank — not quietly inheriting somebody else's company name —
       * because that is the difference between "not configured yet" and "configured as
       * someone else".
       */
      inheritsDeployment: mayInheritDeploymentIdentity(ctx.orgId),
    };
  }),

  save: protectedProcedure
    .input(
      z.object({
        companyName: z.string().max(200).optional(),
        companyDescription: z.string().max(2000).optional(),
        industry: z.string().max(200).optional(),
        productName: z.string().max(200).optional(),
        productDescription: z.string().max(2000).optional(),
        keyDifferentiators: z.array(z.string().max(200)).max(20).optional(),
        targetCustomers: z.string().max(2000).optional(),
        competitors: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Blank means "unset", not "the empty string". Storing "" would override the
      // deployment default with nothing for the org that legitimately inherits it.
      const profile: CompanyProfile = {};
      for (const [k, v] of Object.entries(input)) {
        if (Array.isArray(v)) {
          const cleaned = v.map(s => s.trim()).filter(Boolean);
          if (cleaned.length) (profile as any)[k] = cleaned;
        } else if (typeof v === "string" && v.trim()) {
          (profile as any)[k] = v.trim();
        }
      }

      const result = await db
        .update(organizations)
        .set({ profile })
        .where(eq(organizations.id, ctx.orgId));

      // Reporting success for an organization row that is not there would tell an admin
      // their company name was saved when nothing was written.
      if (affectedRows(result) === 0) throw new Error("Could not save — workspace not found.");

      // This process reads its own write immediately. Other instances pick it up when
      // their cached copy ages out, which is the documented trade for not querying the
      // organization on every single request.
      forgetProfile(ctx.orgId);
      return { success: true, profile };
    }),
});
