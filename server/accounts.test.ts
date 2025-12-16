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
    expect(accounts.length).toBeGreaterThan(0);
  });

  it("should have accounts with required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const accounts = await caller.accounts.list();
    if (accounts.length > 0) {
      const account = accounts[0];
      expect(account.id).toBeDefined();
      expect(account.name).toBeDefined();
    }
  });
});

describe("people API", () => {
  it("should list people/contacts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const people = await caller.people.list();
    expect(Array.isArray(people)).toBe(true);
  });
});

describe("calls API", () => {
  it("should list calls", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const calls = await caller.calls.list();
    expect(Array.isArray(calls)).toBe(true);
  });
});
