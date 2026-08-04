import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  slackNotify,
  discordNotify,
  hubspotUpsertContact,
  notifyAll,
  maybeNotifyHotLead,
} from "./integrations/connectors";

/**
 * Contract tests for the shared SaaS connectors.
 *
 * Unlike the 6sense and Salesforce clients, these were already sound on the question
 * that mattered: unconfigured returns `{ ok:false, skipped:true }`, a failed request
 * carries its status, and a thrown fetch is caught and returned. Worth stating
 * plainly, because I went looking for the same defect here and did not find it.
 *
 * What was missing was one level up. maybeNotifyHotLead fired notifyAll and threw the
 * result away — `.catch(() => {})` and nothing else. A rep who set up a Slack alert
 * and mistyped the webhook URL got no ping and no trace of why, indefinitely. For an
 * alerting feature that is the one unacceptable failure mode: silence is precisely
 * what success looks like when no account has gone hot.
 */

const ORIGINAL = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

const reply = (status = 200, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const NOTIFY_ENV = [
  "SLACK_WEBHOOK_URL",
  "DISCORD_WEBHOOK_URL",
  "TEAMS_WEBHOOK_URL",
  "GOOGLE_CHAT_WEBHOOK_URL",
  "HOT_LEAD_THRESHOLD",
];

beforeEach(() => {
  for (const k of [...NOTIFY_ENV, "HUBSPOT_ACCESS_TOKEN"]) delete process.env[k];
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL };
});

describe("configuration is distinct from failure", () => {
  it("reports unconfigured as skipped, and spends no request", async () => {
    const res = await slackNotify("hello");
    expect(res).toMatchObject({ ok: false, skipped: true });
    expect(res.error).toMatch(/SLACK_WEBHOOK_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a rejected webhook as failed, with the status", async () => {
    // skipped:false is the distinction — a dead webhook URL is not "not set up".
    fetchMock.mockResolvedValue(reply(404));
    const res = await slackNotify("hello", "https://hooks.slack.com/services/GONE");
    expect(res.ok).toBe(false);
    expect(res.skipped).toBeUndefined();
    expect(res.status).toBe(404);
  });

  it("catches a network failure instead of throwing at the caller", async () => {
    fetchMock.mockRejectedValue(new Error("EAI_AGAIN"));
    const res = await discordNotify("hi", "https://discord.com/api/webhooks/x");
    expect(res).toMatchObject({ ok: false });
    expect(res.error).toMatch(/EAI_AGAIN/);
  });

  it("carries the vendor's error body back on a 4xx", async () => {
    process.env.HUBSPOT_ACCESS_TOKEN = "tok";
    fetchMock.mockResolvedValue(reply(400, { message: "Property 'jobtitle' does not exist" }));
    const res = await hubspotUpsertContact({ email: "a@b.com" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/does not exist/);
  });
});

describe("notifyAll", () => {
  it("returns a per-channel result rather than one aggregate boolean", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/ok";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/bad";
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(reply(String(url).includes("bad") ? 404 : 200))
    );

    const results = await notifyAll("hot lead");
    expect(results.slack.ok).toBe(true);
    expect(results.discord).toMatchObject({ ok: false, status: 404 });
    // Not configured is its own state, not a failure.
    expect(results.teams.skipped).toBe(true);
  });
});

describe("maybeNotifyHotLead", () => {
  it("fires only on the rising edge", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/ok";
    fetchMock.mockResolvedValue(reply(200));

    maybeNotifyHotLead("Brightwave", 91, 74); // crossed
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fetchMock.mockClear();
    maybeNotifyHotLead("Brightwave", 93, 91); // already hot — no second ping
    maybeNotifyHotLead("Brightwave", 40, 20); // still cold
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("honours HOT_LEAD_THRESHOLD", async () => {
    process.env.HOT_LEAD_THRESHOLD = "50";
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/ok";
    fetchMock.mockResolvedValue(reply(200));

    maybeNotifyHotLead("Pinnacle", 60, 40);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).text).toMatch(/crossed intent 50/);
  });

  it("logs when every configured channel failed", async () => {
    // The defect: this used to be `.catch(() => {})`, so a dead webhook meant no
    // ping and no trace. Silence is what an alerting feature looks like when it is
    // working, which is why it has to say when it isn't.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/gone";
    fetchMock.mockResolvedValue(reply(404));

    maybeNotifyHotLead("Brightwave", 91, 10);
    await vi.waitFor(() =>
      expect(err).toHaveBeenCalledWith(expect.stringMatching(/every configured channel failed/))
    );
    expect(err.mock.calls[0][0]).toMatch(/slack=404/);
  });

  it("warns, without erroring, when nothing is configured at all", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    maybeNotifyHotLead("Brightwave", 91, 10);
    await vi.waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no notification channel is configured/))
    );
    // Not having set up Slack is not an error.
    expect(err).not.toHaveBeenCalled();
  });

  it("stays quiet when at least one channel delivered", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/ok";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/bad";
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(reply(String(url).includes("bad") ? 500 : 200))
    );

    maybeNotifyHotLead("Brightwave", 91, 10);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    // One channel down is not worth a log line when the rep still got the ping.
    expect(err).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
