import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { emailHistory } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const emailHistoryRouter = router({
  // Save a generated email
  save: protectedProcedure
    .input(z.object({
      accountId: z.number().optional(),
      contactId: z.number().optional(),
      recipientEmail: z.string().optional(),
      subject: z.string(),
      body: z.string(),
      context: z.string().optional(),
      attachmentNames: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(emailHistory).values({
        userId: ctx.user.id,
        accountId: input.accountId,
        contactId: input.contactId,
        recipientEmail: input.recipientEmail,
        subject: input.subject,
        body: input.body,
        context: input.context,
        attachmentNames: input.attachmentNames,
        status: "generated",
      });
      
      return { id: result.insertId };
    }),

  // Get user's email history
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      accountId: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(emailHistory.userId, ctx.user.id)];
      
      if (input.accountId) {
        conditions.push(eq(emailHistory.accountId, input.accountId));
      }
      
      const db = await getDb();
      if (!db) return [];
      const emails = await db
        .select()
        .from(emailHistory)
        .where(and(...conditions))
        .orderBy(desc(emailHistory.createdAt))
        .limit(input.limit);
      
      return emails;
    }),

  // Get a single email by ID
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return null;
      const [email] = await db
        .select()
        .from(emailHistory)
        .where(and(
          eq(emailHistory.id, input.id),
          eq(emailHistory.userId, ctx.user.id)
        ));
      
      return email || null;
    }),

  // Mark email as sent
  markSent: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(emailHistory)
        .set({ status: "sent", sentAt: new Date() })
        .where(and(
          eq(emailHistory.id, input.id),
          eq(emailHistory.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),

  // Delete an email from history
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .delete(emailHistory)
        .where(and(
          eq(emailHistory.id, input.id),
          eq(emailHistory.userId, ctx.user.id)
        ));
      
      return { success: true };
    }),
});
