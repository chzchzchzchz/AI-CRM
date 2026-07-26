/**
 * ZoomInfo — native API client (Enterprise API).
 *
 * Unlike the single-key connectors in `connectors.ts`, ZoomInfo issues a JWT
 * that expires after roughly an hour, so this module owns a small token
 * lifecycle: authenticate once, reuse until shortly before expiry, then renew.
 * Without that cache every enrichment would spend a round trip re-authenticating,
 * and ZoomInfo rate-limits the auth endpoint far more aggressively than the data
 * endpoints.
 *
 * Auth supports both documented methods:
 *   - username + password        (ZOOMINFO_USERNAME / ZOOMINFO_PASSWORD)
 *   - PKI: username + client id + private key (ZOOMINFO_CLIENT_ID / ZOOMINFO_PRIVATE_KEY)
 *
 * Docs: https://api-docs.zoominfo.com/
 */

type Result<T = unknown> = {
  ok: boolean;
  status?: number;
  skipped?: boolean;
  error?: string;
  data?: T;
};

const BASE = "https://api.zoominfo.com";

/** Renew a minute early so an in-flight request can't land on an expired token. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

let cachedToken: { jwt: string; expiresAt: number } | null = null;

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function credentials() {
  return {
    username: process.env.ZOOMINFO_USERNAME,
    password: process.env.ZOOMINFO_PASSWORD,
    clientId: process.env.ZOOMINFO_CLIENT_ID,
    privateKey: process.env.ZOOMINFO_PRIVATE_KEY,
  };
}

export function isZoomInfoConfigured(): boolean {
  const c = credentials();
  return Boolean(c.username && (c.password || (c.clientId && c.privateKey)));
}

/** Exposed so tests and a re-auth path can drop a token that started 401ing. */
export function resetZoomInfoToken() {
  cachedToken = null;
}

async function authenticate(): Promise<Result<string>> {
  const c = credentials();
  if (!isZoomInfoConfigured()) {
    return {
      ok: false,
      skipped: true,
      error:
        "ZoomInfo not configured (set ZOOMINFO_USERNAME plus either ZOOMINFO_PASSWORD or ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY)",
    };
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { ok: true, data: cachedToken.jwt };
  }

  const usePki = Boolean(c.clientId && c.privateKey);
  const url = usePki ? `${BASE}/authenticate` : `${BASE}/authenticate`;
  const body = usePki
    ? { username: c.username, clientId: c.clientId, privateKey: c.privateKey }
    : { username: c.username, password: c.password };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.jwt) {
      return {
        ok: false,
        status: res.status,
        error: json?.message || `authentication failed (${res.status})`,
      };
    }
    cachedToken = { jwt: json.jwt, expiresAt: Date.now() + TOKEN_TTL_MS };
    return { ok: true, status: res.status, data: json.jwt };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * One authenticated POST, retrying once on 401 with a fresh token — a cached
 * JWT can be invalidated server-side before our own TTL is up.
 */
async function authedPost<T>(path: string, body: unknown): Promise<Result<T>> {
  const auth = await authenticate();
  if (!auth.ok) return { ok: false, skipped: auth.skipped, error: auth.error, status: auth.status };

  const send = (jwt: string) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body),
    });

  try {
    let res = await send(auth.data!);
    if (res.status === 401) {
      resetZoomInfoToken();
      const retry = await authenticate();
      if (!retry.ok) return { ok: false, error: retry.error, status: retry.status };
      res = await send(retry.data!);
    }
    const json: any = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (json as T) : undefined,
      error: res.ok ? undefined : json?.message || `request failed (${res.status})`,
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export type ZoomInfoCompany = {
  id?: number;
  name?: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  revenue?: number;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  linkedInUrl?: string;
  technologies?: string[];
};

/** Enrich one company by domain (or name). Returns the best match, if any. */
export async function zoominfoEnrichCompany(input: {
  domain?: string;
  name?: string;
}): Promise<Result<ZoomInfoCompany>> {
  if (!input.domain && !input.name) {
    return { ok: false, error: "domain or name is required" };
  }

  const res = await authedPost<any>("/enrich/company", {
    matchCompanyInput: [
      {
        companyWebsite: input.domain,
        companyName: input.name,
      },
    ],
    outputFields: [
      "id", "name", "website", "industry", "employeeCount", "revenue",
      "city", "state", "country", "phone", "linkedInUrl", "technologies",
    ],
  });
  if (!res.ok) return res as Result<ZoomInfoCompany>;

  const match = res.data?.data?.result?.[0]?.data?.[0];
  if (!match) return { ok: true, status: res.status, data: undefined };

  return {
    ok: true,
    status: res.status,
    data: {
      id: match.id,
      name: match.name,
      website: match.website,
      industry: match.industry,
      employeeCount: match.employeeCount,
      revenue: match.revenue,
      city: match.city,
      state: match.state,
      country: match.country,
      phone: match.phone,
      linkedInUrl: match.linkedInUrl,
      technologies: Array.isArray(match.technologies)
        ? match.technologies.map((t: any) => t?.name ?? t).filter(Boolean)
        : undefined,
    },
  };
}

export type ZoomInfoContact = {
  id?: number;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  linkedInUrl?: string;
  managementLevel?: string;
  companyName?: string;
};

/**
 * Find contacts at a company, optionally narrowed by seniority or department.
 * `companyDomain` is the reliable key; names collide across the database.
 */
export async function zoominfoSearchContacts(input: {
  companyDomain: string;
  managementLevel?: string;
  department?: string;
  limit?: number;
}): Promise<Result<ZoomInfoContact[]>> {
  if (!input.companyDomain) return { ok: false, error: "companyDomain is required" };

  const res = await authedPost<any>("/search/contact", {
    companyWebsite: input.companyDomain,
    managementLevel: input.managementLevel,
    department: input.department,
    rpp: Math.min(Math.max(input.limit ?? 25, 1), 100),
  });
  if (!res.ok) return res as Result<ZoomInfoContact[]>;

  const rows: any[] = res.data?.data ?? [];
  return {
    ok: true,
    status: res.status,
    data: rows.map(r => ({
      id: r.id,
      firstName: r.firstName,
      lastName: r.lastName,
      jobTitle: r.jobTitle,
      email: r.email,
      phone: r.phone,
      linkedInUrl: r.linkedInUrl,
      managementLevel: r.managementLevel,
      companyName: r.companyName,
    })),
  };
}

/** Enrich a single known contact by email, for filling in phone/title/seniority. */
export async function zoominfoEnrichContact(email: string): Promise<Result<ZoomInfoContact>> {
  if (!email) return { ok: false, error: "email is required" };

  const res = await authedPost<any>("/enrich/contact", {
    matchPersonInput: [{ emailAddress: email }],
    outputFields: [
      "id", "firstName", "lastName", "jobTitle", "email", "phone",
      "linkedInUrl", "managementLevel", "companyName",
    ],
  });
  if (!res.ok) return res as Result<ZoomInfoContact>;

  const match = res.data?.data?.result?.[0]?.data?.[0];
  return { ok: true, status: res.status, data: match ?? undefined };
}
