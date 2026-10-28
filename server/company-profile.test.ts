import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DEFAULT_ORG_ID } from "./_core/tenancy";

/**
 * Everything is imported through this, from the SAME fresh module registry.
 *
 * The first version of these tests statically imported withCompanyProfile and dynamically
 * imported getCompanyConfig after vi.resetModules(). That gives config.ts a fresh copy of
 * company-profile.ts — and therefore a DIFFERENT AsyncLocalStorage instance — so the scope
 * was set on one and read from the other, and six tests failed against correct code. The
 * module cache has to be reset (getCompanyConfig memoises the environment on first call),
 * so both sides have to come from the same reset.
 */
async function load() {
  const profileMod = await import("./_core/company-profile");
  const configMod = await import("./config");
  return { ...profileMod, ...configMod };
}

/**
 * Whose company the AI writes as.
 *
 * COMPANY_NAME, the differentiators and the competitor list were one set of values for the
 * whole deployment, read by getCompanyConfig() from 43 places — prompt builders several
 * frames inside AI paths that know nothing about organizations. So on a self-serve
 * instance a second customer's outreach went out written as the OPERATOR's company,
 * pitching the operator's product against the operator's named competitors, to the
 * customer's own prospects. Their accounts and contacts were perfectly isolated; the
 * sentence wrapped around them was somebody else's.
 */

const DEPLOYMENT_NAME = "Operator Industries";

beforeEach(() => {
  process.env.COMPANY_NAME = DEPLOYMENT_NAME;
  process.env.COMPANY_DIFFERENTIATORS = "Operator edge one,Operator edge two";
  vi.resetModules();
});

afterEach(() => {
  delete process.env.COMPANY_NAME;
  delete process.env.COMPANY_DIFFERENTIATORS;
  vi.resetModules();
});

describe("getCompanyConfig, inside an organization", () => {
  it("uses the deployment's identity when nothing is scoped", async () => {
    // CLI tooling, the smoke test, the demo. Unchanged behaviour.
    const { getCompanyConfig } = await load();
    expect(getCompanyConfig().companyName).toBe(DEPLOYMENT_NAME);
  });

  it("writes as the ORGANIZATION when one is scoped", async () => {
    const { getCompanyConfig, withCompanyProfile } = await load();
    withCompanyProfile({ companyName: "Customer Co" }, () => {
      expect(getCompanyConfig().companyName).toBe("Customer Co");
    });
  });

  it("does not leak the deployment's differentiators into a scoped org", async () => {
    // The subtle half. Getting the NAME right while still pitching the operator's
    // differentiators would read as a company arguing someone else's case.
    const { getCompanyConfig, withCompanyProfile } = await load();
    withCompanyProfile(
      { companyName: "Customer Co", keyDifferentiators: ["Ours, not theirs"] },
      () => {
        const cfg = getCompanyConfig();
        expect(cfg.keyDifferentiators).toEqual(["Ours, not theirs"]);
        expect(cfg.keyDifferentiators.join(" ")).not.toMatch(/Operator edge/);
      }
    );
  });

  it("leaves a field the organization did not set as the deployment's, for the org that owns it", async () => {
    // A partial profile from the workspace that owns the deployment should still inherit —
    // that workspace IS the deployment.
    const { getCompanyConfig, withCompanyProfile } = await load();
    withCompanyProfile({ companyName: "Renamed" }, () => {
      const cfg = getCompanyConfig();
      expect(cfg.companyName).toBe("Renamed");
      expect(cfg.keyDifferentiators.join(",")).toMatch(/Operator edge/);
    });
  });

  it("an unconfigured second customer writes as nobody, not as the operator", async () => {
    // The first version of this scoped such a workspace with `{}` — and an empty object
    // merges nothing, so the deployment's name showed straight through and the defect was
    // intact for exactly the workspaces it mattered most for. The placeholders have to be
    // IN the profile, which is what the middleware now composes.
    const { getCompanyConfig, withCompanyIdentity, neutralProfile } = await load();
    withCompanyIdentity({ profile: neutralProfile(), inherit: false }, () => {
      const cfg = getCompanyConfig();
      expect(cfg.companyName).not.toBe(DEPLOYMENT_NAME);
      expect(cfg.companyName).toBe("Your company");
      // And nothing is invented on their behalf either.
      expect(cfg.keyDifferentiators).toEqual([]);
    });
  });

  it("puts the identity back when the request ends", async () => {
    const { getCompanyConfig, withCompanyProfile } = await load();
    withCompanyProfile({ companyName: "Customer Co" }, () => {});
    expect(getCompanyConfig().companyName).toBe(DEPLOYMENT_NAME);
  });

  it("survives an await, because every AI call has several", async () => {
    const { getCompanyConfig, withCompanyProfile } = await load();
    await withCompanyProfile({ companyName: "Customer Co" }, async () => {
      await new Promise(r => setTimeout(r, 5));
      expect(getCompanyConfig().companyName).toBe("Customer Co");
    });
  });

  it("reaches getCompanyContext, which is what the prompts actually interpolate", async () => {
    // getCompanyConfig() being right is only useful if the string built from it is too.
    const { getCompanyContext, withCompanyProfile } = await load();
    withCompanyProfile(
      { companyName: "Customer Co", competitors: "Their rivals" },
      () => {
        const ctx = getCompanyContext();
        expect(ctx).toMatch(/Customer Co/);
        expect(ctx).toMatch(/Their rivals/);
        expect(ctx).not.toMatch(new RegExp(DEPLOYMENT_NAME));
      }
    );
  });
});

describe("who inherits the deployment's identity", () => {
  it("only the organization that owns it", async () => {
    const { mayInheritDeploymentIdentity } = await load();
    expect(mayInheritDeploymentIdentity(DEFAULT_ORG_ID)).toBe(true);
    expect(mayInheritDeploymentIdentity(2)).toBe(false);
    expect(mayInheritDeploymentIdentity(99)).toBe(false);
  });
});

describe("enterCompanyIdentity", () => {
  it("scopes the rest of the async context", async () => {
    // Used by the tRPC middleware instead of a callback, because wrapping next() lost
    // tRPC's context-type inference — the narrowing that makes ctx.user non-null in every
    // downstream resolver.
    const { enterCompanyIdentity, currentProfile } = await load();
    await new Promise<void>(resolve => {
      enterCompanyIdentity({ profile: { companyName: "Scoped Co" }, inherit: true });
      expect(currentProfile()?.companyName).toBe("Scoped Co");
      resolve();
    });
  });

  it("does nothing with no profile, rather than clearing one", async () => {
    const { enterCompanyIdentity, currentProfile, withCompanyProfile } = await load();
    withCompanyProfile({ companyName: "Outer" }, () => {
      enterCompanyIdentity(null);
      expect(currentProfile()?.companyName).toBe("Outer");
    });
  });
});
