import type { User } from "../../drizzle/schema";

/**
 * A user row as it is safe to send to a browser: no password hash, no TOTP secret, no
 * recovery-code blob, no OAuth `openId`. `User` (the full drizzle row) carries all of
 * those, and two real call sites shipped it whole to the client before this existed —
 * `auth.me` returned the signed-in user's own hash and 2FA secret on every load, and
 * `admin.getAllUsers`/`getPendingUsers` returned every user's, to any admin. Each had
 * also declared a narrower `db.select({...})` projection that looked like the fix, but
 * the demo-mode JSON store ignores column projections and returns the full stored row
 * regardless — so the declared allowlist was never actually enforced. This re-picks the
 * safe fields in JS, after the query, so the guarantee holds independent of which store
 * (real MySQL or the JSON shim) the query ran against.
 */
const PUBLIC_USER_FIELDS = [
  "id", "name", "email", "role", "isApproved", "loginMethod", "createdAt", "lastSignedIn",
] as const;

export type PublicUser = Pick<User, (typeof PUBLIC_USER_FIELDS)[number]>;

// Accepts a full `User` row (the normal case, e.g. `ctx.user`) or a narrower
// `db.select({...})` projection result — both carry every field this needs, since the
// projection's own declared columns are always a superset of PUBLIC_USER_FIELDS at
// every call site. Typed as `Partial` so a query-result object's structural excess
// (fields the demo shim smuggled in) doesn't need a cast to satisfy this signature.
export function toPublicUser(user: Partial<User>): PublicUser;
export function toPublicUser(user: null): null;
export function toPublicUser(user: Partial<User> | null): PublicUser | null;
export function toPublicUser(user: Partial<User> | null): PublicUser | null {
  if (!user) return null;
  const out = {} as PublicUser;
  for (const key of PUBLIC_USER_FIELDS) {
    (out as Record<string, unknown>)[key] = (user as unknown as Record<string, unknown>)[key];
  }
  return out;
}
