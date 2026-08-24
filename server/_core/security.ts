import type { Request, Response, NextFunction } from "express";
import cors from "cors";

/**
 * Security middleware for the TargetDash
 * Implements rate limiting, brute force protection, and security headers
 */

// In-memory store for rate limiting (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const loginAttemptStore = new Map<string, { count: number; lockUntil: number }>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 1000; // Max requests per window
const LOGIN_MAX_ATTEMPTS = 5; // Max login attempts before lockout
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout

/**
 * Get client IP address from request.
 *
 * `X-Forwarded-For` is a request header — the client sets it, same as any other. It is
 * only meaningful when a real proxy in front of this process overwrites whatever the
 * client sent with the actual upstream address. Reading it unconditionally (as this did)
 * means anyone can pick their own value for it, and the login lockout below is keyed on
 * this return value. Confirmed live: five wrong passwords sent with
 * `x-forwarded-for: 10.9.9.9` locks that string out; the very next request — same
 * client, same connection — with the header changed to `10.9.9.13` is back to "Invalid
 * email or password" instead of "Too many attempts". The header costs nothing to change
 * and the lockout was resetting every time, which is unlimited password guessing from a
 * single real host.
 *
 * `req.socket.remoteAddress` is the actual TCP peer address Node observed — it is not a
 * header, so nothing in the request body or headers can set it. Only fall back to the
 * client-supplied header when the operator has explicitly confirmed a trusted proxy sits
 * in front and controls it (`TRUST_PROXY=true`); this app sets no such thing by default.
 */
export function getClientIP(req: Request): string {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = req.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
      return ips.trim();
    }
  }
  return req.socket.remoteAddress || req.ip || "unknown";
}

/**
 * CORS middleware
 * Configurable Cross-Origin Resource Sharing
 */
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, same-origin navigations).
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== "production") return callback(null, true);

    // A deployment that never sets ALLOWED_ORIGINS used to fall back to a hardcoded
    // localhost:5173, so every browser request from the real domain was "not allowed".
    // Unset now means "same-origin only" — enforced by simply not granting CORS headers.
    const allowed = (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    // Never throw. An Error here becomes a 500 from the CORS middleware, which runs before
    // static files — so one disallowed Origin turned every asset request into an HTML error
    // page (stylesheets rejected for MIME type, app renders blank). Denying simply means
    // withholding the CORS headers; the browser then enforces the policy itself.
    callback(null, allowed.includes(origin));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

export const corsMiddleware = cors(corsOptions);

/**
 * Security headers middleware
 * Adds essential security headers to all responses
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Enable XSS filter in browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy (disable unnecessary features)
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );
  
  // Content Security Policy (basic - adjust as needed)
  // Note: This is a permissive CSP for development; tighten for production
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https:;"
  );
  
  next();
}

/**
 * General rate limiting middleware
 * Limits requests per IP address
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(rateLimitStore, "resetTime");
  }
  
  const record = rateLimitStore.get(clientIP);
  
  if (!record || now > record.resetTime) {
    // New window
    rateLimitStore.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    next();
    return;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({
      error: "Too many requests",
      message: "Please try again later",
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    });
    return;
  }
  
  record.count++;
  next();
}

/**
 * Login-specific rate limiting (brute force protection)
 * More aggressive limiting for authentication endpoints
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIP = getClientIP(req);
  const now = Date.now();
  
  // Clean up expired entries periodically
  if (Math.random() < 0.05) {
    cleanupExpiredEntries(loginAttemptStore, "lockUntil");
  }
  
  const record = loginAttemptStore.get(clientIP);
  
  // Check if currently locked out
  if (record && record.lockUntil > now) {
    const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
    res.status(429).json({
      error: "Account temporarily locked",
      message: `Too many login attempts. Please try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
      retryAfter: remainingSeconds,
    });
    return;
  }
  
  next();
}

/**
 * The lockout used to be keyed by IP alone, and clearLoginAttempts deleted the whole
 * per-IP record on ANY successful login from that IP — not just the account that
 * succeeded. On a shared IP (office NAT, VPN, CGNAT, campus wifi) that meant one
 * employee's ordinary, unrelated successful login silently wiped out an attacker's
 * accumulated failed attempts against a DIFFERENT coworker's account on the same
 * connection, handing the attacker a fresh 5-attempt budget every time anyone else on
 * that IP happened to sign in. Keying by (IP, account) instead means a success only
 * ever clears the record for the account that just succeeded. The separate, coarser
 * per-IP `rateLimiter` (1000 req/15 min, independent of this) still throttles raw
 * request volume from one source regardless of which account it targets.
 */
function lockoutKey(clientIP: string, email: string): string {
  return `${clientIP}::${email.trim().toLowerCase()}`;
}

/**
 * Record a failed login attempt
 * Call this after a failed login
 */
export function recordFailedLogin(clientIP: string, email: string): void {
  const key = lockoutKey(clientIP, email);
  const now = Date.now();
  const record = loginAttemptStore.get(key);

  // Start fresh only when there is no record, or a PRIOR lockout has since expired.
  // (The old check `record.lockUntil < now` was always true while lockUntil was 0, so the
  // counter reset to 1 on every failure and the lockout never triggered.)
  if (!record || (record.lockUntil > 0 && record.lockUntil <= now)) {
    loginAttemptStore.set(key, { count: 1, lockUntil: 0 });
    return;
  }

  record.count++;

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    record.lockUntil = now + LOGIN_LOCKOUT_MS;
    console.warn(`[Security] ${key} locked out after ${record.count} failed login attempts`);
  }
}

// Per-key send cooldown (e.g. verification / reset emails) to stop an attacker using a
// configured mailer to bomb a victim's inbox. In-memory is fine for a single instance.
const sendCooldownStore = new Map<string, number>();
const SEND_COOLDOWN_MS = 60 * 1000;

/**
 * Throws if `key` (e.g. "verify:<email>") was used within the cooldown window; otherwise
 * records "now" and returns. Call before dispatching a verification/reset email.
 */
export function enforceSendCooldown(key: string, cooldownMs = SEND_COOLDOWN_MS): void {
  const now = Date.now();
  const last = sendCooldownStore.get(key);
  if (last && now - last < cooldownMs) {
    const wait = Math.ceil((cooldownMs - (now - last)) / 1000);
    throw new Error(`Please wait ${wait}s before requesting another code.`);
  }
  sendCooldownStore.set(key, now);
  if (sendCooldownStore.size > 5000) {
    for (const [k, t] of sendCooldownStore) if (now - t > cooldownMs) sendCooldownStore.delete(k);
  }
}

/**
 * Whether an IP is currently locked out from logging in, with the remaining seconds.
 * The tRPC login path calls this to ENFORCE the lockout — the express loginRateLimiter
 * only guards express routes, not the tRPC endpoint.
 */
export function getLoginLockout(clientIP: string, email: string): { locked: boolean; retryAfterSeconds: number } {
  const record = loginAttemptStore.get(lockoutKey(clientIP, email));
  const now = Date.now();
  if (record && record.lockUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((record.lockUntil - now) / 1000) };
  }
  return { locked: false, retryAfterSeconds: 0 };
}

/**
 * Clear login attempts after successful login — only for the (IP, account) pair that
 * just succeeded, never the whole IP.
 */
export function clearLoginAttempts(clientIP: string, email: string): void {
  loginAttemptStore.delete(lockoutKey(clientIP, email));
}

/**
 * Clean up expired entries from a store
 */
function cleanupExpiredEntries(
  store: Map<string, { count: number; resetTime?: number; lockUntil?: number }>,
  timeField: "resetTime" | "lockUntil"
): void {
  const now = Date.now();
  const keysToDelete: string[] = [];
  store.forEach((value, key) => {
    const expireTime = value[timeField];
    if (expireTime && expireTime < now) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => store.delete(key));
}

/**
 * Validate password complexity
 * Returns null if valid, error message if invalid
 */
export function validatePasswordComplexity(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters long";
  }
  
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return "Password must contain at least one special character";
  }
  
  // Check for common weak passwords
  const commonPasswords = [
    "password", "12345678", "qwerty123", "admin123", "letmein1",
    "welcome1", "password1", "Password1", "Password123"
  ];
  
  if (commonPasswords.some(weak => password.toLowerCase().includes(weak.toLowerCase()))) {
    return "Password is too common. Please choose a stronger password.";
  }
  
  return null;
}

/**
 * Sanitize user input to prevent XSS
 * Basic HTML entity encoding
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Log security event
 */
export function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>,
  severity: "info" | "warn" | "error" = "info"
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    severity,
    ...details,
  };
  
  switch (severity) {
    case "error":
      console.error("[Security]", JSON.stringify(logEntry));
      break;
    case "warn":
      console.warn("[Security]", JSON.stringify(logEntry));
      break;
    default:
      console.log("[Security]", JSON.stringify(logEntry));
  }
}
