import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plug, CheckCircle2, Circle, Send } from "lucide-react";

type StatusKey =
  | "slack" | "discord" | "teams" | "googleChat" | "hubspot" | "notion"
  | "linear" | "intercom" | "airtable" | "pipedrive" | "apollo"
  | "twilio" | "segment" | "salesloft" | "outreach" | "calendly"
  | "asana" | "clickup" | "pagerduty";

const CONNECTORS: { key: StatusKey; name: string; blurb: string; env: string; webhook?: boolean }[] = [
  { key: "slack", name: "Slack", blurb: "Post hot-lead alerts to a channel", env: "SLACK_WEBHOOK_URL", webhook: true },
  { key: "discord", name: "Discord", blurb: "Post alerts to a channel webhook", env: "DISCORD_WEBHOOK_URL", webhook: true },
  { key: "teams", name: "Microsoft Teams", blurb: "Post a MessageCard to a channel", env: "TEAMS_WEBHOOK_URL", webhook: true },
  { key: "googleChat", name: "Google Chat", blurb: "Post to a space webhook", env: "GOOGLE_CHAT_WEBHOOK_URL", webhook: true },
  { key: "hubspot", name: "HubSpot", blurb: "Create/update contacts (CRM v3)", env: "HUBSPOT_ACCESS_TOKEN" },
  { key: "notion", name: "Notion", blurb: "Export accounts into a database", env: "NOTION_TOKEN + NOTION_DATABASE_ID" },
  { key: "linear", name: "Linear", blurb: "Create follow-up issues", env: "LINEAR_API_KEY + LINEAR_TEAM_ID" },
  { key: "intercom", name: "Intercom", blurb: "Sync leads", env: "INTERCOM_ACCESS_TOKEN" },
  { key: "airtable", name: "Airtable", blurb: "Create records in a base", env: "AIRTABLE_TOKEN + BASE + TABLE" },
  { key: "pipedrive", name: "Pipedrive", blurb: "Create deals", env: "PIPEDRIVE_API_TOKEN + DOMAIN" },
  { key: "apollo", name: "Apollo.io", blurb: "Enrich people by email", env: "APOLLO_API_KEY" },
  { key: "twilio", name: "Twilio", blurb: "Send SMS alerts", env: "TWILIO_ACCOUNT_SID + AUTH_TOKEN + FROM" },
  { key: "segment", name: "Segment", blurb: "Track analytics events", env: "SEGMENT_WRITE_KEY" },
  { key: "salesloft", name: "Salesloft", blurb: "Create people (engagement)", env: "SALESLOFT_API_KEY" },
  { key: "outreach", name: "Outreach", blurb: "Create prospects", env: "OUTREACH_ACCESS_TOKEN" },
  { key: "calendly", name: "Calendly", blurb: "Connect scheduling account", env: "CALENDLY_API_KEY" },
  { key: "asana", name: "Asana", blurb: "Create follow-up tasks", env: "ASANA_ACCESS_TOKEN + WORKSPACE_ID" },
  { key: "clickup", name: "ClickUp", blurb: "Create tasks in a list", env: "CLICKUP_API_TOKEN + LIST_ID" },
  { key: "pagerduty", name: "PagerDuty", blurb: "Trigger alerts", env: "PAGERDUTY_ROUTING_KEY" },
];

export default function Integrations() {
  const { data: status, isLoading } = trpc.integrations.status.useQuery();
  const slack = trpc.integrations.slackNotify.useMutation();
  const discord = trpc.integrations.discordNotify.useMutation();
  const teams = trpc.integrations.teamsNotify.useMutation();
  const [urls, setUrls] = useState<Record<string, string>>({});

  const testWebhook = async (key: StatusKey) => {
    const url = urls[key]?.trim();
    if (!url) { toast.error("Paste a webhook URL to test"); return; }
    const text = "✅ TargetDash test — your integration works!";
    try {
      const res =
        key === "slack" ? await slack.mutateAsync({ text, webhookUrl: url })
        : key === "discord" ? await discord.mutateAsync({ content: text, webhookUrl: url })
        : await teams.mutateAsync({ text, webhookUrl: url });
      if ((res as any).ok) toast.success(`${key}: delivered (HTTP ${(res as any).status})`);
      else toast.error(`${key}: ${(res as any).error || "failed"}`);
    } catch (e: any) { toast.error(e?.message || "request failed"); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container py-6 space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600">
            <Plug className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Native connectors to your stack. Add each tool's key in <code>.env</code> (see INTEGRATIONS.md); webhook
              tools can be tested right here.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CONNECTORS.map((c) => {
            const configured = !!status?.[c.key];
            return (
              <Card key={c.key} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Badge variant={configured ? "default" : "outline"} className="gap-1">
                      {configured ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
                      {isLoading ? "…" : configured ? "Connected" : "Not configured"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.blurb}</p>
                </CardHeader>
                <CardContent className="mt-auto space-y-2">
                  <p className="text-[11px] text-muted-foreground font-mono">{c.env}</p>
                  {c.webhook ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Paste webhook URL to test…"
                        value={urls[c.key] || ""}
                        onChange={(e) => setUrls((u) => ({ ...u, [c.key]: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <Button size="sm" className="h-8" onClick={() => testWebhook(c.key)}>
                        <Send className="h-3 w-3 mr-1" /> Test
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Add the key above, then use it from the API.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
