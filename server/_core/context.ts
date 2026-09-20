import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { DEFAULT_ORG_ID, orgIdFor } from "./tenancy";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  /**
   * The tenant this request acts within, resolved from the session user and nowhere
   * else. Never read from input: an org id supplied by the caller is a parameter, not
   * a boundary. Null when unauthenticated — publicProcedures have no tenant.
   */
  orgId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    orgId: user ? orgIdFor(user) : null,
  };
}
