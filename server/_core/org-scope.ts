import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Which organization the current request belongs to, readable from anywhere.
 *
 * `ctx.orgId` is the authority and every query takes it explicitly — that is the tenancy
 * boundary and it stays that way. This is for the places that are not queries: metering,
 * where `invokeLLM` sits 27 call sites and several frames below anything that knows an
 * organization exists, and threading an argument down to it would mean touching every AI
 * path to record a number.
 *
 * Deliberately NOT used for reads or writes of tenant data. A scope is the right tool for
 * "who is this for, incidentally" and the wrong one for "whose rows am I allowed to
 * touch" — an ambient org id that a query could pick up by accident is how the boundary
 * gets lost again, quietly, in a file nobody was reviewing for tenancy.
 */

const scope = new AsyncLocalStorage<number>();

export function currentOrgId(): number | undefined {
  return scope.getStore();
}

export function enterOrgScope(orgId: number): void {
  scope.enterWith(orgId);
}

export function withOrgScope<T>(orgId: number, fn: () => T): T {
  return scope.run(orgId, fn);
}
