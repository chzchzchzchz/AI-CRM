/**
 * Native SaaS connectors — real API clients for the tools a B2B sales team uses.
 * Each is a thin, real HTTP client against the vendor's documented API. They are
 * feature-flagged by env/config: if the relevant key/URL isn't set, the connector
 * reports { ok:false, skipped:true } instead of throwing, so the app runs without them.
 */

type Result = { ok: boolean; status?: number; skipped?: boolean; error?: string; id?: string };

async function post(url: string, body: any, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** Slack — Incoming Webhook (https://api.slack.com/messaging/webhooks). No OAuth. */
export async function slackNotify(text: string, webhookUrl = process.env.SLACK_WEBHOOK_URL): Promise<Result> {
  if (!webhookUrl) return { ok: false, skipped: true, error: "SLACK_WEBHOOK_URL not set" };
  try {
    const res = await post(webhookUrl, { text });
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Discord — channel webhook. */
export async function discordNotify(content: string, webhookUrl = process.env.DISCORD_WEBHOOK_URL): Promise<Result> {
  if (!webhookUrl) return { ok: false, skipped: true, error: "DISCORD_WEBHOOK_URL not set" };
  try {
    const res = await post(webhookUrl, { content });
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Microsoft Teams — Incoming Webhook (MessageCard). */
export async function teamsNotify(text: string, webhookUrl = process.env.TEAMS_WEBHOOK_URL): Promise<Result> {
  if (!webhookUrl) return { ok: false, skipped: true, error: "TEAMS_WEBHOOK_URL not set" };
  try {
    const res = await post(webhookUrl, { "@type": "MessageCard", "@context": "http://schema.org/extensions", text });
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** HubSpot — CRM v3 create/update contact (private-app token). */
export async function hubspotUpsertContact(
  contact: { email: string; firstname?: string; lastname?: string; company?: string; jobtitle?: string },
  token = process.env.HUBSPOT_ACCESS_TOKEN,
): Promise<Result> {
  if (!token) return { ok: false, skipped: true, error: "HUBSPOT_ACCESS_TOKEN not set" };
  try {
    const res = await post("https://api.hubapi.com/crm/v3/objects/contacts",
      { properties: contact },
      { Authorization: `Bearer ${token}` });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.id, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Notion — create a page in a database (integration token). */
export async function notionCreatePage(
  props: { name: string; domain?: string; industry?: string; intentScore?: number },
  token = process.env.NOTION_TOKEN,
  databaseId = process.env.NOTION_DATABASE_ID,
): Promise<Result> {
  if (!token || !databaseId) return { ok: false, skipped: true, error: "NOTION_TOKEN / NOTION_DATABASE_ID not set" };
  try {
    const res = await post("https://api.notion.com/v1/pages", {
      parent: { database_id: databaseId },
      properties: {
        Name: { title: [{ text: { content: props.name } }] },
        ...(props.domain ? { Domain: { url: `https://${props.domain}` } } : {}),
        ...(props.industry ? { Industry: { rich_text: [{ text: { content: props.industry } }] } } : {}),
        ...(props.intentScore != null ? { "Intent Score": { number: props.intentScore } } : {}),
      },
    }, { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28" });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.id, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Linear — create an issue via GraphQL (API key). */
export async function linearCreateIssue(
  title: string, description?: string,
  apiKey = process.env.LINEAR_API_KEY, teamId = process.env.LINEAR_TEAM_ID,
): Promise<Result> {
  if (!apiKey || !teamId) return { ok: false, skipped: true, error: "LINEAR_API_KEY / LINEAR_TEAM_ID not set" };
  try {
    const res = await post("https://api.linear.app/graphql", {
      query: `mutation($t:String!,$d:String,$team:String!){issueCreate(input:{title:$t,description:$d,teamId:$team}){success issue{id identifier}}}`,
      variables: { t: title, d: description, team: teamId },
    }, { Authorization: apiKey });
    const json: any = await res.json().catch(() => ({}));
    const ok = res.ok && json?.data?.issueCreate?.success;
    return { ok, status: res.status, id: json?.data?.issueCreate?.issue?.identifier, error: ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Intercom — create/update a contact (REST, access token). */
export async function intercomUpsertContact(
  contact: { email: string; name?: string },
  token = process.env.INTERCOM_ACCESS_TOKEN,
): Promise<Result> {
  if (!token) return { ok: false, skipped: true, error: "INTERCOM_ACCESS_TOKEN not set" };
  try {
    const res = await post("https://api.intercom.io/contacts",
      { role: "lead", email: contact.email, name: contact.name },
      { Authorization: `Bearer ${token}`, Accept: "application/json" });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.id, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Airtable — create a record in a table (personal access token). */
export async function airtableCreateRecord(
  fields: Record<string, any>,
  token = process.env.AIRTABLE_TOKEN, baseId = process.env.AIRTABLE_BASE_ID, table = process.env.AIRTABLE_TABLE,
): Promise<Result> {
  if (!token || !baseId || !table) return { ok: false, skipped: true, error: "AIRTABLE_TOKEN / AIRTABLE_BASE_ID / AIRTABLE_TABLE not set" };
  try {
    const res = await post(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`,
      { fields }, { Authorization: `Bearer ${token}` });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.id, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Pipedrive — create a deal (API token). */
export async function pipedriveCreateDeal(
  title: string, value?: number,
  token = process.env.PIPEDRIVE_API_TOKEN, domain = process.env.PIPEDRIVE_DOMAIN,
): Promise<Result> {
  if (!token || !domain) return { ok: false, skipped: true, error: "PIPEDRIVE_API_TOKEN / PIPEDRIVE_DOMAIN not set" };
  try {
    const res = await post(`https://${domain}.pipedrive.com/api/v1/deals?api_token=${encodeURIComponent(token)}`,
      { title, value });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok && json?.success, status: res.status, id: json?.data?.id?.toString(), error: (res.ok && json?.success) ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Apollo.io — enrich a person by email (API key). */
export async function apolloEnrichPerson(
  email: string, apiKey = process.env.APOLLO_API_KEY,
): Promise<Result & { data?: any }> {
  if (!apiKey) return { ok: false, skipped: true, error: "APOLLO_API_KEY not set" };
  try {
    const res = await post("https://api.apollo.io/v1/people/match", { email }, { "X-Api-Key": apiKey });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: json?.person, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Generic outbound webhook (Zapier / Make / n8n / any HTTP endpoint). */
export async function sendWebhook(url: string, payload: any): Promise<Result> {
  if (!url) return { ok: false, skipped: true, error: "no url" };
  try {
    const res = await post(url, payload);
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Google Chat — space webhook (JSON {text}). */
export async function googleChatNotify(text: string, webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL): Promise<Result> {
  if (!webhookUrl) return { ok: false, skipped: true, error: "GOOGLE_CHAT_WEBHOOK_URL not set" };
  try {
    const res = await post(webhookUrl, { text });
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Twilio — send an SMS (REST, basic auth, form-encoded). */
export async function twilioSendSms(
  to: string, body: string,
  sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM_NUMBER,
): Promise<Result> {
  if (!sid || !token || !from) return { ok: false, skipped: true, error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER not set" };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.sid, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Segment — track an analytics event (REST, write key as basic-auth username). */
export async function segmentTrack(
  event: string, userId: string, properties: Record<string, any> = {},
  writeKey = process.env.SEGMENT_WRITE_KEY,
): Promise<Result> {
  if (!writeKey) return { ok: false, skipped: true, error: "SEGMENT_WRITE_KEY not set" };
  try {
    const res = await fetch("https://api.segment.io/v1/track", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${writeKey}:`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ event, userId, properties }),
    });
    return { ok: res.ok, status: res.status, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/**
 * Fan-out: notify every configured chat connector (Slack, Discord, Teams, Google Chat)
 * plus an optional generic webhook — one event → all your tools.
 */
export async function notifyAll(text: string, webhookUrl?: string): Promise<Record<string, Result>> {
  const [slack, discord, teams, gchat, webhook] = await Promise.all([
    slackNotify(text),
    discordNotify(text),
    teamsNotify(text),
    googleChatNotify(text),
    webhookUrl ? sendWebhook(webhookUrl, { text }) : Promise.resolve({ ok: false, skipped: true } as Result),
  ]);
  return { slack, discord, teams, googleChat: gchat, webhook };
}

/** Salesloft — create a person (sales engagement). */
export async function salesloftCreatePerson(
  person: { email_address: string; first_name?: string; last_name?: string; title?: string },
  token = process.env.SALESLOFT_API_KEY,
): Promise<Result> {
  if (!token) return { ok: false, skipped: true, error: "SALESLOFT_API_KEY not set" };
  try {
    const res = await post("https://api.salesloft.com/v2/people.json", person, { Authorization: `Bearer ${token}` });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.data?.id?.toString(), error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Outreach.io — create a prospect (JSON:API). */
export async function outreachCreateProspect(
  attributes: { emails: string[]; firstName?: string; lastName?: string; title?: string },
  token = process.env.OUTREACH_ACCESS_TOKEN,
): Promise<Result> {
  if (!token) return { ok: false, skipped: true, error: "OUTREACH_ACCESS_TOKEN not set" };
  try {
    const res = await post("https://api.outreach.io/api/v2/prospects",
      { data: { type: "prospect", attributes } },
      { Authorization: `Bearer ${token}`, "Content-Type": "application/vnd.api+json" });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.data?.id?.toString(), error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Calendly — fetch the connected scheduling account (verifies + returns user/link). */
export async function calendlyGetAccount(token = process.env.CALENDLY_API_KEY): Promise<Result & { data?: any }> {
  if (!token) return { ok: false, skipped: true, error: "CALENDLY_API_KEY not set" };
  try {
    const res = await fetch("https://api.calendly.com/users/me", { headers: { Authorization: `Bearer ${token}` } });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.resource?.uri, data: json?.resource, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** Asana — create a task. */
export async function asanaCreateTask(
  name: string, notes?: string,
  token = process.env.ASANA_ACCESS_TOKEN, workspace = process.env.ASANA_WORKSPACE_ID,
): Promise<Result> {
  if (!token || !workspace) return { ok: false, skipped: true, error: "ASANA_ACCESS_TOKEN / ASANA_WORKSPACE_ID not set" };
  try {
    const res = await post("https://app.asana.com/api/1.0/tasks",
      { data: { name, notes, workspace } }, { Authorization: `Bearer ${token}` });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.data?.gid, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** ClickUp — create a task in a list. */
export async function clickupCreateTask(
  name: string, description?: string,
  token = process.env.CLICKUP_API_TOKEN, listId = process.env.CLICKUP_LIST_ID,
): Promise<Result> {
  if (!token || !listId) return { ok: false, skipped: true, error: "CLICKUP_API_TOKEN / CLICKUP_LIST_ID not set" };
  try {
    const res = await post(`https://api.clickup.com/api/v2/list/${listId}/task`,
      { name, description }, { Authorization: token });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.id, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/** PagerDuty — trigger an alert (Events API v2). */
export async function pagerdutyTrigger(
  summary: string, routingKey = process.env.PAGERDUTY_ROUTING_KEY,
): Promise<Result> {
  if (!routingKey) return { ok: false, skipped: true, error: "PAGERDUTY_ROUTING_KEY not set" };
  try {
    const res = await post("https://events.pagerduty.com/v2/enqueue", {
      routing_key: routingKey,
      event_action: "trigger",
      payload: { summary, source: "TargetDash", severity: "info" },
    });
    const json: any = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, id: json?.dedup_key, error: res.ok ? undefined : JSON.stringify(json) };
  } catch (e) { return { ok: false, error: msg(e) }; }
}

/**
 * Auto-trigger: when an account's intent score CROSSES the hot threshold
 * (HOT_LEAD_THRESHOLD, default 80), fan out a notification to every configured tool.
 * Fire-and-forget so it never blocks the ingest request. Only fires on the crossing
 * (prev < threshold <= new), so it won't spam on every update.
 */
export function maybeNotifyHotLead(name: string, score?: number | null, prevScore?: number | null): void {
  const threshold = parseInt(process.env.HOT_LEAD_THRESHOLD || "80");
  const s = Number(score) || 0;
  const p = Number(prevScore) || 0;
  if (s < threshold || p >= threshold) return;

  notifyAll(`🔥 Hot lead: ${name} crossed intent ${threshold} (now ${s})`)
    .then((results) => {
      // The result used to be discarded: `.catch(() => {})` and nothing else. A rep
      // who set up a Slack alert and typo'd the webhook URL got no ping and no trace,
      // indefinitely — the one failure mode an alerting feature cannot have, because
      // silence is exactly what it looks like when nothing is happening.
      const delivered = Object.entries(results).filter(([, r]) => r.ok);
      if (delivered.length) return;

      const configured = Object.entries(results).filter(([, r]) => !r.skipped);
      if (!configured.length) {
        // Nothing set up at all. Not an error — just worth saying once, since the
        // threshold was crossed and nobody heard about it.
        console.warn(
          `[alerts] ${name} crossed intent ${threshold} but no notification channel is configured`
        );
        return;
      }
      console.error(
        `[alerts] ${name} crossed intent ${threshold} and every configured channel failed: ` +
          configured.map(([k, r]) => `${k}=${r.status ?? r.error ?? "failed"}`).join(", ")
      );
    })
    .catch((e) => {
      console.error(`[alerts] hot-lead notification threw for ${name}:`, msg(e));
    });
}

function msg(e: unknown): string { return e instanceof Error ? e.message : "request failed"; }

/* ------------------------------------------------------------------ identity checks */

/**
 * "Is this credential real, and does the vendor still answer the way we parse?"
 *
 * Every connector above performs a WRITE — create an issue, upsert a contact, post a
 * message. That is the right shape for the product and the wrong shape for a check that
 * has to run on every CI build: a smoke test that files a Linear issue each time is a
 * smoke test somebody turns off. So each vendor gets a read-only identity endpoint here,
 * the request every vendor documents for exactly this purpose.
 *
 * What this proves and does not prove: the key is valid, the account is reachable, and
 * the response still has the field we read. It does not prove the write path works —
 * only a real write does that, which is what the connector's own procedure is for.
 * `pnpm smoke` reports it as a credential check, not as a verified integration.
 */
export type IdentityCheck = { ok: boolean; detail: string };

async function identity(
  label: string,
  url: string,
  headers: Record<string, string>,
  pick: (json: any) => string | undefined,
): Promise<IdentityCheck> {
  try {
    const res = await fetch(url, { headers });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // The status is the useful half — 401 means the key is wrong, 403 means it is
      // right and lacks a scope, and those need different fixes.
      return { ok: false, detail: `HTTP ${res.status} ${JSON.stringify(json).slice(0, 120)}` };
    }
    const who = pick(json);
    if (!who) {
      // Authenticated but the shape moved. This is the case a mocked test cannot catch
      // and the whole reason to spend a live request.
      return { ok: false, detail: `authenticated, but the response had no ${label} field — the API shape changed` };
    }
    return { ok: true, detail: who };
  } catch (e) {
    return { ok: false, detail: msg(e) };
  }
}

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

export const identityChecks: Record<
  string,
  { env: string[]; configured: () => boolean; run: () => Promise<IdentityCheck> }
> = {
  hubspot: {
    env: ["HUBSPOT_ACCESS_TOKEN"],
    configured: () => Boolean(process.env.HUBSPOT_ACCESS_TOKEN),
    run: () =>
      identity("hub", "https://api.hubapi.com/account-info/v3/details",
        bearer(process.env.HUBSPOT_ACCESS_TOKEN!), j => j?.portalId && `portal ${j.portalId}`),
  },
  notion: {
    env: ["NOTION_TOKEN"],
    configured: () => Boolean(process.env.NOTION_TOKEN),
    run: () =>
      identity("bot", "https://api.notion.com/v1/users/me",
        { ...bearer(process.env.NOTION_TOKEN!), "Notion-Version": "2022-06-28" },
        j => j?.name || j?.bot?.owner?.type),
  },
  linear: {
    env: ["LINEAR_API_KEY"],
    configured: () => Boolean(process.env.LINEAR_API_KEY),
    run: async () => {
      // Linear is GraphQL-only, so the identity read is a POST. Still a read.
      try {
        const res = await post("https://api.linear.app/graphql",
          { query: "{ viewer { name email } }" },
          { Authorization: process.env.LINEAR_API_KEY! });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
        const name = json?.data?.viewer?.name;
        return name
          ? { ok: true, detail: name }
          : { ok: false, detail: "authenticated, but viewer.name was absent — the API shape changed" };
      } catch (e) { return { ok: false, detail: msg(e) }; }
    },
  },
  airtable: {
    env: ["AIRTABLE_TOKEN"],
    configured: () => Boolean(process.env.AIRTABLE_TOKEN),
    run: () =>
      identity("user id", "https://api.airtable.com/v0/meta/whoami",
        bearer(process.env.AIRTABLE_TOKEN!), j => j?.id),
  },
  pipedrive: {
    env: ["PIPEDRIVE_API_TOKEN"],
    configured: () => Boolean(process.env.PIPEDRIVE_API_TOKEN),
    run: () =>
      identity("user", `https://api.pipedrive.com/v1/users/me?api_token=${process.env.PIPEDRIVE_API_TOKEN}`,
        {}, j => j?.data?.name),
  },
  intercom: {
    env: ["INTERCOM_ACCESS_TOKEN"],
    configured: () => Boolean(process.env.INTERCOM_ACCESS_TOKEN),
    run: () =>
      identity("app", "https://api.intercom.io/me",
        { ...bearer(process.env.INTERCOM_ACCESS_TOKEN!), Accept: "application/json" },
        j => j?.app?.name || j?.name),
  },
  salesloft: {
    env: ["SALESLOFT_API_KEY"],
    configured: () => Boolean(process.env.SALESLOFT_API_KEY),
    run: () =>
      identity("user", "https://api.salesloft.com/v2/me",
        bearer(process.env.SALESLOFT_API_KEY!), j => j?.data?.name || j?.data?.email),
  },
  calendly: {
    env: ["CALENDLY_API_KEY"],
    configured: () => Boolean(process.env.CALENDLY_API_KEY),
    run: () =>
      identity("user", "https://api.calendly.com/users/me",
        bearer(process.env.CALENDLY_API_KEY!), j => j?.resource?.name || j?.resource?.email),
  },
  asana: {
    env: ["ASANA_ACCESS_TOKEN"],
    configured: () => Boolean(process.env.ASANA_ACCESS_TOKEN),
    run: () =>
      identity("user", "https://app.asana.com/api/1.0/users/me",
        bearer(process.env.ASANA_ACCESS_TOKEN!), j => j?.data?.name || j?.data?.email),
  },
  clickup: {
    env: ["CLICKUP_API_TOKEN"],
    configured: () => Boolean(process.env.CLICKUP_API_TOKEN),
    run: () =>
      identity("user", "https://api.clickup.com/api/v2/user",
        { Authorization: process.env.CLICKUP_API_TOKEN! }, j => j?.user?.username || j?.user?.email),
  },
  apollo: {
    env: ["APOLLO_API_KEY"],
    configured: () => Boolean(process.env.APOLLO_API_KEY),
    run: () =>
      // Deliberately the health endpoint, not an enrich: an enrich call spends a credit
      // per CI run, and a check that costs money per build is a check that gets removed.
      identity("auth", `https://api.apollo.io/v1/auth/health?api_key=${process.env.APOLLO_API_KEY}`,
        {}, j => (j?.is_logged_in ? "key accepted" : undefined)),
  },
  twilio: {
    env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
    configured: () => Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
    run: () =>
      identity("account",
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
        {
          Authorization:
            "Basic " +
            Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
        },
        j => j?.friendly_name || j?.status),
  },
  // PagerDuty is deliberately absent. An Events v2 routing key has no read endpoint at
  // all: the only way to learn whether one works is to fire an event, which pages a human
  // on call. Listing it here with `configured: () => false` would have reported it as "no
  // credentials" — a different statement, and an untrue one for an operator who has set
  // the key. It is counted in the uncheckable remainder instead.
};
