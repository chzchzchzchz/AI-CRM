/**
 * 6sense — Company Identification API v3.
 *
 * Docs: https://api.6sense.com/docs/#company-identification-api
 *
 * Three things were wrong with the previous version of this file, and all three are
 * the same shape: a failure that looks like an empty answer.
 *
 *   1. A 401 returned null. So did a 404, a network error, and a missing API key.
 *      Every one reached the caller as "6sense has nothing on this company" — which
 *      is a perfectly ordinary thing for 6sense to say. A revoked key would have
 *      looked like a quiet book of business, indefinitely.
 *
 *   2. The API key was read once, at module load. Anything importing this before
 *      dotenv had run captured `undefined` and kept it for the life of the process,
 *      warning to a log nobody reads.
 *
 *   3. The base URL was fixed, so no request path could be exercised end to end
 *      without calling 6sense for real.
 *
 * Callers now get an outcome they can act on, and "no match" is one specific outcome
 * rather than the default for everything that went wrong.
 */

/** Overridable so the connector smoke harness can run a full request against a stand-in. */
const apiUrl = () => process.env.SIXSENSE_API_URL || "https://epsilon.6sense.com/v3/company/details";

/** Read at call time, not module load — see (2) above. */
const apiKey = () => process.env.SIXSENSE_API_KEY;

export function isSixsenseConfigured(): boolean {
  return Boolean(apiKey());
}

export interface SixsenseCompanyData {
  company_match: string;
  company?: {
    companyId?: string;
    name?: string;
    domain?: string;
    industry?: string;
    employee_range?: string;
    employee_count?: number;
    revenue_range?: string;
    annual_revenue?: number;
    country?: string;
    state?: string;
    city?: string;
    region?: string;
  };
  buying_stage?: string;
  profile_fit?: string;
  intent_score?: number;
  segments?: string[];
}

/**
 * Why a lookup produced nothing.
 *
 * `no_match` is 6sense saying it doesn't know the company — an ordinary, correct
 * answer. Everything else is a problem on our side, and must not be reported as
 * though 6sense had answered.
 */
export type SixsenseOutcome =
  | { ok: true; data: SixsenseCompanyData }
  | { ok: false; reason: "not_configured" | "no_match" | "rejected" | "error"; message: string };

async function lookup(param: string, value: string): Promise<SixsenseOutcome> {
  const key = apiKey();
  if (!key) {
    return { ok: false, reason: "not_configured", message: "SIXSENSE_API_KEY is not set" };
  }
  if (!value) {
    return { ok: false, reason: "error", message: `${param} is required` };
  }

  try {
    const url = `${apiUrl()}?${param}=${encodeURIComponent(value)}`;
    const res = await fetch(url, { headers: { Authorization: `Token ${key}` } });

    if (res.status === 404) {
      return { ok: false, reason: "no_match", message: `6sense has no record for ${value}` };
    }
    if (res.status === 401 || res.status === 403) {
      // The whole reason this type exists: a rejected key is not an empty result.
      return {
        ok: false,
        reason: "rejected",
        message: `6sense rejected the API key (${res.status}). Check SIXSENSE_API_KEY.`,
      };
    }
    if (!res.ok) {
      return { ok: false, reason: "error", message: `6sense returned ${res.status} ${res.statusText}` };
    }

    const data = (await res.json()) as SixsenseCompanyData;
    // A 200 with no company block is 6sense's other way of saying "no match".
    if (!data?.company) {
      return { ok: false, reason: "no_match", message: `6sense has no record for ${value}` };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Company identification by domain. */
export function lookupByDomain(domain: string): Promise<SixsenseOutcome> {
  return lookup("domain", domain);
}

/** Company identification by visitor IP. */
export function lookupByIP(ip: string): Promise<SixsenseOutcome> {
  return lookup("ip", ip);
}

/**
 * Back-compatible shims, for callers that only care whether there is data.
 *
 * New code should use the lookup* functions: null cannot tell you your key is wrong.
 * Anything that is not an ordinary "no match" is logged as an error here, so a
 * rejected key at least leaves a trace even on the old path.
 */
export async function getCompanyByDomain(domain: string): Promise<SixsenseCompanyData | null> {
  const res = await lookupByDomain(domain);
  if (!res.ok && res.reason !== "no_match") console.error(`[6sense] ${res.message}`);
  return res.ok ? res.data : null;
}

export async function getCompanyByIP(ipAddress: string): Promise<SixsenseCompanyData | null> {
  const res = await lookupByIP(ipAddress);
  if (!res.ok && res.reason !== "no_match") console.error(`[6sense] ${res.message}`);
  return res.ok ? res.data : null;
}

export type SixsenseAccount = {
  companyName?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  employeeRange?: string;
  annualRevenue?: number;
  revenueRange?: string;
  country?: string;
  state?: string;
  city?: string;
  region?: string;
  intentScore?: number;
  buyingStage?: string;
  profileFit?: string;
  segments: string[];
  sixsenseId?: string;
  companyMatch: string;
};

/** Flatten 6sense's nested shape onto the fields this app stores. */
export function toAccount(d: SixsenseCompanyData): SixsenseAccount {
  const c = d.company || {};
  return {
    companyName: c.name,
    domain: c.domain,
    industry: c.industry,
    employeeCount: c.employee_count,
    employeeRange: c.employee_range,
    annualRevenue: c.annual_revenue,
    revenueRange: c.revenue_range,
    country: c.country,
    state: c.state,
    city: c.city,
    region: c.region,
    intentScore: d.intent_score,
    buyingStage: d.buying_stage,
    profileFit: d.profile_fit,
    segments: d.segments || [],
    sixsenseId: c.companyId,
    companyMatch: d.company_match,
  };
}

/**
 * Enrich one account by domain, keeping the reason when it fails — so a caller can
 * say "6sense doesn't know them" and "your 6sense key is wrong" as two different
 * sentences.
 */
export async function enrichAccountDetailed(
  domain: string
): Promise<{ ok: true; account: SixsenseAccount } | { ok: false; reason: string; message: string }> {
  const res = await lookupByDomain(domain);
  if (!res.ok) return { ok: false, reason: res.reason, message: res.message };
  return { ok: true, account: toAccount(res.data) };
}

/** Back-compatible: null for anything that isn't a match. */
export async function enrichAccount(domain: string): Promise<SixsenseAccount | null> {
  const res = await enrichAccountDetailed(domain);
  return res.ok ? res.account : null;
}
