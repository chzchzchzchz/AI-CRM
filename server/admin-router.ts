import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { users, accessRequests } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const adminRouter = router({
  getPendingRequests: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Admin access required");
    }
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db.select().from(accessRequests).orderBy(accessRequests.createdAt);
  }),

  approveAccessRequest: protectedProcedure
    .input(z.object({ requestId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Admin access required");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const request = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.id, input.requestId))
        .limit(1);

      if (!request[0]) throw new Error("Request not found");

      const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const tempPassword = Math.random().toString(36).substring(2, 15);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await db.insert(users).values({
        openId,
        email: request[0].email,
        name: request[0].name,
        passwordHash,
        loginMethod: "email",
        isApproved: true,
        role: "user",
      });

      await db
        .update(accessRequests)
        .set({
          status: "approved",
          reviewedBy: ctx.user?.id,
          reviewedAt: new Date(),
        })
        .where(eq(accessRequests.id, input.requestId));

      return { success: true, tempPassword };
    }),

  denyAccessRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Admin access required");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(accessRequests)
        .set({
          status: "denied",
          reviewedBy: ctx.user?.id,
          reviewedAt: new Date(),
        })
        .where(eq(accessRequests.id, input.requestId));

      return { success: true };
    }),
});
