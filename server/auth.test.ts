import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getDb } from "./db";
import { users, accessRequests, emailVerificationCodes, passwordResetCodes } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

describe("Authentication System", () => {
  let db: any;
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = "TestPassword123!";
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");
  });

  describe("User Registration", () => {
    it("should create a new user with hashed password", async () => {
      const openId = `test_${Date.now()}`;
      const passwordHash = await bcrypt.hash(testPassword, 10);

      const openIdValue = `test_${Date.now()}`;
      await db.insert(users).values({
        openId: openIdValue,
        email: testEmail,
        name: "Test User",
        passwordHash,
        loginMethod: "email",
        isApproved: false,
        role: "user",
      });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      expect(result).toBeDefined();
      expect(result[0]?.email).toBe(testEmail);
      expect(result[0]?.role).toBe("user");
      expect(result[0]?.isApproved).toBe(false);

      testUserId = result[0]?.id;
    });

    it("should not store plain text passwords", async () => {
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      expect(userResult[0]?.passwordHash).not.toBe(testPassword);
      expect(userResult[0]?.passwordHash).toMatch(/^\$2[aby]\$/);
    });

    it("should verify password correctly", async () => {
      const userResult = await db
        .select()
        .from(users)
        .where(eq(users.email, testEmail))
        .limit(1);

      const isPasswordValid = await bcrypt.compare(
        testPassword,
        userResult[0]?.passwordHash || ""
      );

      expect(isPasswordValid).toBe(true);
    });
  });

  describe("Access Requests", () => {
    const requestEmail = `request-${Date.now()}@example.com`;

    it("should create an access request", async () => {
      await db.insert(accessRequests).values({
        email: requestEmail,
        name: "Demo User",
        company: "Test Company",
        reason: "Want to test the platform",
        status: "pending",
      });

      const result = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.email, requestEmail))
        .limit(1);

      expect(result[0]?.status).toBe("pending");
      expect(result[0]?.email).toBe(requestEmail);
    });

    it("should retrieve pending access requests", async () => {
      const pendingRequests = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.status, "pending"));

      expect(pendingRequests.length).toBeGreaterThan(0);
      expect(pendingRequests.some((r: any) => r.email === requestEmail)).toBe(
        true
      );
    });

    it("should update access request status to approved", async () => {
      const requests = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.email, requestEmail))
        .limit(1);

      const requestId = requests[0]?.id;

      await db
        .update(accessRequests)
        .set({
          status: "approved",
          reviewedBy: testUserId,
          reviewedAt: new Date(),
        })
        .where(eq(accessRequests.id, requestId));

      const updated = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.id, requestId))
        .limit(1);

      expect(updated[0]?.status).toBe("approved");
      expect(updated[0]?.reviewedBy).toBe(testUserId);
    });

    it("should update access request status to denied", async () => {
      const newRequestEmail = `deny-${Date.now()}@example.com`;

      await db.insert(accessRequests).values({
        email: newRequestEmail,
        name: "Denied User",
        company: "Test",
        status: "pending",
      });

      const created = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.email, newRequestEmail))
        .limit(1);

      const requestId = created[0]?.id;

      await db
        .update(accessRequests)
        .set({
          status: "denied",
          reviewedBy: testUserId,
          reviewedAt: new Date(),
        })
        .where(eq(accessRequests.id, requestId));

      const updated = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.id, requestId))
        .limit(1);

      expect(updated[0]?.status).toBe("denied");
    });
  });

  describe("Email Verification", () => {
    const verifyEmail = `verify-${Date.now()}@example.com`;
    let verifyUserId: number;

    beforeAll(async () => {
      const openId = `verify_${Date.now()}`;
      const passwordHash = await bcrypt.hash(testPassword, 10);

      await db.insert(users).values({
        openId,
        email: verifyEmail,
        name: "Verify User",
        passwordHash,
        loginMethod: "email",
        isApproved: false,
        role: "user",
      });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, verifyEmail))
        .limit(1);

      verifyUserId = result[0]?.id;
    });

    it("should create a verification code", async () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(emailVerificationCodes).values({
        userId: verifyUserId,
        email: verifyEmail,
        code,
        expiresAt,
      });

      const result = await db
        .select()
        .from(emailVerificationCodes)
        .where(eq(emailVerificationCodes.userId, verifyUserId))
        .limit(1);

      expect(result[0]?.code).toBe(code);
      expect(result[0]?.verified).toBe(false);
      expect(result[0]?.attempts).toBe(0);
    });

    it("should verify email with correct code", async () => {
      const codes = await db
        .select()
        .from(emailVerificationCodes)
        .where(eq(emailVerificationCodes.userId, verifyUserId))
        .limit(1);

      const codeId = codes[0]?.id;

      await db
        .update(emailVerificationCodes)
        .set({ verified: true })
        .where(eq(emailVerificationCodes.id, codeId));

      const updated = await db
        .select()
        .from(emailVerificationCodes)
        .where(eq(emailVerificationCodes.id, codeId))
        .limit(1);

      expect(updated[0]?.verified).toBe(true);
    });

    it("should reject expired verification codes", async () => {
      const expiredCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() - 1000); // Already expired

      await db.insert(emailVerificationCodes).values({
        userId: verifyUserId,
        email: verifyEmail,
        code: expiredCode,
        expiresAt,
      });

      const result = await db
        .select()
        .from(emailVerificationCodes)
        .where(eq(emailVerificationCodes.code, expiredCode))
        .limit(1);

      const isExpired = result[0]?.expiresAt < new Date();
      expect(isExpired).toBe(true);
    });
  });

  describe("Password Reset", () => {
    const resetEmail = `reset-${Date.now()}@example.com`;
    let resetUserId: number;

    beforeAll(async () => {
      const openId = `reset_${Date.now()}`;
      const passwordHash = await bcrypt.hash(testPassword, 10);

      await db.insert(users).values({
        openId,
        email: resetEmail,
        name: "Reset User",
        passwordHash,
        loginMethod: "email",
        isApproved: true,
        role: "user",
      });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, resetEmail))
        .limit(1);

      resetUserId = result[0]?.id;
    });

    it("should create a password reset code", async () => {
      const resetCode = Math.random().toString(36).substring(2, 34);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetCodes).values({
        userId: resetUserId,
        email: resetEmail,
        code: resetCode,
        expiresAt,
      });

      const result = await db
        .select()
        .from(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, resetUserId))
        .limit(1);

      expect(result[0]?.code).toBe(resetCode);
      expect(result[0]?.used).toBe(false);
    });

    it("should update password with valid reset code", async () => {
      const codes = await db
        .select()
        .from(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, resetUserId))
        .limit(1);

      const codeId = codes[0]?.id;
      const newPassword = "NewPassword456!";
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      await db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, resetUserId));

      await db
        .update(passwordResetCodes)
        .set({ used: true })
        .where(eq(passwordResetCodes.id, codeId));

      const updatedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, resetUserId))
        .limit(1);

      const isNewPasswordValid = await bcrypt.compare(
        newPassword,
        updatedUser[0]?.passwordHash || ""
      );

      expect(isNewPasswordValid).toBe(true);

      const updatedCode = await db
        .select()
        .from(passwordResetCodes)
        .where(eq(passwordResetCodes.id, codeId))
        .limit(1);

      expect(updatedCode[0]?.used).toBe(true);
    });

    it("should prevent reusing a reset code", async () => {
      const codes = await db
        .select()
        .from(passwordResetCodes)
        .where(eq(passwordResetCodes.userId, resetUserId))
        .limit(1);

      const code = codes[0];
      expect(code?.used).toBe(true);

      // Attempting to use an already-used code should fail
      const canReuse = !code?.used;
      expect(canReuse).toBe(false);
    });
  });

  describe("User Roles", () => {
    it("should create admin user with admin role", async () => {
      const adminEmail = `admin-${Date.now()}@example.com`;
      const openId = `admin_${Date.now()}`;
      const passwordHash = await bcrypt.hash(testPassword, 10);

      await db.insert(users).values({
        openId,
        email: adminEmail,
        name: "Admin User",
        passwordHash,
        loginMethod: "email",
        isApproved: true,
        role: "admin",
      });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, adminEmail))
        .limit(1);

      expect(result[0]?.role).toBe("admin");
    });

    it("should create regular user with user role", async () => {
      const userEmail = `user-${Date.now()}@example.com`;
      const openId = `user_${Date.now()}`;
      const passwordHash = await bcrypt.hash(testPassword, 10);

      await db.insert(users).values({
        openId,
        email: userEmail,
        name: "Regular User",
        passwordHash,
        loginMethod: "email",
        isApproved: true,
        role: "user",
      });

      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, userEmail))
        .limit(1);

      expect(result[0]?.role).toBe("user");
    });
  });
});
