import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return ctx;
}

describe("accounts API", () => {
  it("should list accounts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    expect(Array.isArray(accounts)).toBe(true);
  });

  it("should create and retrieve an account", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const newAccount = await caller.accounts.create({
      name: "Test Corp",
      domain: "testcorp.com",
      industry: "Technology",
      employeeCount: 100,
    });

    expect(newAccount).toBeDefined();

    const accounts = await caller.accounts.list();
    const found = accounts.find(a => a.name === "Test Corp");
    expect(found).toBeDefined();
    expect(found?.domain).toBe("testcorp.com");
  });
});

describe("contacts API", () => {
  it("should list contacts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const contacts = await caller.contacts.list();
    expect(Array.isArray(contacts)).toBe(true);
  });
});

describe("Clay integration", () => {
  it("should sync account from Clay webhook", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.clay.syncAccount({
      clayRecordId: "clay_test_123",
      name: "Clay Test Corp",
      domain: "claytest.com",
      industry: "SaaS",
      employeeCount: 250,
      securityStack: ["Okta", "CrowdStrike"],
      techStack: ["AWS", "Salesforce"],
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe("created");

    const accounts = await caller.accounts.list();
    const found = accounts.find(a => a.clayRecordId === "clay_test_123");
    expect(found).toBeDefined();
    expect(found?.name).toBe("Clay Test Corp");
  });
});
