import { auditLogs } from "../../drizzle/schema";
import { getDb } from "../db";

export type AuditEventType =
  | "USER_SIGNUP"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "USER_PASSWORD_RESET"
  | "USER_EMAIL_VERIFIED"
  | "ACCESS_REQUEST_CREATED"
  | "ACCESS_REQUEST_APPROVED"
  | "ACCESS_REQUEST_DENIED"
  | "ADMIN_2FA_ENABLED"
  | "ADMIN_2FA_DISABLED"
  | "ADMIN_APPROVED_REQUEST"
  | "ADMIN_DENIED_REQUEST";

export interface AuditLogEntry {
  userId: number;
  /**
   * The tenant the event belongs to. Optional because the events that matter most —
   * a failed login, a signup — happen before any session exists, and inventing an org
   * for them would file one tenant's failed logins under another's audit trail.
   * Unset means "not attributable to an organization", which is the honest record.
   */
  orgId?: number;
  eventType: AuditEventType;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an audit event
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("Database not available for audit logging");
      return;
    }

    await db.insert(auditLogs).values({
      // Unset stays unset rather than defaulting: an event that cannot be attributed to
      // an org should not be filed under one. Reads filter on orgId, so these appear in
      // no tenant's audit view — which is correct for a pre-session event.
      orgId: entry.orgId,
      userId: entry.userId,
      eventType: entry.eventType,
      description: entry.description,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

/**
 * Log user signup
 */
export async function logUserSignup(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "USER_SIGNUP",
    description: `User signed up with email: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log user login
 */
export async function logUserLogin(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "USER_LOGIN",
    description: `User logged in: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log user logout
 */
export async function logUserLogout(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "USER_LOGOUT",
    description: `User logged out: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log password reset
 */
export async function logPasswordReset(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "USER_PASSWORD_RESET",
    description: `User reset password: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log email verification
 */
export async function logEmailVerified(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "USER_EMAIL_VERIFIED",
    description: `User verified email: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log access request creation
 */
export async function logAccessRequestCreated(
  userId: number,
  requestId: number,
  email: string,
  company: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "ACCESS_REQUEST_CREATED",
    description: `Access request created for ${email} from ${company}`,
    ipAddress,
    userAgent,
    metadata: { requestId, email, company },
  });
}

/**
 * Log access request approval
 */
export async function logAccessRequestApproved(
  adminId: number,
  requestId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId: adminId,
    eventType: "ACCESS_REQUEST_APPROVED",
    description: `Admin approved access request for ${email}`,
    ipAddress,
    userAgent,
    metadata: { requestId, email },
  });
}

/**
 * Log access request denial
 */
export async function logAccessRequestDenied(
  adminId: number,
  requestId: number,
  email: string,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId: adminId,
    eventType: "ACCESS_REQUEST_DENIED",
    description: `Admin denied access request for ${email}${reason ? `: ${reason}` : ""}`,
    ipAddress,
    userAgent,
    metadata: { requestId, email, reason },
  });
}

/**
 * Log 2FA enabled
 */
export async function log2FAEnabled(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "ADMIN_2FA_ENABLED",
    description: `Admin enabled 2FA: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}

/**
 * Log 2FA disabled
 */
export async function log2FADisabled(
  userId: number,
  email: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuditEvent({
    userId,
    eventType: "ADMIN_2FA_DISABLED",
    description: `Admin disabled 2FA: ${email}`,
    ipAddress,
    userAgent,
    metadata: { email },
  });
}
