/**
 * What a "worked" 6QA is, defined once.
 *
 * The home page and Intent Signals both showed an unworked-6QA count and disagreed by a
 * factor of eleven — 69 against 6 — one click apart. Home counted qualified accounts
 * with no opportunity. Intent Signals counted an account as worked if it had a contact
 * on file, and the demo seed imports about ten contacts for nearly every account, so
 * 92 of 105 qualified accounts were "worked" without anyone having done anything.
 *
 * The home page's definition is the one its test pins down and the one Insights also
 * reports, so that is the definition: an account at intent >= 70 is worked once it has
 * an opportunity — any opportunity, including one that was lost, because a lost deal
 * was still worked. Both pages call this, so the two numbers cannot drift apart again.
 */
export const SIX_QA_THRESHOLD = 70;

export function isSixQA(account: { intentScore?: unknown }): boolean {
  return (Number(account.intentScore) || 0) >= SIX_QA_THRESHOLD;
}

/** Qualified accounts that have no opportunity of any kind. */
export function unworkedSixQAs<T extends { id: number; intentScore?: unknown }>(
  accounts: T[],
  accountIdsWithOpportunity: ReadonlySet<number>
): T[] {
  return accounts.filter((a) => isSixQA(a) && !accountIdsWithOpportunity.has(a.id));
}
