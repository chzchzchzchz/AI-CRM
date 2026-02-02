import { describe, it, expect } from "vitest";
import {
  validatePasswordComplexity,
  sanitizeInput,
} from "./_core/security";

describe("Security Module", () => {
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
});
