import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  validatePasswordComplexity,
  sanitizeInput,
  getClientIP,
  timingSafeEqual,
} from "./_core/security";

/** A minimal stand-in for the parts of Express's Request that getClientIP reads. */
function mockRequest(opts: { forwardedFor?: string; remoteAddress?: string; ip?: string }) {
  return {
    headers: opts.forwardedFor ? { "x-forwarded-for": opts.forwardedFor } : {},
    socket: { remoteAddress: opts.remoteAddress ?? "203.0.113.9" },
    ip: opts.ip ?? "203.0.113.9",
  } as any;
}

describe("Security Module", () => {
  describe("getClientIP", () => {
    const originalTrustProxy = process.env.TRUST_PROXY;
    afterEach(() => {
      if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = originalTrustProxy;
    });

    it("ignores a client-supplied X-Forwarded-For by default", () => {
      // This is the exact bug: a client picks its own value for this header, and the
      // login lockout is keyed on getClientIP's return value. Two requests from the
      // same real connection with different header values must resolve to the same IP,
      // or the lockout counter never accumulates against a real attacker.
      delete process.env.TRUST_PROXY;
      const a = getClientIP(mockRequest({ forwardedFor: "10.9.9.9", remoteAddress: "203.0.113.9" }));
      const b = getClientIP(mockRequest({ forwardedFor: "10.9.9.13", remoteAddress: "203.0.113.9" }));
      expect(a).toBe("203.0.113.9");
      expect(b).toBe("203.0.113.9");
      expect(a).toBe(b);
    });

    it("trusts the header only when the operator has opted in with TRUST_PROXY", () => {
      process.env.TRUST_PROXY = "true";
      const ip = getClientIP(mockRequest({ forwardedFor: "198.51.100.4", remoteAddress: "203.0.113.9" }));
      expect(ip).toBe("198.51.100.4");
    });

    it("falls back to the socket address when there is no forwarded header", () => {
      delete process.env.TRUST_PROXY;
      const ip = getClientIP(mockRequest({ remoteAddress: "203.0.113.9" }));
      expect(ip).toBe("203.0.113.9");
    });
  });

  describe("Password Complexity Validation", () => {
    it("should reject passwords shorter than 8 characters", () => {
      const result = validatePasswordComplexity("Short1!");
      expect(result).toBe("Password must be at least 8 characters long");
    });

    it("should reject passwords without uppercase letters", () => {
      const result = validatePasswordComplexity("password123!");
      expect(result).toBe("Password must contain at least one uppercase letter");
    });

    it("should reject passwords without lowercase letters", () => {
      const result = validatePasswordComplexity("PASSWORD123!");
      expect(result).toBe("Password must contain at least one lowercase letter");
    });

    it("should reject passwords without numbers", () => {
      const result = validatePasswordComplexity("PasswordABC!");
      expect(result).toBe("Password must contain at least one number");
    });

    it("should reject passwords without special characters", () => {
      const result = validatePasswordComplexity("Password123");
      expect(result).toBe("Password must contain at least one special character");
    });

    it("should reject common weak passwords", () => {
      const result = validatePasswordComplexity("Password123!");
      expect(result).toBe("Password is too common. Please choose a stronger password.");
    });

    it("should accept strong passwords", () => {
      const result = validatePasswordComplexity("MyStr0ng!P@ssw0rd");
      expect(result).toBeNull();
    });

    it("should accept complex passwords with all requirements", () => {
      const result = validatePasswordComplexity("Xk9#mLp2$vNq");
      expect(result).toBeNull();
    });
  });

  describe("Input Sanitization", () => {
    it("should escape HTML entities", () => {
      const result = sanitizeInput("<script>alert('xss')</script>");
      expect(result).toBe("&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;");
    });

    it("should escape ampersands", () => {
      const result = sanitizeInput("foo & bar");
      expect(result).toBe("foo &amp; bar");
    });

    it("should escape quotes", () => {
      const result = sanitizeInput('He said "hello"');
      expect(result).toBe("He said &quot;hello&quot;");
    });

    it("should handle normal text without changes", () => {
      const result = sanitizeInput("Normal text without special chars");
      expect(result).toBe("Normal text without special chars");
    });
  });

  describe("timingSafeEqual", () => {
    // clay-webhook.ts, clay.ts and integrations-router.ts (Zapier) authenticate a
    // publicProcedure webhook receiver by comparing a secret in the request against
    // the configured value with a plain !==, the same shape of leak
    // email-verification-router.ts's codesMatch already exists to close for guessed
    // verification codes — here, succeeding grants write access to account data with
    // no other check.
    it("accepts the exact secret", () => {
      expect(timingSafeEqual("wh_sec_abc123", "wh_sec_abc123")).toBe(true);
    });

    it("rejects a wrong secret of the same length", () => {
      expect(timingSafeEqual("wh_sec_abc123", "wh_sec_abc124")).toBe(false);
    });

    it("rejects a length mismatch rather than throwing", () => {
      // crypto.timingSafeEqual throws on differing buffer lengths; letting that
      // escape would turn a short guess into a 500 and a right-length wrong guess
      // into a clean 401, which is itself a signal an attacker can use to learn the
      // secret's length.
      expect(() => timingSafeEqual("wh_sec_abc123", "short")).not.toThrow();
      expect(timingSafeEqual("wh_sec_abc123", "short")).toBe(false);
      expect(timingSafeEqual("wh_sec_abc123", "wh_sec_abc123_and_then_some")).toBe(false);
    });

    it("rejects a missing secret without throwing", () => {
      expect(timingSafeEqual("wh_sec_abc123", undefined)).toBe(false);
      expect(timingSafeEqual("wh_sec_abc123", null)).toBe(false);
      expect(timingSafeEqual("wh_sec_abc123", "")).toBe(false);
    });
  });
});
