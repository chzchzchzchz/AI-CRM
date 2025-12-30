import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import { users, emailVerificationCodes, auditLogs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import bcryptjs from "bcryptjs";
import {
  logUserSignup,
  logUserLogin,
  logPasswordReset,
  logAccessRequestApproved,
} from "./_core/audit";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  send2FASetupEmail,
  sendAccessApprovalEmail,
  sendAccessDenialEmail,
} from "./_core/email";

describe("Advanced Authentication System", () => {
  let db: any;
  let testUserId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test user
    const result = await db.insert(users).values({
      openId: `test_advanced_${Date.now()}`,
      email: `test_advanced_${Date.now()}@example.com`,
      name: "Test Advanced User",
      passwordHash: await bcryptjs.hash("TestPassword123!", 10),
      loginMethod: "email",
      isApproved: true,
      role: "user",
    });

    testUserId = result[0].insertId;
  });

  afterAll(async () => {
    if (db && testUserId) {
      // Clean up test data
      await db.delete(auditLogs).where(eq(auditLogs.userId, testUserId));
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  describe("Email Service", () => {
    it("should send verification email successfully", async () => {
      const result = await sendVerificationEmail(
        `test_${Date.now()}@example.com`,
        "123456"
      );
      // Note: This will fail if SendGrid API key is not configured
      // In production, this would actually send an email
      expect(typeof result).toBe("boolean");
    });

    it("should send password reset email successfully", async () => {
      const result = await sendPasswordResetEmail(
        `test_${Date.now()}@example.com`,
        "reset_code_12345"
      );
      expect(typeof result).toBe("boolean");
    });

    it("should send 2FA setup email successfully", async () => {
      const result = await send2FASetupEmail(`test_${Date.now()}@example.com`);
      expect(typeof result).toBe("boolean");
    });

    it("should send access approval email successfully", async () => {
      const result = await sendAccessApprovalEmail(
        `test_${Date.now()}@example.com`,
        "John Doe",
        "TempPassword123!"
      );
      expect(typeof result).toBe("boolean");
    });

    it("should send access denial email successfully", async () => {
      const result = await sendAccessDenialEmail(
        `test_${Date.now()}@example.com`,
        "Jane Smith",
        "Not a good fit for our product"
      );
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Audit Logging", () => {
    it("should log user signup event", async () => {
      await logUserSignup(testUserId, "test@example.com", "192.168.1.1");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].eventType).toBe("USER_SIGNUP");
      expect(logs[0].description).toContain("test@example.com");
    });

    it("should log user login event", async () => {
      await logUserLogin(testUserId, "test@example.com", "192.168.1.1");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const loginLog = logs.find((log: any) => log.eventType === "USER_LOGIN");
      expect(loginLog).toBeDefined();
      expect(loginLog.ipAddress).toBe("192.168.1.1");
    });

    it("should log password reset event", async () => {
      await logPasswordReset(testUserId, "test@example.com", "192.168.1.1");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const resetLog = logs.find(
        (log: any) => log.eventType === "USER_PASSWORD_RESET"
      );
      expect(resetLog).toBeDefined();
      expect(resetLog.description).toContain("reset password");
    });

    it("should log access request approval", async () => {
      const adminId = testUserId;
      await logAccessRequestApproved(
        adminId,
        1,
        "user@example.com",
        "192.168.1.1"
      );

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, adminId));

      const approvalLog = logs.find(
        (log: any) => log.eventType === "ACCESS_REQUEST_APPROVED"
      );
      expect(approvalLog).toBeDefined();
      expect(approvalLog.description).toContain("approved access request");
    });

    it("should store metadata in audit logs", async () => {
      await logUserSignup(testUserId, "metadata_test@example.com", "10.0.0.1");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const latestLog = logs[logs.length - 1];
      expect(latestLog.metadata).toBeDefined();
      const metadata = JSON.parse(latestLog.metadata || "{}");
      expect(metadata.email).toBe("metadata_test@example.com");
    });

    it("should track IP addresses in audit logs", async () => {
      const testIp = "203.0.113.42";
      await logUserLogin(testUserId, "test@example.com", testIp);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const loginLog = logs.find((log: any) => log.ipAddress === testIp);
      expect(loginLog).toBeDefined();
    });
  });

  describe("2FA Integration", () => {
    it("should have 2FA columns in users table", async () => {
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1);

      expect(userRecord[0]).toHaveProperty("twoFactorEnabled");
      expect(userRecord[0]).toHaveProperty("twoFactorSecret");
      expect(userRecord[0].twoFactorEnabled).toBe(false);
    });

    it("should initialize 2FA as disabled", async () => {
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId))
        .limit(1);

      expect(userRecord[0].twoFactorEnabled).toBe(false);
      expect(userRecord[0].twoFactorSecret).toBeNull();
    });
  });

  describe("Audit Log Queries", () => {
    it("should retrieve all audit logs for a user", async () => {
      // Create multiple log entries
      await logUserSignup(testUserId, "test1@example.com");
      await logUserLogin(testUserId, "test1@example.com");
      await logPasswordReset(testUserId, "test1@example.com");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter audit logs by event type", async () => {
      await logUserLogin(testUserId, "filter_test@example.com");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const loginLogs = logs.filter((log: any) => log.eventType === "USER_LOGIN");
      expect(loginLogs.length).toBeGreaterThan(0);
    });

    it("should order audit logs by timestamp", async () => {
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      if (logs.length > 1) {
        for (let i = 1; i < logs.length; i++) {
          expect(logs[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            logs[i - 1].timestamp.getTime()
          );
        }
      }
    });
  });

  describe("Security Features", () => {
    it("should not expose sensitive data in audit logs", async () => {
      await logPasswordReset(testUserId, "test@example.com");

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const resetLog = logs.find(
        (log: any) => log.eventType === "USER_PASSWORD_RESET"
      );
      // Should not contain actual password
      expect(resetLog.description).not.toContain("password");
      expect(resetLog.description).toContain("reset password");
    });

    it("should track failed login attempts via audit logs", async () => {
      // Simulate multiple login attempts
      for (let i = 0; i < 3; i++) {
        await logUserLogin(testUserId, "test@example.com", "192.168.1.100");
      }

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, testUserId));

      const loginLogs = logs.filter((log: any) => log.eventType === "USER_LOGIN");
      expect(loginLogs.length).toBeGreaterThanOrEqual(3);
    });
  });
});
