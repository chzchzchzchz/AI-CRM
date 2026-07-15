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

function msg(e: unknown): string { return e instanceof Error ? e.message : "request failed"; }
