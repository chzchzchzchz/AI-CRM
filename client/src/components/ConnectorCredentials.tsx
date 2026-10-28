import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { Loader2, Plug, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

/**
 * Connecting your own Salesforce, Gong or Slack to THIS workspace.
 *
 * Every connector in this app reads the deployment's environment — one SALESFORCE_*, one
 * GONG_*, one TWILIO_* shared by every workspace on the instance. That made a sync mean
 * "copy whatever the operator connected into whichever workspace asked", so the only safe
 * answer for anyone but the deployment's own organization was to refuse. Which is correct,
 * and leaves a paying customer looking at a row of buttons that say no.
 *
 * Storing your own credentials lifts that refusal for your workspace and nobody else's.
 *
 * The value is shown once — by you, as you type it — and never again. Only the last four
 * characters come back, which is enough to answer the one question anyone actually has
 * ("is the right account in there?") and not enough to leak in a screenshot or a support
 * ticket.
 */
export function ConnectorCredentials() {
  const [provider, setProvider] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const list = trpc.connectorCredentials.list.useQuery();
  const fields = trpc.connectorCredentials.fields.useQuery(
    { provider },
    { enabled: provider.length > 0 }
  );

  const save = trpc.connectorCredentials.save.useMutation({
    onSuccess: res => {
      toast.success(`Connected. Saved credential ending ${res.hint}.`);
      setProvider("");
      setValues({});
      list.refetch();
    },
    onError: err => toast.error(err.message),
  });

  const revoke = trpc.connectorCredentials.revoke.useMutation({
    onSuccess: () => {
      toast.success("Disconnected.");
      list.refetch();
    },
    onError: err => toast.error(err.message),
  });

  const connected = list.data?.connectors ?? [];
  const available = list.data?.available ?? [];
  const nameOf = (key: string) => available.find(a => a.key === key)?.name ?? key;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plug className="h-4 w-4" />
          Your connections
        </CardTitle>
        <CardDescription>
          Connect your own accounts to this workspace. Without one, a connector belongs to
          whoever set up this deployment and can't be used here — the data would be theirs,
          not yours.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {list.data && !list.data.canStore ? (
          /* Said before anyone types a secret, not after the save fails. */
          <div className="flex items-start gap-2 rounded-md border border-caution/40 bg-caution-subtle p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-caution" />
            <div>
              <p className="font-medium">Credentials can't be stored yet.</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                This deployment has no <code>CREDENTIALS_KEY</code>, so there is nowhere to
                encrypt a secret to. Ask your administrator to generate one
                (<code>openssl rand -base64 32</code>) and set it. Nothing here will save a
                credential in the clear.
              </p>
            </div>
          </div>
        ) : null}

        {list.error ? (
          <DataUnavailable what="connections" detail={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-accent" />
          </div>
        ) : !connected.length ? (
          <p className="py-2 text-sm text-ink-muted">Nothing connected to this workspace yet.</p>
        ) : (
          <ul className="divide-y divide-border/50 rounded-md border border-border/60">
            {connected.map((c: any) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{nameOf(c.provider)}</p>
                  <p className="text-xs text-ink-muted">
                    Saved credential ending <span className="tabular-nums">{c.hint}</span>
                  </p>
                </div>
                <Badge variant="outline" className="text-positive">
                  connected
                </Badge>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Disconnect ${nameOf(c.provider)}`}
                  onClick={() => revoke.mutate({ provider: c.provider })}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {list.data?.canStore ? (
          <div className="space-y-3 rounded-md border border-border/60 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="connector">Connect a tool</Label>
              <select
                id="connector"
                value={provider}
                onChange={e => {
                  setProvider(e.target.value);
                  setValues({});
                }}
                className="h-9 w-full rounded-md border border-border/60 bg-card px-2 text-sm"
              >
                <option value="">Choose…</option>
                {available.map(a => (
                  <option key={a.key} value={a.key}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {provider && fields.data ? (
              <form
                className="space-y-3"
                onSubmit={e => {
                  e.preventDefault();
                  save.mutate({ provider, values });
                }}
              >
                {fields.data.map(f => (
                  <div key={f.name} className="space-y-1.5">
                    <Label htmlFor={f.name} className="text-xs">
                      {f.name}
                      {f.required ? <span className="ml-1 text-critical">*</span> : null}
                    </Label>
                    <Input
                      id={f.name}
                      // A secret field is a password field. The value is never read back
                      // from the server, so this is the only place it is ever visible.
                      type={f.secret ? "password" : "text"}
                      autoComplete="off"
                      value={values[f.name] ?? ""}
                      onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                      required={f.required}
                    />
                    <p className="text-2xs text-ink-muted">{f.hint}</p>
                  </div>
                ))}

                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Connect {nameOf(provider)}
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
