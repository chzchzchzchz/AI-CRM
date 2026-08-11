/**
 * Rep territories — ONE definition, shared by the client and the server.
 *
 * This existed twice and the two copies did not agree, which broke the feature silently
 * rather than loudly. The client keyed reps by "jordan.bailey@demo.example.com"; the server
 * keyed them by "zane.torres@{COMPANY_EMAIL_DOMAIN}" — different people, and a template
 * placeholder that was never substituted, so no real address could ever match. The server's
 * territory lookup therefore always missed and it returned every account in the workspace,
 * which the dashboard then labelled with the selected rep's territory. The header read
 * "West territory · <2K employees" above a count of 1,000 and a recommendation to call a
 * 37,384-employee company in the Northeast.
 *
 * Both copies also filtered on region "East", which no account has: the regions in use are
 * West, Central, Northeast, Southeast, Southwest and International. Even a matching email
 * would have filtered to nothing.
 *
 * Replace these entries with your own reps. The email is the identity the app matches on,
 * so it must be the address the rep actually signs in with.
 */

export type SizeBand = "<2000" | ">=2000";

export type Territory = {
  name: string;
  /** Must be one of the region values your account data actually uses. */
  region: string;
  sizeFilter: SizeBand;
  /** Short human label, e.g. "West <2K". Derived rather than hand-written where possible. */
  label: string;
};

const band = (s: SizeBand) => (s === "<2000" ? "<2K" : "2K+");

function rep(name: string, region: string, sizeFilter: SizeBand): Territory {
  return { name, region, sizeFilter, label: `${region} ${band(sizeFilter)}` };
}

export const REP_TERRITORIES = {
  "alex.rivera@demo.example.com": rep("Alex Rivera", "Central", "<2000"),
  "jordan.bailey@demo.example.com": rep("Jordan Bailey", "West", "<2000"),
  "sam.okoye@demo.example.com": rep("Sam Okoye", "Northeast", "<2000"),
  "taylor.brooks@demo.example.com": rep("Taylor Brooks", "Central", ">=2000"),
  "casey.morgan@demo.example.com": rep("Casey Morgan", "West", ">=2000"),
  "riley.nguyen@demo.example.com": rep("Riley Nguyen", "Northeast", ">=2000"),
} as const satisfies Record<string, Territory>;

export type RepEmail = keyof typeof REP_TERRITORIES | "";

/** The single territory predicate. Client and server must not re-implement this. */
export function matchesTerritory(
  territory: Territory | null | undefined,
  region: string,
  employeeCount: number
): boolean {
  if (!territory) return true; // no rep selected → unfiltered, and the UI must say so
  if ((region || "") !== territory.region) return false;
  return territory.sizeFilter === "<2000" ? employeeCount < 2000 : employeeCount >= 2000;
}

/** Look up a territory by the rep's sign-in address. Returns null for unknown/blank. */
export function territoryFor(email: string | null | undefined): Territory | null {
  if (!email) return null;
  return (REP_TERRITORIES as Record<string, Territory>)[email] ?? null;
}
