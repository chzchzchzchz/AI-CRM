import { router, publicProcedure } from "./_core/trpc";
import { validatePasswordComplexity, logSecurityEvent, enforceSendCooldown } from "./_core/security";
import { sendVerificationEmail, sendPasswordResetEmail } from "./_core/email";

// The plaintext code is delivered by EMAIL. Only echo it back in the API response in demo
// mode (so the demo works without a mailer). Returning it in production would let anyone
// request a reset code for any address and read it straight back — account takeover.
const isDemo = () => process.env.DEMO_MODE === "true";
import { z } from "zod";
import { users, emailVerificationCodes, passwordResetCodes } from "../drizzle/schema";
import { getDb } from "./db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateResetCode(): string {
  return crypto.randomBytes(16).toString("hex");
}

export const emailVerificationRouter = router({
  sendVerificationCode: publicProcedure
    .input(z.object({
      userId: z.number(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      enforceSendCooldown(`verify:${input.email}`);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db
        .delete(emailVerificationCodes)
        .where(eq(emailVerificationCodes.userId, input.userId));

      await db.insert(emailVerificationCodes).values({
        userId: input.userId,
        email: input.email,
        code,
        expiresAt,
      });

      await sendVerificationEmail(input.email, code).catch(() => false);
      return isDemo() ? { success: true, code, expiresAt } : { success: true };
    }),

  verifyEmail: publicProcedure
    .input(z.object({
      userId: z.number(),
      code: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const verification = await db
        .select()
        .from(emailVerificationCodes)
        .where(
          and(
            eq(emailVerificationCodes.userId, input.userId),
            eq(emailVerificationCodes.code, input.code)
          )
        )
        .limit(1);

      if (!verification[0]) {
        throw new Error("Invalid verification code");
      }

      const verCode = verification[0];
      if (verCode.expiresAt < new Date()) {
        throw new Error("Verification code expired");
      }

      if ((verCode.attempts || 0) >= 3) {
        throw new Error("Too many attempts. Please request a new code.");
      }

      await db
        .update(emailVerificationCodes)
        .set({ verified: true })
        .where(eq(emailVerificationCodes.id, verCode.id));

      // Note: Email verification does NOT auto-approve users
      // Admin must manually approve via the admin panel or email notification

      return { success: true, message: "Email verified. Your account is pending admin approval." };
    }),

  resendVerificationCode: publicProcedure
    .input(z.object({
      userId: z.number(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      enforceSendCooldown(`verify:${input.email}`);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db
        .delete(emailVerificationCodes)
        .where(eq(emailVerificationCodes.userId, input.userId));

      await db.insert(emailVerificationCodes).values({
        userId: input.userId,
        email: input.email,
        code,
        expiresAt,
      });

      await sendVerificationEmail(input.email, code).catch(() => false);
      return isDemo() ? { success: true, code, expiresAt } : { success: true };
    }),

  sendPasswordResetCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      enforceSendCooldown(`reset:${input.email}`);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (!userResults[0]) {
        return { success: true };
      }

      const user = userResults[0];
      const code = generateResetCode();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db
        .delete(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, user.id));

      await db.insert(passwordResetCodes).values({
        userId: user.id,
        email: input.email,
        code,
        expiresAt,
      });

      await sendPasswordResetEmail(input.email, code).catch(() => false);
      return isDemo() ? { success: true, code } : { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({
      code: z.string(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Validate password complexity
      const passwordError = validatePasswordComplexity(input.newPassword);
      if (passwordError) {
        throw new Error(passwordError);
      }

      const resetCode = await db
        .select()
        .from(passwordResetCodes)
        .where(
          and(
            eq(passwordResetCodes.code, input.code),
            eq(passwordResetCodes.used, false)
          )
        )
        .limit(1);

      if (!resetCode[0]) {
        throw new Error("Invalid reset code");
      }

      const code = resetCode[0];
      if (code.expiresAt < new Date()) {
        throw new Error("Reset code expired");
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 10);

      await db
        .update(users)
        .set({ passwordHash })
        .where(eq(users.id, code.userId));

      await db
        .update(passwordResetCodes)
        .set({ used: true })
        .where(eq(passwordResetCodes.id, code.id));
      
      logSecurityEvent("PASSWORD_RESET", { userId: code.userId, email: code.email }, "info");

      return { success: true };
    }),
});
