import { describe, it, expect } from "vitest";
import { codesMatch } from "./email-verification-router";

/**
 * The verification code is six digits — a million possibilities, which is inside
 * brute-force range if nothing counts the guesses. Two things stand between a
 * guesser and an account: the attempt counter (exercised in the router) and a
 * comparison that doesn't leak how close a guess was.
 */
describe("codesMatch", () => {
  it("accepts the exact code", () => {
    expect(codesMatch("482913", "482913")).toBe(true);
  });

  it("rejects a wrong code of the same length", () => {
    expect(codesMatch("482913", "482914")).toBe(false);
  });

  it("rejects a prefix rather than throwing on the length mismatch", () => {
    // crypto.timingSafeEqual throws when the buffers differ in length; letting that
    // escape would turn a short guess into a 500 and a long one into a rejection,
    // which is itself a signal.
    expect(() => codesMatch("482913", "4829")).not.toThrow();
    expect(codesMatch("482913", "4829")).toBe(false);
    expect(codesMatch("482913", "4829130000")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(codesMatch("482913", "")).toBe(false);
  });

  it("does not treat a numerically equal but differently formatted code as a match", () => {
    // "0482913" and "482913" are the same number and different codes.
    expect(codesMatch("482913", "0482913")).toBe(false);
  });

  it("compares as text, so a non-string input cannot coerce its way in", () => {
    expect(codesMatch("482913", String(482913))).toBe(true);
    expect(codesMatch("482913", null as unknown as string)).toBe(false);
    expect(codesMatch("482913", undefined as unknown as string)).toBe(false);
  });
});
