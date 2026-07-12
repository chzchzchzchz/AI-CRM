import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
// @ts-ignore - speakeasy doesn't have TypeScript definitions
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { send2FASetupEmail } from "./_core/email";
import { getCompanyConfig } from "./config";

// Use any type for speakeasy since it doesn't have TypeScript definitions
const speakeasyAny = speakeasy as any;

export const twoFARouter = router({
  /**
   * Generate 2FA secret and QR code for user
   */
  generateSecret: protectedProcedure.query(async ({ ctx }) => {
    try {
      const productName = getCompanyConfig().productName;
      const secret = speakeasyAny.generateSecret({
        name: `${productName} (${ctx.user.email})`,
        issuer: productName,
        length: 32,
      }) as any;

      // Generate QR code as data URL
      const qrCode = await QRCode.toDataURL(secret.otpauth_url || "");

      return {
        secret: secret.base32 as string,
        qrCode,
        backupCodes: generateBackupCodes(),
      };
    } catch (error) {
      console.error("Failed to generate 2FA secret:", error);
      throw new Error("Failed to generate 2FA secret");
    }
  }),

  /**
   * Enable 2FA for user
   */
  enable: protectedProcedure
    .input(
      z.object({
        secret: z.string(),
        verificationCode: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verify the code is correct
        const isValidCode = speakeasyAny.totp.verify({
          secret: input.secret,
          encoding: "base32",
          token: input.verificationCode,
          window: 2,
        });

        if (!isValidCode) {
          throw new Error("Invalid verification code");
        }

        // Save 2FA secret to user
        await db
          .update(users)
          .set({
            twoFactorSecret: input.secret,
            twoFactorEnabled: true,
          })
          .where(eq(users.id, ctx.user.id));

        // Send confirmation email
        await send2FASetupEmail(ctx.user.email as string);

        return {
          success: true,
          message: "2FA enabled successfully",
          backupCodes: generateBackupCodes(),
        };
      } catch (error) {
        console.error("Failed to enable 2FA:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to enable 2FA"
        );
      }
    }),

  /**
   * Disable 2FA for user
   */
  disable: protectedProcedure
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Verify password before disabling 2FA
        const userResult = await db
          .select()
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        if (!userResult[0]) {
          throw new Error("User not found");
        }

        const bcrypt = await import("bcryptjs");
        // @ts-ignore
        const isPasswordValid = await bcrypt.compare(
          input.password,
          (userResult[0].passwordHash as string) || ""
        );

        if (!isPasswordValid) {
          throw new Error("Invalid password");
        }

        // Disable 2FA
        await db
          .update(users)
          .set({
            twoFactorSecret: null,
            twoFactorEnabled: false,
          })
          .where(eq(users.id, ctx.user.id));

        return { success: true, message: "2FA disabled successfully" };
      } catch (error) {
        console.error("Failed to disable 2FA:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to disable 2FA"
        );
      }
    }),

  /**
   * Verify 2FA code during login
   */
  verify: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const userResult = await db
          .select()
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

      if (!userResult[0]?.twoFactorSecret || !userResult[0]?.twoFactorEnabled) {
        throw new Error("2FA not enabled for this user");
      }

        // Verify the code
        const secret = userResult[0].twoFactorSecret as string;
        const isValidCode = speakeasyAny.totp.verify({
          secret,
          encoding: "base32",
          token: input.code,
          window: 2,
        });

        if (!isValidCode) {
          throw new Error("Invalid 2FA code");
        }

        return { success: true, message: "2FA verification successful" };
      } catch (error) {
        console.error("Failed to verify 2FA code:", error);
        throw new Error(
          error instanceof Error ? error.message : "Failed to verify 2FA code"
        );
      }
    }),

  /**
   * Get 2FA status for current user
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!userResult[0]) {
        throw new Error("User not found");
      }

      return {
        enabled: userResult[0].twoFactorEnabled || false,
        hasSecret: !!userResult[0].twoFactorSecret,
      };
    } catch (error) {
      console.error("Failed to get 2FA status:", error);
      throw new Error("Failed to get 2FA status");
    }
  }),
});

/**
 * Generate backup codes for 2FA
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 10; i++) {
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}
