import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { users, accessRequests } from "../drizzle/schema";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { isSixsenseConfigured } from "./sixsense";
import { toPublicUser } from "./_core/publicUser";
import { affectedRows } from "./_core/affected-rows";
import { sendAccessApprovalEmail } from "./_core/email";



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
    return await db.select().from(accessRequests)
      .where(eq(accessRequests.orgId, ctx.orgId))
      .orderBy(accessRequests.createdAt);
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
        .where(and(eq(accessRequests.orgId, ctx.orgId), eq(accessRequests.id, input.requestId)))
        .limit(1);

      if (!request[0]) throw new Error("Request not found");

      const openId = `email_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      // crypto.randomBytes, not Math.random() — this becomes the account's actual login
      // credential, same reasoning as the 2FA recovery codes (server/twofa-router.ts).
      const tempPassword = crypto.randomBytes(12).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await db.insert(users).values({
        // A user an admin creates joins that admin's organization. There is no other
        // org they could sensibly belong to, and defaulting to org 1 would put every
        // tenant's new users in the first tenant.
        orgId: ctx.orgId,
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
        .where(and(eq(accessRequests.orgId, ctx.orgId), eq(accessRequests.id, input.requestId)));

      // The password created above has to reach the new user somehow, and until now it
      // reached nowhere: sendAccessApprovalEmail existed but nothing called it, and the
      // client discarded `tempPassword` from this response entirely. The account was
      // real but permanently unreachable — no one, including the approving admin, ever
      // saw the credential that would let it be logged into.
      const emailSent = await sendAccessApprovalEmail(request[0].email, request[0].name, tempPassword)
        .catch(() => false);

      return { success: true, tempPassword, emailSent, email: request[0].email };
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

      const result = await db
        .update(accessRequests)
        .set({
          status: "denied",
          reviewedBy: ctx.user?.id,
          reviewedAt: new Date(),
          denialReason: input.reason,
        })
        .where(and(eq(accessRequests.orgId, ctx.orgId), eq(accessRequests.id, input.requestId)));
      if (affectedRows(result) === 0) throw new Error(`Request ${input.requestId} not found`);

      return { success: true };
    }),

  // Get all users for admin management
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Admin access required");
    }
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const rows = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isApproved: users.isApproved,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
      lastSignedIn: users.lastSignedIn,
    }).from(users)
      // Without this, a second organization's admin sees the first organization's
      // people — names, email addresses and roles — on their own user-management page.
      .where(eq(users.orgId, ctx.orgId))
      .orderBy(users.createdAt);
    return rows.map(toPublicUser);
  }),

  // Get pending users (registered but not approved)
  getPendingUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new Error("Admin access required");
    }
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    const rows = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isApproved: users.isApproved,
      loginMethod: users.loginMethod,
      createdAt: users.createdAt,
    }).from(users)
      .where(and(eq(users.orgId, ctx.orgId), eq(users.isApproved, false)))
      .orderBy(users.createdAt);
    return rows.map(toPublicUser);
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

      const result = await db
        .update(users)
        .set({ isApproved: true })
        .where(and(eq(users.orgId, ctx.orgId), eq(users.id, input.userId)));
      // A bare UPDATE with no affectedRows check reported success for a userId that
      // matched nothing — confirmed live, id 999999999 and id -1 both returned
      // {success:true} with no user actually approved.
      if (affectedRows(result) === 0) throw new Error(`User ${input.userId} not found`);

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

      // The org half turns a cross-tenant delete into a no-op, which the affectedRows
      // check below already reports as "user not found" — the correct answer for an id
      // that is not this admin's to act on.
      const result = await db.delete(users).where(and(eq(users.orgId, ctx.orgId), eq(users.id, input.userId)));
      if (affectedRows(result) === 0) throw new Error(`User ${input.userId} not found`);

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

      const result = await db
        .update(users)
        .set({ role: input.role })
        .where(and(eq(users.orgId, ctx.orgId), eq(users.id, input.userId)));
      if (affectedRows(result) === 0) throw new Error(`User ${input.userId} not found`);

      return { success: true };
    }),
});
