/**
 * Gong — native API client (v2).
 *
 * This module did not exist. `GONG_API_KEY` was advertised in the integration
 * registry, `pnpm doctor` reported it "ready" when set, the README had a whole
 * "Gong Call Intelligence" section, and the `gong.*` router read the local `calls`
 * table. Nothing ever called Gong. The key was decoration.
 *
 * What the app already does well is *analyse* a transcript once it has one
 * (`analyzeGongCall` in ai.ts). What was missing was getting one.
 *
 * Auth is Basic with a base64 of `accessKey:accessKeySecret` — Gong issues both
 * together under Settings → API. A single opaque GONG_API_KEY is also accepted and
 * sent as a Bearer token, because that is the shape the registry has always asked
 * for and existing setups will have it.
 *
 * Docs: https://gong.app.gong.io/settings/api  ·  https://us-*.api.gong.io/v2
 */

type Result<T = unknown> = {
  ok: boolean;
  status?: number;
  skipped?: boolean;
  error?: string;
  data?: T;
};

/**
 * Overridable so the connector smoke harness can point a full request cycle at a
 * local stand-in — auth header, pagination, mapping and error handling all run for
 * real, and only the vendor is substituted.
 */
const BASE = process.env.GONG_API_URL || "https://api.gong.io";

/** Gong's page size ceiling for /v2/calls. Asking for more is a 400, not a clamp. */
const MAX_PAGE_SIZE = 100;

function msg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function credentials() {
  return {
    accessKey: process.env.GONG_ACCESS_KEY,
    accessKeySecret: process.env.GONG_ACCESS_KEY_SECRET,
    apiKey: process.env.GONG_API_KEY,
  };
}

export function isGongConfigured(): boolean {
  const c = credentials();
  return Boolean((c.accessKey && c.accessKeySecret) || c.apiKey);
}

/** The Authorization header for whichever credential shape is configured. */
function authHeader(): string | null {
  const c = credentials();
  if (c.accessKey && c.accessKeySecret) {
    return `Basic ${Buffer.from(`${c.accessKey}:${c.accessKeySecret}`).toString("base64")}`;
  }
  if (c.apiKey) return `Bearer ${c.apiKey}`;
  return null;
}

/**
 * One authenticated request.
 *
 * Unconfigured is `skipped`, not an error: every integration here is optional and
 * the app has to run without any of them. A 401 is a real failure and says so —
 * silently returning nothing is how a wrong key looks exactly like an empty account.
 */
async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}
): Promise<Result<T>> {
  const auth = authHeader();
  if (!auth) {
    return {
      ok: false,
      skipped: true,
      error: "Gong is not configured (set GONG_ACCESS_KEY + GONG_ACCESS_KEY_SECRET, or GONG_API_KEY)",
    };
  }

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(init.query || {})) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }

  try {
    const res = await fetch(url.toString(), {
      method: init.method || "GET",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const json: any = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: res.status, data: json as T };

    // Gong returns { errors: [...] } on 4xx; surface the first rather than a bare code.
    const detail = Array.isArray(json?.errors) ? json.errors[0] : json?.message;
    return {
      ok: false,
      status: res.status,
      error:
        res.status === 401 || res.status === 403
          ? `Gong rejected the credentials (${res.status}). Check the access key and secret.`
          : detail || `request failed (${res.status})`,
    };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export type GongCall = {
  id: string;
  title?: string;
  started?: string;
  duration?: number;
  url?: string;
  direction?: string;
  participants?: { name?: string; emailAddress?: string; affiliation?: string }[];
};

/** Gong's call record, flattened to what this app stores. */
function mapCall(raw: any): GongCall {
  return {
    id: String(raw?.id ?? ""),
    title: raw?.title ?? undefined,
    started: raw?.started ?? undefined,
    // Gong reports seconds; the calls table is seconds too, so no conversion.
    duration: typeof raw?.duration === "number" ? raw.duration : undefined,
    url: raw?.url ?? undefined,
    direction: raw?.direction ?? undefined,
    participants: Array.isArray(raw?.parties)
      ? raw.parties.map((p: any) => ({
          name: p?.name ?? undefined,
          emailAddress: p?.emailAddress ?? undefined,
          affiliation: p?.affiliation ?? undefined,
        }))
      : undefined,
  };
}

/**
 * List calls in a window.
 *
 * Gong paginates with an opaque cursor and will keep handing them out; this follows
 * them up to `maxPages` so one bad window cannot spin forever against a rate limit.
 */
export async function gongListCalls(input: {
  fromDateTime?: string;
  toDateTime?: string;
  limit?: number;
  maxPages?: number;
}): Promise<Result<{ calls: GongCall[]; pages: number }>> {
  const limit = Math.min(Math.max(input.limit ?? MAX_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const maxPages = Math.max(input.maxPages ?? 10, 1);

  const calls: GongCall[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const res = await call<any>("/v2/calls", {
      query: {
        fromDateTime: input.fromDateTime,
        toDateTime: input.toDateTime,
        limit: String(limit),
        cursor,
      },
    });
    if (!res.ok) return { ok: false, status: res.status, skipped: res.skipped, error: res.error };

    pages += 1;
    for (const raw of res.data?.calls || []) calls.push(mapCall(raw));
    cursor = res.data?.records?.cursor || undefined;
  } while (cursor && pages < maxPages);

  return { ok: true, data: { calls, pages } };
}

export type GongTranscript = {
  callId: string;
  /** Speaker turns, in order, flattened from Gong's sentence-level structure. */
  turns: { speakerId?: string; text: string }[];
};

/**
 * Fetch transcripts for specific calls.
 *
 * Gong returns a sentence per array entry; a rep reading a transcript wants speaker
 * turns, so consecutive sentences from one speaker are joined here rather than in
 * every consumer.
 */
export async function gongGetTranscripts(callIds: string[]): Promise<Result<GongTranscript[]>> {
  if (!callIds.length) return { ok: false, error: "No call ids given" };

  const res = await call<any>("/v2/calls/transcript", {
    method: "POST",
    body: { filter: { callIds } },
  });
  if (!res.ok) return { ok: false, status: res.status, skipped: res.skipped, error: res.error };

  const out: GongTranscript[] = (res.data?.callTranscripts || []).map((t: any) => {
    const turns: { speakerId?: string; text: string }[] = [];
    for (const seg of t?.transcript || []) {
      const text = (seg?.sentences || [])
        .map((s: any) => s?.text)
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!text) continue;
      const last = turns[turns.length - 1];
      if (last && last.speakerId === seg?.speakerId) last.text += ` ${text}`;
      else turns.push({ speakerId: seg?.speakerId ?? undefined, text });
    }
    return { callId: String(t?.callId ?? ""), turns };
  });

  return { ok: true, data: out };
}

/**
 * Cheapest authenticated call Gong offers, for the setup doctor and the smoke test.
 *
 * A credential check has to actually spend a request. Validating the *shape* of a key
 * is what `pnpm doctor` already does, and it cannot tell a well-formed revoked key
 * from a working one.
 */
export async function gongTestConnection(): Promise<Result<{ users: number }>> {
  const res = await call<any>("/v2/users", { query: { limit: "1" } });
  if (!res.ok) return { ok: false, status: res.status, skipped: res.skipped, error: res.error };

  // Assert the field is *there*, rather than defaulting it.
  //
  // This originally read `res.data?.records?.totalRecords ?? 0`. Pointed at a stand-in
  // that had moved the field to `data.total` — exactly the contract drift this function
  // exists to detect — it reported a healthy connection with "0 users". A silent zero
  // is indistinguishable from a real empty tenant, which is the failure mode, not a
  // tidy default.
  const total = res.data?.records?.totalRecords;
  if (typeof total !== "number") {
    return {
      ok: false,
      status: res.status,
      error:
        "Authenticated, but /v2/users did not return records.totalRecords — " +
        "Gong's response shape has changed and the client needs updating.",
    };
  }
  return { ok: true, status: res.status, data: { users: total } };
}
