import { router, publicProcedure } from "./_core/trpc";
import { validatePasswordComplexity, logSecurityEvent, enforceSendCooldown } from "./_core/security";
import { sendVerificationEmail, sendPasswordResetEmail } from "./_core/email";
import { withUserLock } from "./twofa";

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

/**
 * Constant-time comparison, so response timing doesn't leak how much of a guessed
 * code was correct. Length is compared first because timingSafeEqual throws on a
 * length mismatch — that branch reveals only the length, which is fixed and public.
 */
export function codesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const emailVerificationRouter = router({
  sendVerificationCode: publicProcedure
    .input(z.object({
      userId: z.number(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      await enforceSendCooldown(`verify:${input.email}`);
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

      // Capture whether the send actually worked instead of discarding it — see
      // sendPasswordResetCode below, which had the identical bug. SignUp.tsx has no
      // branch for a failed send, only a thrown error, which this mutation never
      // produces on its own: it always resolved successfully even when
      // sendVerificationEmail returned false because SendGrid was unconfigured or down,
      // so the verify screen said "We sent a 6-digit code" to an address that never
      // got one, with resend reporting the same false success.
      const emailSent = await sendVerificationEmail(input.email, code).catch(() => false);
      return isDemo() ? { success: true, emailSent, code, expiresAt } : { success: true, emailSent };
    }),

  verifyEmail: publicProcedure
    .input(z.object({
      userId: z.number(),
      code: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Look the row up by user, NOT by (user, code).
      //
      // Matching on the code meant a wrong guess found no row and returned "Invalid
      // verification code" without touching `attempts` — so the three-attempt limit
      // below could never fire and the six-digit code was open to brute force. The
      // counter only means something if a failed guess is what increments it.
      //
      // The read-check-increment below is a read-modify-write with no compare-and-swap,
      // same shape as the 2FA backup-code race withUserLock exists for (see twofa.ts):
      // N concurrent guesses all read the same `attempts` value and each write back
      // `that value + 1`, so firing guesses in parallel instead of sequentially lets
      // more than 3 real attempts land before the cap engages — a six-digit code
      // (1,000,000 possibilities) is exactly what an attempt cap needs to hold the
      // line against. Queuing every verification attempt for this user behind the
      // previous one closes it: each request's read always sees the prior request's
      // write.
      return await withUserLock(input.userId, async () => {
        const verification = await db
          .select()
          .from(emailVerificationCodes)
          .where(eq(emailVerificationCodes.userId, input.userId))
          .limit(1);

        if (!verification[0]) {
          throw new Error("Invalid verification code");
        }

        const verCode = verification[0];

        // Checked before the comparison: an exhausted code must stop being an oracle.
        if ((verCode.attempts || 0) >= 3) {
          throw new Error("Too many attempts. Please request a new code.");
        }

        if (verCode.expiresAt < new Date()) {
          throw new Error("Verification code expired");
        }

        if (!codesMatch(verCode.code, input.code)) {
          await db
            .update(emailVerificationCodes)
            .set({ attempts: (verCode.attempts || 0) + 1 })
            .where(eq(emailVerificationCodes.id, verCode.id));
          logSecurityEvent(
            "EMAIL_VERIFICATION_FAILED",
            { userId: input.userId, attempts: (verCode.attempts || 0) + 1 },
            "warn"
          );
          throw new Error("Invalid verification code");
        }

        await db
          .update(emailVerificationCodes)
          .set({ verified: true })
          .where(eq(emailVerificationCodes.id, verCode.id));

        // Note: Email verification does NOT auto-approve users
        // Admin must manually approve via the admin panel or email notification

        return { success: true, message: "Email verified. Your account is pending admin approval." };
      });
    }),

  resendVerificationCode: publicProcedure
    .input(z.object({
      userId: z.number(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      await enforceSendCooldown(`verify:${input.email}`);
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

      const emailSent = await sendVerificationEmail(input.email, code).catch(() => false);
      return isDemo() ? { success: true, emailSent, code, expiresAt } : { success: true, emailSent };
    }),

  sendPasswordResetCode: publicProcedure
    .input(z.object({
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      await enforceSendCooldown(`reset:${input.email}`);
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Stored addresses are lowercased at signup (server/routers.ts signUp) —
      // normalize here too, or a user who types a different case than they signed up
      // with is told (indirectly, via the anti-enumeration success response) that a
      // code was sent when no account was actually found.
      // tenancy-exempt: identity lookup by email, before any session exists; email is globally unique across orgs
      const userResults = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email.trim().toLowerCase()))
        .limit(1);

      if (!userResults[0]) {
        // Deliberately indistinguishable from the "sent" branch below — a different
        // response here would let a caller learn whether an email has an account
        // (`emailSent` present vs absent, or a different value) without ever needing a
        // password. This is the standard anti-enumeration shape for a reset flow.
        return { success: true, emailSent: true };
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

      // Capture whether the send actually worked instead of discarding it. The client
      // used to say "Reset code sent to your email!" unconditionally — including with
      // no SENDGRID_API_KEY configured, where sendEmail() warns and returns false and
      // nothing was ever sent. In demo mode the code rides along in the response either
      // way, which is how a self-hosted install with no mailer configured can still
      // complete the flow — but the CLIENT never read it, so even that safety net was
      // dead code, and a real deployment with a broken mailer told the user their
      // recovery code was on its way when it was gone.
      const emailSent = await sendPasswordResetEmail(input.email, code).catch(() => false);
      return isDemo() ? { success: true, emailSent, code } : { success: true, emailSent };
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

      // tenancy-exempt: auth path — runs before a session exists, so there is no org to filter by
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
