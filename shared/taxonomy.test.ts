import { describe, it, expect } from "vitest";
import {
  inferSeniority,
  isDecisionMaker,
  bySeniority,
  TITLE_TOKENS,
  DECISION_MAKER_LEVELS,
} from "./taxonomy";

describe("inferSeniority", () => {
  it("reads the tiers off a real title", () => {
    expect(inferSeniority("Chief Information Security Officer")).toBe("C-Suite");
    expect(inferSeniority("CISO")).toBe("C-Suite");
    expect(inferSeniority("VP Sales")).toBe("VP");
    expect(inferSeniority("Head of Revenue")).toBe("VP");
    expect(inferSeniority("RevOps Director")).toBe("Director");
    expect(inferSeniority("Engineering Manager")).toBe("Manager");
    expect(inferSeniority("Account Executive")).toBe("Individual");
    expect(inferSeniority(null)).toBe("Unknown");
    expect(inferSeniority("")).toBe("Unknown");
  });

  it("is case-insensitive", () => {
    expect(inferSeniority("ciso")).toBe("C-Suite");
    expect(inferSeniority("Vice President, Engineering")).toBe("VP");
  });

  it("reads a compound title left to right — the role comes first", () => {
    expect(inferSeniority("VP of Engineering, Office of the CTO")).toBe("VP");
    expect(inferSeniority("Manager, Office of the CEO")).toBe("Manager");
    expect(inferSeniority("Senior Director of Security")).toBe("Director");
    expect(inferSeniority("Director of Engineering Managers")).toBe("Director");
  });

  it("does not read 'Vice President' as 'President'", () => {
    // The bug this file was written to prevent, and one it had itself on the first
    // pass: checking the C-Suite tier first meant \bpresident\b matched inside
    // "Vice President", so every spelled-out VP came back C-Suite.
    expect(inferSeniority("Vice President, Engineering")).toBe("VP");
    expect(inferSeniority("Senior Vice President of Sales")).toBe("VP");
    expect(inferSeniority("Executive Vice President")).toBe("VP");
    expect(inferSeniority("President")).toBe("C-Suite");
    expect(inferSeniority("President & COO")).toBe("C-Suite");
  });

  it("does not match a tier token inside a longer word", () => {
    // The old .includes() implementations did. This is the whole reason for \b.
    expect(inferSeniority("Developer")).toBe("Individual");
    expect(inferSeniority("Presidential Advisor")).toBe("Individual");
    expect(inferSeniority("Leadership Coach")).toBe("Individual");
    expect(inferSeniority("Directorate Liaison")).toBe("Individual");
  });
});

describe("isDecisionMaker", () => {
  it("includes directors — the disagreement that started this file", () => {
    // /insights counted directors, /contacts did not, and the same "Decision makers"
    // label showed 1,500 on one page and 619 on the other.
    expect(isDecisionMaker("RevOps Director")).toBe(true);
    expect(isDecisionMaker("CISO")).toBe(true);
    expect(isDecisionMaker("VP Sales")).toBe(true);
  });

  it("excludes everyone without sign-off", () => {
    expect(isDecisionMaker("Engineering Manager")).toBe(false);
    expect(isDecisionMaker("Security Analyst")).toBe(false);
    expect(isDecisionMaker(null)).toBe(false);
  });

  it("agrees with the levels it publishes", () => {
    for (const title of ["CTO", "SVP Marketing", "Director of IT", "Team Lead", "Intern"]) {
      expect(isDecisionMaker(title)).toBe(DECISION_MAKER_LEVELS.has(inferSeniority(title)));
    }
  });
});

describe("bySeniority", () => {
  it("sorts most senior first", () => {
    const people = [
      { title: "Security Analyst" },
      { title: "Director of IT" },
      { title: "CISO" },
      { title: "IT Manager" },
      { title: "VP Infrastructure" },
    ];
    expect([...people].sort(bySeniority).map((p) => p.title)).toEqual([
      "CISO",
      "VP Infrastructure",
      "Director of IT",
      "IT Manager",
      "Security Analyst",
    ]);
  });

  it("puts a missing title last rather than first", () => {
    const sorted = [{ title: null }, { title: "Analyst" }].sort(bySeniority);
    expect(sorted[0].title).toBe("Analyst");
  });
});

describe("TITLE_TOKENS", () => {
  it("has no duplicates — a doubled token is a sign two lists got merged", () => {
    expect(new Set(TITLE_TOKENS).size).toBe(TITLE_TOKENS.length);
  });

  it("classifies every seniority token it publishes", () => {
    // A token in the vocabulary that inferSeniority does not recognise means the
    // filter dropdown offers a word the classifier ignores.
    const senior = TITLE_TOKENS.filter((t) => inferSeniority(t) !== "Individual");
    expect(senior.length).toBeGreaterThan(20);
  });
});
