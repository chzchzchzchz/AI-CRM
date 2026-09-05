/**
 * How a customer gets an organization to be isolated *into*.
 *
 * The org boundary landed first: every tenant table carries an `orgId`, every query
 * filters on it, and a build check fails if one stops. All of that was true and all of it
 * was inert, because nothing ever created an organization. The table was written by no
 * code path at all, so every user in every deployment took the column default and landed
 * in org 1 — two customers would have shared a workspace exactly as before, while the
 * README said isolation was enforced.
 *
 * A boundary nothing puts customers on opposite sides of is not a boundary. This module
 * is the other half.
 *
 * Two signup modes, because the two things this app is used for want opposite defaults:
 *
 *   invite-only (the default) — a signup joins the existing organization and waits for an
 *     admin to approve it. This is what a self-hosted single-team install has always
 *     done, and it stays the default so no existing deployment changes behaviour.
 *
 *   self-serve — a signup creates a NEW organization and its first user is that org's
 *     admin, approved immediately. This is what selling to more than one customer means.
 *
 * `pnpm doctor` reports which mode is live, for the same reason it reports the store
 * driver: an operator running self-serve while believing it is invite-only is handing out
 * workspaces, and an operator running invite-only while believing it is self-serve has
 * customers stuck at a screen nobody is watching.
 */

import { eq } from "drizzle-orm";
import { organizations } from "../../drizzle/schema";
import { DEFAULT_ORG_ID } from "./tenancy";

export type SignupMode = "invite-only" | "self-serve";

export function signupMode(): SignupMode {
  return process.env.SIGNUP_MODE === "self-serve" ? "self-serve" : "invite-only";
}

/** A URL-safe slug, unique-ified by the caller if it collides. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "org";
}

/**
 * Make sure the default organization exists as an actual row.
 *
 * `orgId` defaults to 1 on every tenant table, so org 1 is referenced by every existing
 * row in every existing deployment — while never having existed as a record. Nothing
 * broke, because nothing read it; the moment anything lists organizations or shows whose
 * workspace you are in, the incumbent tenant would be the one that is missing.
 *
 * Idempotent, and safe to call on every boot.
 */
export async function ensureDefaultOrganization(db: any): Promise<void> {
  if (!db) return;
  try {
    const [existing] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, DEFAULT_ORG_ID))
      .limit(1);
    if (existing) return;

    await db.insert(organizations).values({
      id: DEFAULT_ORG_ID,
      name: "Default Organization",
      slug: "default",
    });
  } catch (err) {
    // Never block boot on this. A deployment whose migrations have not run yet should
    // still start and say what is wrong elsewhere, rather than failing here first.
    console.warn("[onboarding] could not ensure the default organization:", (err as Error)?.message);
  }
}

/**
 * Create an organization for a new customer and return its id.
 *
 * The slug is made unique by suffixing rather than failing: a second "Acme" signing up is
 * an ordinary event on a self-serve product, and refusing it would be a dead end for a
 * customer whose only mistake was sharing a name with an earlier one.
 */
export async function createOrganization(db: any, name: string): Promise<number> {
  const base = slugify(name);
  let slug = base;

  for (let attempt = 0; attempt < 25; attempt++) {
    const [taken] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!taken) break;
    slug = `${base}-${attempt + 2}`;
  }

  const result = await db.insert(organizations).values({ name: name.trim() || "New Organization", slug });

  // mysql2 returns [ResultSetHeader]; the demo shim returns the inserted row(s).
  const insertId =
    (Array.isArray(result) ? (result[0] as any)?.insertId : (result as any)?.insertId) ??
    (Array.isArray(result) ? (result[0] as any)?.id : undefined);

  if (!insertId) {
    // Refusing beats guessing. Returning DEFAULT_ORG_ID on failure would put a brand-new
    // customer straight into the incumbent's workspace — the exact outcome the whole
    // boundary exists to prevent, reached by a fallback that looked harmless.
    throw new Error("Could not create an organization for this account.");
  }
  return Number(insertId);
}
