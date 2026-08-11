import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { REP_TERRITORIES, matchesTerritory, territoryFor } from "./territories";

/**
 * These assertions exist because the previous, duplicated rosters failed silently: the
 * lookup missed, the filter was skipped, and the dashboard showed every account in the
 * workspace under one rep's territory heading. A wrong region or a stale email should
 * fail the build, not quietly widen the result set.
 */
describe("rep territories", () => {
  const seed = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "demo-db.seed.json"), "utf8")
  );
  const regionsInData = new Set<string>(
    (seed.accounts ?? []).map((a: any) => a.region).filter(Boolean)
  );

  it("only references regions the account data actually uses", () => {
    const bad = Object.values(REP_TERRITORIES)
      .map((t) => t.region)
      .filter((r) => !regionsInData.has(r));
    expect(bad).toEqual([]);
  });

  it("keys are real addresses, not unsubstituted templates", () => {
    for (const email of Object.keys(REP_TERRITORIES)) {
      expect(email).not.toMatch(/[{}]/); // e.g. "{COMPANY_EMAIL_DOMAIN}"
      expect(email).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
    }
  });

  it("every rep matches a non-empty, strictly bounded slice of the data", () => {
    const accounts = seed.accounts ?? [];
    for (const [email, t] of Object.entries(REP_TERRITORIES)) {
      const mine = accounts.filter((a: any) =>
        matchesTerritory(t, a.region || "", a.employeeCount || 0)
      );
      expect(mine.length, `${email} matched nothing`).toBeGreaterThan(0);
      expect(mine.length, `${email} matched everything`).toBeLessThan(accounts.length);
      // and the slice really is the rep's region + size band
      for (const a of mine) {
        expect(a.region).toBe(t.region);
        if (t.sizeFilter === "<2000") expect(a.employeeCount).toBeLessThan(2000);
        else expect(a.employeeCount).toBeGreaterThanOrEqual(2000);
      }
    }
  });

  it("no rep selected means unfiltered, and an unknown email is not a silent match", () => {
    expect(matchesTerritory(null, "West", 10)).toBe(true);
    expect(territoryFor("nobody@example.com")).toBeNull();
    expect(territoryFor("")).toBeNull();
  });
});
