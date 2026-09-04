/**
 * The tenant boundary, and the reason a partly-finished one is still safe.
 *
 * `protectedProcedure` means "any signed-in user". It said nothing about *whose* data,
 * because until now there was no such thing as whose: no query carried an owner, so two
 * customers on one deployment would have read each other's accounts and pipeline. The
 * README called this out as a limitation, which is honest but not a control — nothing
 * stopped an operator from creating the second customer's users and finding out.
 *
 * Scoping every query is a large, mechanical migration, and a HALF-scoped one is worse
 * than none: an operator reads "multi-tenant", onboards a second customer, and the
 * unconverted queries leak. So the incompleteness is made impossible to act on rather
 * than merely documented:
 *
 *   - `shared/tenancy-status.ts` carries the number of query sites that still run
 *     unscoped. `pnpm check:claims` recomputes it from source and fails the build if the
 *     checked-in number is wrong, so it cannot drift or be optimistically edited.
 *   - While that number is above zero, this module refuses to admit a second org. A
 *     deployment therefore cannot enter the state where the missing scoping would leak.
 *   - When it reaches zero the refusal lifts on its own. Nothing to remember to turn on.
 *
 * A single-tenant install is a multi-tenant install with one tenant, so today's
 * deployments and the demo keep working unchanged and land in org 1.
 */

import { TRPCError } from "@trpc/server";
import { UNSCOPED_QUERY_SITES } from "@shared/tenancy-status";
import type { User } from "../../drizzle/schema";

/**
 * Every pre-existing row belongs here. Chosen as a literal default on the columns too,
 * so a backfill is not a prerequisite for the schema change.
 */
export const DEFAULT_ORG_ID = 1;

/** True only when every query site is org-scoped and a second tenant is therefore safe. */
export function isMultiOrgSafe(): boolean {
  return UNSCOPED_QUERY_SITES === 0;
}

/**
 * The org a request acts within.
 *
 * Never falls back to "all orgs" or to a caller-supplied value: an org id that comes
 * from the request is not a boundary, it is a parameter. It comes from the session user
 * and nowhere else.
 */
export function orgIdFor(user: Pick<User, "orgId">): number {
  return user.orgId ?? DEFAULT_ORG_ID;
}

/**
 * Refuse to place a user in a second org while any query still runs unscoped.
 *
 * This is the load-bearing part. It fails at the moment someone tries to create the
 * dangerous configuration, naming what is missing — rather than at some later moment
 * when one customer notices another customer's accounts in their list.
 */
export function assertOrgAllowed(orgId: number): void {
  if (orgId === DEFAULT_ORG_ID || isMultiOrgSafe()) return;
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      `This deployment cannot serve more than one organization yet: ${UNSCOPED_QUERY_SITES} ` +
      `database queries still run without an org filter, so a second tenant's data would be ` +
      `visible to the first. Run one deployment per customer until that count reaches zero ` +
      `(\`pnpm check:claims\` reports it).`,
  });
}

/**
 * The same refusal, for non-tRPC entry points (CLI, sync jobs, the MCP server) that have
 * no TRPCError to throw.
 */
export function assertOrgAllowedOrThrow(orgId: number): void {
  if (orgId === DEFAULT_ORG_ID || isMultiOrgSafe()) return;
  throw new Error(
    `Refusing to operate on org ${orgId}: ${UNSCOPED_QUERY_SITES} queries still run ` +
      `without an org filter. One deployment per customer until that count is zero.`,
  );
}
