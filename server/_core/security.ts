import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import crypto from "crypto";
import { getStore } from "./shared-store";

/**
 * Security middleware for the TargetDash
 * Implements rate limiting, brute force protection, and security headers
 */

/**
 * Constant-time comparison for a secret received in a request (a webhook token, an
 * API key) against the configured value. A plain !== short-circuits at the first
 * mismatched character, which can leak — through response timing — how many leading
 * characters a guess got right. Same reasoning email-verification-router.ts's
 * codesMatch already applies to guessed verification codes; this is the equivalent
 * for the three publicProcedure webhook receivers (Clay ×2, Zapier) whose only
 * authentication is comparing a shared secret, where succeeding grants write access
 * to account data with no other check.
 */
export function timingSafeEqual(expected: string, provided: string | undefined | null): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Rate limiting, lockout and cooldown state all live in the shared store (see
// server/_core/shared-store.ts): in-memory by default, Redis when REDIS_URL is set, so
// throttling holds across instances instead of being reset per pod.

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

  // Not awaited by Express: this is a middleware, so the promise is handled here and
  // `next()` is called from inside it. A store failure must not wedge the request —
  // it fails OPEN (serves the request) rather than locking everyone out of the app
  // because Redis blipped. The login lockout below is the control that fails closed.
  void getStore()
    .increment(`ratelimit:${clientIP}`, RATE_LIMIT_WINDOW_MS)
    .then(async (count) => {
      if (count <= RATE_LIMIT_MAX_REQUESTS) return next();
      const remaining = await getStore().ttl(`ratelimit:${clientIP}`);
      res.status(429).json({
        error: "Too many requests",
        message: "Please try again later",
        retryAfter: Math.max(1, Math.ceil(remaining / 1000)),
      });
    })
    .catch((err) => {
      console.error("[Security] rate limit store unavailable, allowing request:", err?.message);
      next();
    });
}

/*
 * `loginRateLimiter` used to live here. It was removed rather than ported, because it
 * was both unmounted and incapable of working:
 *
 *   - Nothing ever called `app.use(loginRateLimiter)`. The only surviving reference was
 *     a comment in routers.ts explaining that it "only guards express routes" — but
 *     there are no express auth routes, so it guarded nothing.
 *   - It looked up `loginAttemptStore.get(clientIP)`, a bare-IP key. Since #40 moved the
 *     lockout to per-(IP, account) keys (`ip::email`), no such key is ever written, so
 *     the lookup could only ever miss and call next().
 *
 * The real control is `getLoginLockout`, enforced on the tRPC login path where the
 * account being attacked is actually known. Porting a dead no-op to the shared store
 * would have produced async dead code and a false impression of a second defence layer.
 */

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
export async function recordFailedLogin(clientIP: string, email: string): Promise<void> {
  const key = `lockout:${lockoutKey(clientIP, email)}`;

  // A TTL-bearing counter rather than a {count, lockUntil} record read-modify-written in
  // place. Two reasons. It is atomic, so two simultaneous failures can't both read 4 and
  // both write 5 — the same lost-update shape already fixed for the email-verification
  // attempt cap. And it is expressible in one round trip, so it holds across instances.
  //
  // Behaviour is preserved exactly: the counter lives LOGIN_LOCKOUT_MS from the first
  // failure, and every failure at or above the cap re-extends it — which is what the old
  // `record.lockUntil = now + LOGIN_LOCKOUT_MS` on each such failure did.
  const count = await getStore().increment(key, LOGIN_LOCKOUT_MS);

  if (count >= LOGIN_MAX_ATTEMPTS) {
    await getStore().expire(key, LOGIN_LOCKOUT_MS);
    console.warn(`[Security] ${lockoutKey(clientIP, email)} locked out after ${count} failed login attempts`);
  }
}

// Per-key send cooldown (e.g. verification / reset emails) to stop an attacker using a
// configured mailer to bomb a victim's inbox.
const SEND_COOLDOWN_MS = 60 * 1000;

/**
 * Throws if `key` (e.g. "verify:<email>") was used within the cooldown window; otherwise
 * records "now" and returns. Call before dispatching a verification/reset email.
 */
export async function enforceSendCooldown(key: string, cooldownMs = SEND_COOLDOWN_MS): Promise<void> {
  const storeKey = `cooldown:${key}`;
  const remaining = await getStore().ttl(storeKey);
  if (remaining > 0) {
    throw new Error(`Please wait ${Math.ceil(remaining / 1000)}s before requesting another code.`);
  }
  await getStore().set(storeKey, 1, cooldownMs);
}

/**
 * Whether an (IP, account) pair is currently locked out, with the remaining seconds.
 * The tRPC login path calls this to ENFORCE the lockout; there is no express route to
 * guard, so this is the only enforcement point.
 *
 * Deliberately fails CLOSED, unlike `rateLimiter` above: if the store is unreachable
 * this throws and login is unavailable, rather than silently admitting unlimited
 * password guesses. The opposite choice for volume-based `/api` throttling is what the
 * two controls are for — losing coarse request limiting for a few seconds is an
 * annoyance, losing brute-force protection on the password endpoint is the attack.
 */
export async function getLoginLockout(
  clientIP: string,
  email: string,
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const key = `lockout:${lockoutKey(clientIP, email)}`;
  const count = (await getStore().get<number>(key)) ?? 0;
  if (count < LOGIN_MAX_ATTEMPTS) return { locked: false, retryAfterSeconds: 0 };
  const remaining = await getStore().ttl(key);
  return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000)) };
}

/**
 * Clear login attempts after successful login — only for the (IP, account) pair that
 * just succeeded, never the whole IP.
 */
export async function clearLoginAttempts(clientIP: string, email: string): Promise<void> {
  await getStore().delete(`lockout:${lockoutKey(clientIP, email)}`);
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
