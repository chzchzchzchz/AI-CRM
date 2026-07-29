/**
 * Job titles — one vocabulary, one classifier, for the whole codebase.
 *
 * This file exists because "Decision makers" meant two different things on two
 * pages of the same app. Against the same 1,500 contacts, Insights matched
 * seventeen title tokens and said 790; Contacts matched nine and said 619. Both
 * tiles carried the same label, both were reachable in two clicks of each other,
 * and each was "correct" against its own private regex.
 *
 * Neither was right. The real count is 5,365, because people.list caps at 1,500
 * of 10,023 and both pages were counting their own slice.
 *
 * There were eight of those regexes when this was written — in Insights,
 * Contacts (twice), Outreach, priority-actions, hot-leads, intel/signals and
 * ai.ts — no two alike. Nothing was ever going to reconcile them except
 * deleting seven.
 *
 * So: if you need to know how senior a title is, or which title words the app
 * recognises, import it from here. A static check in scripts/check-claims.mjs
 * fails the build if a title taxonomy is defined anywhere else, because that is
 * exactly how the app came to disagree with itself the first time.
 */

export type Seniority = "C-Suite" | "VP" | "Director" | "Manager" | "Individual" | "Unknown";

/**
 * The vocabulary, most senior tier first.
 *
 * Tier order is only a tie-break — see inferSeniority for the actual rule, which
 * is leftmost-longest. Checking tiers top-down was the obvious implementation and
 * it was wrong: `\bpresident\b` matches inside "Vice President", so every VP whose
 * title was spelled out came back C-Suite. That shipped.
 */
const TIER_TOKENS: ReadonlyArray<readonly [Seniority, readonly string[]]> = [
  [
    "C-Suite",
    ["ceo", "cto", "cio", "ciso", "cfo", "coo", "cmo", "cro", "cpo", "cdo", "chro",
     "chief", "founder", "president", "owner", "managing partner"],
  ],
  ["VP", ["vp", "vps", "svp", "evp", "avp", "vice president", "head of"]],
  ["Director", ["director", "dir."]],
  ["Manager", ["manager", "mgr", "supervisor", "principal", "lead"]],
];

/**
 * Roles that are not a seniority tier but that people filter and search by.
 *
 * Kept next to the tiers rather than in whichever component needed one, so a
 * title-word dropdown and a "find me the security architects" query draw on the
 * same vocabulary.
 */
const IC_ROLE_TOKENS = [
  "engineer", "architect", "analyst", "specialist", "consultant",
  "administrator", "security", "sales", "marketing", "engineering",
] as const;

/** Every title word the app recognises, most senior first. */
export const TITLE_TOKENS: readonly string[] = [
  ...TIER_TOKENS.flatMap(([, tokens]) => tokens),
  ...IC_ROLE_TOKENS,
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** token → its tier, for mapping a match back after the scan. */
const TOKEN_TIER = new Map<string, Seniority>(
  TIER_TOKENS.flatMap(([level, tokens]) => tokens.map((t) => [t, level] as const))
);

/**
 * One alternation over every tier token, longest first.
 *
 * Longest-first matters: JavaScript alternation is leftmost-*first*, not
 * leftmost-longest, so at the start of "Vice President" the engine takes whichever
 * branch it reaches first. With "vice president" ahead of "president" it takes the
 * right one.
 */
const TIER_PATTERN = new RegExp(
  `\\b(${[...TOKEN_TIER.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})\\b`,
  "gi"
);

/**
 * Infer seniority from a job title.
 *
 * The rule is **leftmost-longest**: the first title token in the string decides,
 * and where two tokens start together the longer one wins. Job titles lead with
 * the role — "VP of Engineering, Office of the CTO" is a VP, and "Manager, Office
 * of the CEO" is a manager — so reading left to right gets those right, while
 * longest-at-a-position is what keeps "Vice President" from reading as President.
 *
 * The schema has no managementLevel column, so the title string is the only
 * signal available. Inferring it here beats asking a model to guess, and beats
 * every caller guessing differently.
 */
export function inferSeniority(title: string | null | undefined): Seniority {
  if (!title) return "Unknown";
  TIER_PATTERN.lastIndex = 0; // /g regexes carry state between calls
  const hit = TIER_PATTERN.exec(title);
  if (!hit) return "Individual";
  return TOKEN_TIER.get(hit[1].toLowerCase()) ?? "Individual";
}

/**
 * The levels that count as a decision maker.
 *
 * Director is in. A Director of Security signs off on a security purchase, and
 * leaving them out was most of the disagreement — Insights counted directors and
 * Contacts did not.
 */
export const DECISION_MAKER_LEVELS: ReadonlySet<Seniority> = new Set<Seniority>([
  "C-Suite",
  "VP",
  "Director",
]);

/** True when a title has the authority to say yes. */
export function isDecisionMaker(title: string | null | undefined): boolean {
  return DECISION_MAKER_LEVELS.has(inferSeniority(title));
}

/**
 * The subtitle every "Decision makers" tile shows.
 *
 * Shared for the same reason the predicate is: the Contacts tile read
 * "C-level & VPs" while its own filter counted directors too, so the label was
 * wrong even where the number wasn't.
 */
export const DECISION_MAKER_HINT = "C-level, VP & Director";

/** Most senior first — for ranking a contact list by who matters. */
export const SENIORITY_RANK: Record<Seniority, number> = {
  "C-Suite": 0,
  VP: 1,
  Director: 2,
  Manager: 3,
  Individual: 4,
  Unknown: 5,
};

/** Sort comparator: most senior first, ties left in their existing order. */
export function bySeniority(
  a: { title?: string | null },
  b: { title?: string | null }
): number {
  return SENIORITY_RANK[inferSeniority(a.title)] - SENIORITY_RANK[inferSeniority(b.title)];
}
