/**
 * How much of the org-scoping migration is left.
 *
 * Not a note — a control. server/_core/tenancy.ts refuses to admit a second organization
 * while this is above zero, so a deployment cannot be put into the state where the
 * unconverted queries would leak one customer's accounts into another's list. When it
 * reaches zero the refusal lifts on its own.
 *
 * `pnpm check:claims` recomputes this from source on every run and fails the build if the
 * number here disagrees. That is the point: a number that could be edited down to zero
 * would silently remove the protection, which is the exact class of defect — a claim the
 * code never checked — that the rest of this repo exists to eliminate. Lower it by
 * scoping queries, and the check will tell you when you have.
 *
 * `pnpm tenancy` prints the remaining sites, file and line.
 */

/**
 * Query sites on tenant-owned tables that still run without an org filter.
 *
 * Typed `number` rather than left as a literal so `=== 0` stays a real runtime question.
 * As a literal, TypeScript would narrow it to the current value and reject the comparison
 * as impossible — which would push someone to delete the check instead of the count.
 */
export const UNSCOPED_QUERY_SITES: number = 0;

/**
 * Queries deliberately NOT org-scoped, each carrying a `tenancy-exempt:` reason in the
 * source next to it.
 *
 * Pinned for the same reason as the number above. Without it, the escape hatch swallows
 * the control: exempt a real leak, UNSCOPED_QUERY_SITES stays at zero, and the build
 * still passes. Requiring this number to move puts every new exemption in the diff, next
 * to the reason someone wrote for it.
 *
 * All seventeen today are auth-path queries — login, signup, session resolution, the 2FA
 * challenge, one-click approval links — plus one share-link lookup. They run before a
 * session exists, or are authorized by an unguessable token rather than a session, so
 * there is genuinely no org to filter by. `pnpm tenancy` lists them with their reasons.
 */
export const EXEMPT_QUERY_SITES: number = 17;
