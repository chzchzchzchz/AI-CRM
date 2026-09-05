import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { organizationInvites, users } from "../drizzle/schema";
import { affectedRows } from "./_core/affected-rows";
import { validatePasswordComplexity, logSecurityEvent } from "./_core/security";
import {
  INVITE_TTL_MS,
  claimInvite,
  generateInviteToken,
  hashInviteToken,
  lookupInvite,
  rejectionMessage,
} from "./_core/invites";

/**
 * Team invitations — how a customer's colleague joins the customer's workspace.
 *
 * The two paths that existed could not do this. Self-serve signup creates a NEW
 * organization, which is right for a new customer and wrong for their second employee.
 * The public access-request form runs before any session exists, so it has no org to
 * attach to and lands in the default one, where the admin who wanted the teammate never
 * sees it.
 *
 * The invitation carries the org, and it is issued from an admin's session — so which
 * workspace someone joins is decided by a person already inside it, never inferred from
 * an email domain (gmail defeats that) and never chosen by the joiner.
 */
export const invitesRouter = router({
  /**
   * Issue an invitation. Returns the link exactly once.
   *
   * The raw token is never stored and never retrievable again, which is what makes the
   * stored row safe to leak. An admin who loses the link revokes it and sends another —
   * cheap, and far better than a table of working invitations sitting in a backup.
   */
  create: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["user", "admin"]).default("user"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const email = input.email.trim().toLowerCase();

      // Identity is global by email in this app — one address, one account. Inviting an
      // address that already has one cannot silently move that person between
      // organizations, so it is refused with the reason rather than creating a second
      // account they can never sign into.
      // tenancy-exempt: identity lookup by email; addresses are unique across every org
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        throw new Error(
          existing.orgId === ctx.orgId
            ? "That person is already in your workspace."
            : "That email already has an account elsewhere and can't be invited."
        );
      }

      const token = generateInviteToken();
      await db.insert(organizationInvites).values({
        orgId: ctx.orgId,
        email,
        role: input.role,
        tokenHash: hashInviteToken(token),
        invitedBy: ctx.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      });

      logSecurityEvent("INVITE_CREATED", { orgId: ctx.orgId, email, by: ctx.user.id }, "info");

      const base = process.env.VITE_APP_URL || `http://localhost:${process.env.PORT || 3333}`;
      return {
        email,
        role: input.role,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
        // Shown once. See the note above on why it is not recoverable.
        acceptUrl: `${base}/accept-invite?token=${encodeURIComponent(token)}`,
      };
    }),

  /** Outstanding invitations for the caller's own organization. Never the token. */
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new Error("Admin access required");
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select({
        id: organizationInvites.id,
        email: organizationInvites.email,
        role: organizationInvites.role,
        expiresAt: organizationInvites.expiresAt,
        acceptedAt: organizationInvites.acceptedAt,
        revokedAt: organizationInvites.revokedAt,
        createdAt: organizationInvites.createdAt,
      })
      .from(organizationInvites)
      .where(eq(organizationInvites.orgId, ctx.orgId))
      .orderBy(desc(organizationInvites.createdAt));

    return rows.map((r: any) => ({
      ...r,
      status: r.revokedAt
        ? ("revoked" as const)
        : r.acceptedAt
          ? ("accepted" as const)
          : new Date(r.expiresAt).getTime() <= Date.now()
            ? ("expired" as const)
            : ("pending" as const),
    }));
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new Error("Admin access required");
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db
        .update(organizationInvites)
        .set({ revokedAt: new Date() })
        .where(and(eq(organizationInvites.orgId, ctx.orgId), eq(organizationInvites.id, input.id)));

      // Reporting success for an invitation in someone else's org — or one that never
      // existed — would tell an admin they had closed a way into their workspace when
      // they had not.
      if (affectedRows(result) === 0) throw new Error("That invitation is not yours to revoke.");
      return { success: true };
    }),

  /**
   * What the person standing at the link sees before they type anything.
   *
   * Deliberately public and deliberately thin: the email the invitation was sent to, so
   * they can tell they have the right one. Nothing about the organization's data, and
   * nothing that distinguishes a real workspace from an empty one.
   */
  preview: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = await getDb();
      const found = await lookupInvite(db, input.token);
      if (!found.ok) return { valid: false as const, message: rejectionMessage(found.reason) };
      return { valid: true as const, email: found.invite.email, role: found.invite.role };
    }),

  /** Accept an invitation: create the account, inside the inviting organization. */
  accept: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        name: z.string().min(1),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const found = await lookupInvite(db, input.token);
      if (!found.ok) throw new Error(rejectionMessage(found.reason));

      const passwordError = validatePasswordComplexity(input.password);
      if (passwordError) throw new Error(passwordError);

      // tenancy-exempt: identity lookup by email; addresses are unique across every org
      const [taken] = await db
        .select()
        .from(users)
        .where(eq(users.email, found.invite.email))
        .limit(1);
      if (taken) throw new Error("An account with this email already exists. Try signing in instead.");

      // Claim BEFORE creating the user. Two people opening the same link at once would
      // otherwise both pass every check above and both get an account; the loser of this
      // race is told the invitation is spent rather than quietly given a second seat.
      const claimed = await claimInvite(db, found.invite.id);
      if (!claimed) throw new Error(rejectionMessage("already-accepted"));

      const passwordHash = await bcrypt.hash(input.password, 10);
      const openId = `invite_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // The org comes from the invitation itself — resolved above, never from input.
      await db.insert(users).values({
        orgId: found.invite.orgId,
        openId,
        email: found.invite.email,
        name: input.name,
        passwordHash,
        loginMethod: "email",
        // An invitation IS the approval. Making the invitee wait for a second approval
        // from the admin who just invited them is a queue with nothing in it.
        isApproved: true,
        role: found.invite.role,
      });

      logSecurityEvent(
        "INVITE_ACCEPTED",
        { orgId: found.invite.orgId, email: found.invite.email },
        "info"
      );

      return { success: true, email: found.invite.email };
    }),
});
