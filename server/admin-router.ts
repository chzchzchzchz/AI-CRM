import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { users, accessRequests } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isSixsenseConfigured } from "./sixsense";

export const adminRouter = router({
  // Real configuration/health check — the Admin page used to hardcode "6sense API:
  // Connected" and "Database: Healthy" regardless of whether either was true. This
  // reports what is actually true right now.
  getSystemStatus: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Admin access required");
    }
    const db = await getDb();
    return {
      sixsenseConfigured: isSixsenseConfigured(),
      databaseHealthy: !!db,
    };
  }),

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

  // Get all users for admin management
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Admin access required");
    }
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isApproved: users.isApproved,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    }).from(users).orderBy(users.createdAt);
  }),

  // Get pending users (registered but not approved)
  getPendingUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Admin access required");
    }
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    return await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isApproved: users.isApproved,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.isApproved, false)).orderBy(users.createdAt);
  }),

  // Approve a registered user
  approveUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Admin access required");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(users)
        .set({ isApproved: true })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Deny/delete a registered user
  denyUser: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Admin access required");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db.delete(users).where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Update user role
  updateUserRole: protectedProcedure
    .input(z.object({ 
      userId: z.number(),
      role: z.enum(["user", "admin"])
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") {
        throw new Error("Admin access required");
      }
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),
});
