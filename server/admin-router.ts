import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { users, accessRequests } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { isSixsenseConfigured } from "./sixsense";
import { toPublicUser } from "./_core/publicUser";
import { sendAccessApprovalEmail } from "./_core/email";

/**
 * Real mysql2 resolves `db.update(...)`/`db.delete(...)` to a `[ResultSetHeader, ...]`
 * tuple; the demo-mode JSON shim (server/db.ts) resolves to a plain `{ affectedRows }`
 * object instead. Neither shape survives being read the other way — destructuring the
 * shim's result as a tuple throws, and reading `.affectedRows` off the real tuple reads
 * it off an array. This normalizes both so a caller can check the one thing that
 * actually matters here: did the row exist.
 */
function affectedRows(result: unknown): number {
  const row = Array.isArray(result) ? result[0] : result;
  return (row as { affectedRows?: number } | undefined)?.affectedRows ?? 0;
}

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
      // crypto.randomBytes, not Math.random() — this becomes the account's actual login
      // credential, same reasoning as the 2FA recovery codes (server/twofa-router.ts).
      const tempPassword = crypto.randomBytes(12).toString("base64url");
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
        .where(eq(accessRequests.id, input.requestId));
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
    }).from(users).orderBy(users.createdAt);
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
    }).from(users).where(eq(users.isApproved, false)).orderBy(users.createdAt);
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
        .where(eq(users.id, input.userId));
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

      const result = await db.delete(users).where(eq(users.id, input.userId));
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
        .where(eq(users.id, input.userId));
      if (affectedRows(result) === 0) throw new Error(`User ${input.userId} not found`);

      return { success: true };
    }),
});
