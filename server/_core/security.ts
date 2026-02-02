import type { Request, Response, NextFunction } from "express";

/**
 * Security middleware for the Target Account Dashboard
 * Implements rate limiting, brute force protection, and security headers
 */

// In-memory store for rate limiting (use Redis in production for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const loginAttemptStore = new Map<string, { count: number; lockUntil: number }>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window
const LOGIN_MAX_ATTEMPTS = 5; // Max login attempts before lockout
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout

/**
 * Get client IP address from request
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

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
 * Record a failed login attempt
 * Call this after a failed login
 */
export function recordFailedLogin(clientIP: string): void {
  const now = Date.now();
  const record = loginAttemptStore.get(clientIP);
  
  if (!record || record.lockUntil < now) {
    // Start fresh count
    loginAttemptStore.set(clientIP, {
      count: 1,
      lockUntil: 0,
    });
    return;
  }
  
  record.count++;
  
  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    record.lockUntil = now + LOGIN_LOCKOUT_MS;
    console.warn(`[Security] IP ${clientIP} locked out after ${record.count} failed login attempts`);
  }
}

/**
 * Clear login attempts after successful login
 */
export function clearLoginAttempts(clientIP: string): void {
  loginAttemptStore.delete(clientIP);
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
