import { getDb } from "./db";
import { dustCache } from "../drizzle/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import crypto from "crypto";

/**
 * Generate hash for query caching
 */
function hashQuery(query: string): string {
  return crypto.createHash("sha256").update(query).digest("hex");
}

/**
 * Get cached Dust response
 */
export async function getCachedDustResponse(
  query: string,
  accountId?: number,
  contactId?: number
): Promise<string | null> {
  const queryHash = hashQuery(query);
  const db = await getDb();
  if (!db) return null;

  try {
    const cached = await db
      .select()
      .from(dustCache)
      .where(
        and(
          eq(dustCache.queryHash, queryHash),
          accountId ? eq(dustCache.accountId, accountId) : undefined,
          contactId ? eq(dustCache.contactId, contactId) : undefined,
          isNull(dustCache.expiresAt)
        )
      )
      .limit(1);

    if (cached.length > 0) {
      return cached[0].result;
    }
  } catch (error) {
    console.error("Error fetching cached Dust response:", error);
  }

  return null;
}

/**
 * Cache Dust response
 */
export async function cacheDustResponse(
  query: string,
  result: string,
  accountId?: number,
  contactId?: number,
  ttlHours: number = 24
): Promise<void> {
  const queryHash = hashQuery(query);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(dustCache).values({
      queryHash,
      query,
      result,
      accountId: accountId || null,
      contactId: contactId || null,
      expiresAt,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Duplicate")) {
      return;
    }
    console.error("Error caching Dust response:", error);
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredDustCache(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    await db
      .delete(dustCache)
      .where(gt(dustCache.expiresAt, new Date()));
    return 0; // MySQL doesn't return rowsAffected directly
  } catch (error) {
    console.error("Error clearing expired Dust cache:", error);
    return 0;
  }
}

/**
 * Clear cache for specific account
 */
export async function clearAccountDustCache(accountId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.delete(dustCache).where(eq(dustCache.accountId, accountId));
  } catch (error) {
    console.error("Error clearing account Dust cache:", error);
  }
}

/**
 * Clear cache for specific contact
 */
export async function clearContactDustCache(contactId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.delete(dustCache).where(eq(dustCache.contactId, contactId));
  } catch (error) {
    console.error("Error clearing contact Dust cache:", error);
  }
}
