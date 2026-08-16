import { describe, it, expect } from "vitest";
import { toPublicUser } from "./publicUser";
import type { User } from "../../drizzle/schema";

const fullUser: User = {
  id: 1,
  openId: "demo-user-id",
  name: "Demo Admin",
  email: "demo@ai-crm.com",
  passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
  loginMethod: "demo",
  isApproved: true,
  role: "admin",
  twoFactorEnabled: true,
  twoFactorSecret: "JBSWY3DPEHPK3PXP",
  twoFactorBackupCodes: JSON.stringify(["$2a$10$hashedcode1", "$2a$10$hashedcode2"]),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  lastSignedIn: new Date("2026-01-03"),
} as User;

describe("toPublicUser", () => {
  it("strips every credential-bearing field", () => {
    const pub = toPublicUser(fullUser);
    // The exact set of fields a browser must never receive for any user.
    for (const secret of ["passwordHash", "twoFactorSecret", "twoFactorBackupCodes", "openId"]) {
      expect(pub).not.toHaveProperty(secret);
    }
  });

  it("keeps the fields the client actually renders", () => {
    const pub = toPublicUser(fullUser);
    expect(pub).toMatchObject({
      id: 1,
      name: "Demo Admin",
      email: "demo@ai-crm.com",
      role: "admin",
      isApproved: true,
      loginMethod: "demo",
    });
  });

  it("passes null through", () => {
    expect(toPublicUser(null)).toBeNull();
  });

  it("strips secrets that ride along on an object beyond its own declared type", () => {
    // This is the actual shape of the bug: a `db.select({ id, name, ... })` projection
    // against the demo-mode JSON store returns the full stored row regardless of what
    // was asked for, so the value reaching toPublicUser can carry passwordHash even
    // though its TypeScript type says only the declared columns are present.
    const leaky = { id: 2, name: "X", email: "x@example.com", role: "user", passwordHash: "leak" } as any;
    const pub = toPublicUser(leaky);
    expect(pub).not.toHaveProperty("passwordHash");
  });
});
