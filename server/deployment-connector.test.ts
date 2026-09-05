import { describe, it, expect, vi } from "vitest";
import { assertDeploymentConnectorAllowed, DEFAULT_ORG_ID } from "./_core/tenancy";

/**
 * A connector configured from the deployment's environment is not every tenant's to spend.
 *
 * The org work made every WRITE land in the caller's tenant, and stopped there. It never
 * asked whether the SOURCE was the caller's to read, and for Salesforce that is the whole
 * problem: `salesforce.syncAccounts` is a plain protectedProcedure, so any signed-in user
 * of any organization can call it; it authenticates with the single SALESFORCE_*
 * credentials in the deployment's environment and runs
 *
 *     SELECT Id, Name, Website, … FROM Account WHERE IsDeleted = false
 *
 * with no limit — the entire connected Salesforce org — then upserts the lot into
 * `ctx.orgId`. On a self-serve deployment a customer who signed up two minutes ago could
 * press "Sync" and copy the operator's book of business, very plausibly another
 * customer's, into their own workspace. Every row would be correctly scoped to them,
 * which is exactly what made it invisible: the isolation tests all pass while the data
 * being isolated is someone else's.
 *
 * These are mostly about the refusal, because the allowed case is the one that already
 * worked — and because a guard that fires on the wrong side would break every existing
 * single-tenant install, where everyone is in the default org.
 */

describe("assertDeploymentConnectorAllowed", () => {
  it("allows the organization that owns the deployment", () => {
    // Every existing install: one org, everyone in it, nothing changes.
    expect(() => assertDeploymentConnectorAllowed(DEFAULT_ORG_ID, "Salesforce")).not.toThrow();
  });

  it("refuses any other organization", () => {
    expect(() => assertDeploymentConnectorAllowed(2, "Salesforce")).toThrow();
    expect(() => assertDeploymentConnectorAllowed(999, "Salesforce")).toThrow();
  });

  it("says whose credentials they are and what to do instead", () => {
    // A bare FORBIDDEN reads as a bug in the product. The person hitting this has done
    // nothing wrong and has a real alternative — their own import.
    let message = "";
    try {
      assertDeploymentConnectorAllowed(2, "Salesforce");
    } catch (e: any) {
      message = e.message;
    }
    expect(message).toMatch(/Salesforce/);
    expect(message).toMatch(/this whole deployment/i);
    expect(message).toMatch(/import your own data/i);
  });

  it("names the connector it is refusing", () => {
    // The guard is meant to be reused. A message hardcoded to Salesforce would be wrong
    // the first time it guards anything else.
    let message = "";
    try {
      assertDeploymentConnectorAllowed(2, "Gong");
    } catch (e: any) {
      message = e.message;
    }
    expect(message).toMatch(/^Gong is connected/);
  });
});

/**
 * The router half. What matters is that the refusal REACHES the caller: each sync wraps
 * its body in a try/catch that turns everything into `{ success: false, message }`, which
 * the page renders as a failed sync — so a guard placed inside the try would tell a
 * customer their sync had failed rather than that it was not theirs to run.
 */
describe("the Salesforce router", () => {
  const caller = (orgId: number) => {
    // The org goes on the user: requireUser recomputes ctx.orgId from it and discards
    // whatever a caller passes.
    const ctx = {
      orgId: null,
      user: { id: 1, orgId, role: "admin" },
      req: { headers: {} },
      res: {},
    };
    return import("./routers/salesforce").then(m =>
      m.salesforceRouter.createCaller(ctx as any)
    );
  };

  it("throws rather than returning a failed-sync result", async () => {
    const c = await caller(2);
    // rejects, not resolves-with-success-false. The distinction is the whole point.
    await expect(c.syncAccounts()).rejects.toThrow(/Salesforce/);
    await expect(c.syncContacts()).rejects.toThrow(/Salesforce/);
    await expect(c.fullSync()).rejects.toThrow(/Salesforce/);
  });

  it("refuses to name the operator's Salesforce instance to another tenant", async () => {
    const c = await caller(2);
    await expect(c.getInstanceUrl()).rejects.toThrow();
    await expect(c.testConnection()).rejects.toThrow();
  });

  it("still lets the deployment's own organization through the guard", async () => {
    // It will fail later for want of credentials, which is a different and correct
    // failure — what must not happen is being stopped by the tenancy guard.
    const c = await caller(DEFAULT_ORG_ID);
    await expect(c.syncAccounts()).resolves.toMatchObject({ success: false });
    const result: any = await c.syncAccounts();
    expect(result.message).not.toMatch(/whole deployment/i);
  });
});

/**
 * The rest of the connector surface, which has the same shape for a different reason.
 *
 * Salesforce and Gong hand another party's records TO the caller. These spend the
 * operator's vendor accounts on the caller's behalf: a tenant could send SMS on the
 * operator's Twilio, post into their Slack, and create records in their HubSpot, Notion,
 * Linear and Pipedrive. Not a data leak — a bill, and someone else's workspace filling up
 * with a stranger's records.
 */
describe("the integrations router", () => {
  const caller = async (orgId: number) => {
    const ctx = {
      orgId: null,
      user: { id: 1, orgId, role: "admin" },
      req: { headers: {} },
      res: {},
    };
    const m = await import("./integrations-router");
    return m.integrationsRouter.createCaller(ctx as any);
  };

  it("refuses every vendor action to a workspace that owns no credentials", async () => {
    const c = await caller(2);
    await expect(c.twilioSendSms({ to: "+15550100", body: "hi" })).rejects.toThrow(
      /whole deployment/i
    );
    await expect(c.slackNotify({ text: "hi" })).rejects.toThrow(/whole deployment/i);
    await expect(c.apolloEnrichPerson({ email: "someone@example.com" })).rejects.toThrow();
    await expect(c.zoominfoEnrichCompany({ domain: "acme.com" })).rejects.toThrow();
    await expect(c.notionExportAccount({ name: "Acme" } as any)).rejects.toThrow();
  });

  it("reports no connectors rather than describing the operator's setup", async () => {
    // status and preflight were readable by every tenant: which keys the operator has
    // set, which are malformed, which signup mode is live, whether Redis answers. From a
    // workspace that owns none of them, "nothing is configured" is the true answer, and
    // it is also the one that stops the page offering buttons that refuse.
    const c = await caller(2);
    const status: any = await c.status();
    expect(Object.values(status).every(v => v === false)).toBe(true);

    const report: any = await c.preflight();
    expect(report.connectors).toEqual([]);
    expect(report.core).toEqual([]);
  });

  it("still answers the deployment's own organization", async () => {
    // The guard must not fire on the side where every existing install lives.
    const c = await caller(DEFAULT_ORG_ID);
    const status: any = await c.status();
    expect(typeof status.slack).toBe("boolean");
    const report: any = await c.preflight();
    expect(Array.isArray(report.connectors)).toBe(true);
    expect(report.connectors.length).toBeGreaterThan(0);
  });
});
