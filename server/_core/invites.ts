/**
 * Adding a colleague to an organization.
 *
 * Self-serve signup gives every new person their own workspace, which is right for a new
 * customer and wrong for that customer's second employee. The public access-request form
 * cannot help either: it runs before any session exists, so it has no org to attach to
 * and lands in the default one — where the admin who actually wanted the teammate never
 * sees it. Until this existed, a customer could not build a team.
 *
 * The invitation carries the org. That is the whole design: the token names which
 * workspace you are joining, so the decision is made by the admin who issued it rather
 * than inferred from an email domain (which gmail defeats) or chosen by the joiner
 * (which is not theirs to choose).
 */

import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { organizationInvites } from "../../drizzle/schema";

/** How long an invitation stays usable. Long enough to survive a weekend, short enough
 *  that a forwarded link is not a permanent way in. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 256 bits from a CSPRNG. This token creates an approved account inside a customer's
 *  workspace, so it is a credential, not an identifier. */
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export type InviteRejection =
  | "not-found"
  | "expired"
  | "already-accepted"
  | "revoked";

export type InviteLookup =
  | { ok: true; invite: { id: number; orgId: number; email: string; role: "user" | "admin" } }
  | { ok: false; reason: InviteRejection };

/**
 * Resolve a token to the invitation it names, or say precisely why not.
 *
 * The four rejections are kept apart on purpose. "This invitation has already been used"
 * and "this link is not valid" send a person to different places — the first to whoever
 * has their password, the second back to the admin for a new link — and collapsing them
 * into one message makes both journeys dead ends. None of them leaks anything: a caller
 * holding a token that does not resolve learns only about that token.
 */
export async function lookupInvite(db: any, token: string): Promise<InviteLookup> {
  if (!db || !token) return { ok: false, reason: "not-found" };

  const [row] = await db
    .select()
    .from(organizationInvites)
    .where(eq(organizationInvites.tokenHash, hashInviteToken(token)))
    .limit(1);

  if (!row) return { ok: false, reason: "not-found" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.acceptedAt) return { ok: false, reason: "already-accepted" };

  // Single-use and time-limited are separate guarantees; a spent invitation that has not
  // yet expired must still be refused, and vice versa.
  const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return {
    ok: true,
    invite: { id: row.id, orgId: row.orgId, email: row.email, role: row.role },
  };
}

/** The message a person standing at a broken invite link should actually read. */
export function rejectionMessage(reason: InviteRejection): string {
  switch (reason) {
    case "expired":
      return "This invitation has expired. Ask whoever invited you to send a new one.";
    case "already-accepted":
      return "This invitation has already been used. If that wasn't you, tell the person who sent it.";
    case "revoked":
      return "This invitation was withdrawn. Ask whoever invited you if that was a mistake.";
    default:
      return "This invitation link isn't valid. Check you copied the whole link, or ask for a new one.";
  }
}

/**
 * Mark an invitation spent.
 *
 * Returns whether it actually claimed it. Two people opening the same link at once must
 * not both get an account: the second write matches nothing because `acceptedAt` is
 * already set, and the caller has to be able to see that rather than assume it worked.
 * This is the same "a write must report what it did" rule the rest of the codebase now
 * follows — it matters more here, because the thing being created is a user.
 */
export async function claimInvite(db: any, inviteId: number): Promise<boolean> {
  const { affectedRows } = await import("./affected-rows");
  const result = await db
    .update(organizationInvites)
    .set({ acceptedAt: new Date() })
    .where(
      and(
        eq(organizationInvites.id, inviteId),
        // Only an unclaimed invitation can be claimed. `isNull`, not `eq(..., null)`:
        // in SQL nothing equals NULL, so an equality check here would match no row ever
        // and every acceptance would look like a lost race.
        isNull(organizationInvites.acceptedAt)
      )
    );
  return affectedRows(result) > 0;
}
