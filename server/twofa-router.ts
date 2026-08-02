/**
 * Two-factor authentication — enrolment, status and removal.
 *
 * The login-time half lives in routers.ts (`auth.login` and `auth.loginVerify`), because
 * it has to run before a session exists. Everything here is session-scoped: you must
 * already be signed in to turn 2FA on, look at it, or turn it off.
 *
 * The previous version of this file was never mounted on the router, which is how it
 * came to ship with a `verify` procedure that required a session in order to complete a
 * login, and ten backup codes that were generated from Math.random() and then thrown
 * away — there was no column to put them in. Nothing exercised any of it, so nothing
 * noticed. The crypto now lives in ./twofa with tests around it.
 */
import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
// @ts-ignore - speakeasy doesn't have TypeScript definitions
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { send2FASetupEmail } from "./_core/email";
import { getCompanyConfig } from "./config";
import {
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  countBackupCodes,
  BACKUP_CODE_COUNT,
} from "./twofa";

const sp = speakeasy as any;

export const twoFARouter = router({
  /**
   * Start enrolment: a fresh secret and the QR code for it.
   *
   * Nothing is written here. The secret only reaches the database once the user has
   * proved they can produce a code from it, so an abandoned enrolment cannot lock
   * anyone out of their own account.
   */
  generateSecret: protectedProcedure.query(async ({ ctx }) => {
    const productName = getCompanyConfig().productName;
    const secret = sp.generateSecret({
      name: `${productName} (${ctx.user.email})`,
      issuer: productName,
      length: 32,
    });

    return {
      secret: secret.base32 as string,
      qrCode: await QRCode.toDataURL(secret.otpauth_url || ""),
    };
  }),

  /**
   * Finish enrolment.
   *
   * The backup codes are returned here in the clear — the only time they are ever
   * visible — and stored as bcrypt hashes. They cannot be shown again, which the UI
   * says before the user can navigate away.
   */
  enable: protectedProcedure
    .input(
      z.object({
        secret: z.string().min(16),
        verificationCode: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      if (!verifyTotp(input.secret, input.verificationCode)) {
        throw new Error("That code didn't match. Check your authenticator app and try again.");
      }

      const backupCodes = generateBackupCodes();
      await db
        .update(users)
        .set({
          twoFactorSecret: input.secret,
          twoFactorEnabled: true,
          twoFactorBackupCodes: await hashBackupCodes(backupCodes),
        })
        .where(eq(users.id, ctx.user.id));

      // Best effort: a mail failure must not leave 2FA half-enabled.
      try {
        await send2FASetupEmail(ctx.user.email as string);
      } catch (e) {
        console.error("[2fa] enabled, but the confirmation email failed:", e);
      }

      return { success: true, backupCodes };
    }),

  /** Issue a fresh set of recovery codes, invalidating the old ones. */
  regenerateBackupCodes: protectedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.twoFactorEnabled) throw new Error("2FA is not enabled");
      if (!(await bcrypt.compare(input.password, (user.passwordHash as string) || ""))) {
        throw new Error("Invalid password");
      }

      const backupCodes = generateBackupCodes();
      await db
        .update(users)
        .set({ twoFactorBackupCodes: await hashBackupCodes(backupCodes) })
        .where(eq(users.id, ctx.user.id));

      return { success: true, backupCodes };
    }),

  /**
   * Turn 2FA off.
   *
   * Password-gated: someone who walks up to an unlocked laptop should not be able to
   * remove the second factor. The stored secret and codes are cleared rather than just
   * the flag, so re-enabling always starts a fresh enrolment.
   */
  disable: protectedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new Error("User not found");
      if (!(await bcrypt.compare(input.password, (user.passwordHash as string) || ""))) {
        throw new Error("Invalid password");
      }

      await db
        .update(users)
        .set({ twoFactorSecret: null, twoFactorEnabled: false, twoFactorBackupCodes: null })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  /** Whether 2FA is on, and how many recovery codes are left to warn about. */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) throw new Error("User not found");

    return {
      enabled: !!user.twoFactorEnabled,
      backupCodesRemaining: countBackupCodes(user.twoFactorBackupCodes as string | null),
      backupCodeTotal: BACKUP_CODE_COUNT,
    };
  }),
});
