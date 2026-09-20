import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataUnavailable } from "@/components/ui/data-unavailable";
import { Loader2, Building2, Info } from "lucide-react";
import { toast } from "sonner";

/**
 * Who this workspace is, for the AI to write as.
 *
 * `COMPANY_NAME`, the differentiators and the competitor list used to be one set of values
 * for the whole deployment, and they ground every generated email, brief and call
 * analysis. So a second customer's outreach went out written as the OPERATOR's company,
 * pitching the operator's product against the operator's named competitors — to the
 * customer's own prospects. Their data was perfectly isolated; the sentence wrapped around
 * it was somebody else's.
 *
 * A workspace that has not filled this in gets neutral defaults rather than the
 * deployment's, so an empty field is visibly empty instead of quietly inherited.
 */
export function CompanyProfile() {
  const get = trpc.companyProfile.get.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  // Seed the form once, then leave it alone — refetching mid-edit would throw away
  // whatever the person had typed.
  useEffect(() => {
    if (get.data && !loaded) {
      const p: any = get.data.profile ?? {};
      const seeded: Record<string, string> = {};
      for (const f of get.data.fields) {
        const v = p[f.key];
        seeded[f.key] = Array.isArray(v) ? v.join(", ") : (v ?? "");
      }
      setValues(seeded);
      setLoaded(true);
    }
  }, [get.data, loaded]);

  const save = trpc.companyProfile.save.useMutation({
    onSuccess: () => {
      toast.success("Saved. New drafts will use this.");
      get.refetch();
    },
    onError: err => toast.error(err.message),
  });

  if (get.error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <DataUnavailable what="your company profile" detail={get.error} onRetry={() => get.refetch()} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Your company
        </CardTitle>
        <CardDescription>
          What the AI knows about you. Every generated email, account brief and call
          analysis is written from this.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {get.data && !get.data.inheritsDeployment ? (
          <div className="flex items-start gap-2 rounded-md border border-border/60 bg-muted p-3 text-xs text-ink-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              Anything left blank stays blank for this workspace — it does not fall back to
              whoever set up this deployment. That is deliberate: inheriting their company
              name would put it on your outreach.
            </p>
          </div>
        ) : null}

        {get.isLoading ? (
          <div className="py-6 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-accent" />
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              const payload: Record<string, unknown> = {};
              for (const f of get.data?.fields ?? []) {
                const raw = values[f.key] ?? "";
                payload[f.key] = f.list
                  ? raw.split(",").map(s => s.trim()).filter(Boolean)
                  : raw;
              }
              save.mutate(payload as any);
            }}
          >
            {(get.data?.fields ?? []).map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key} className="text-xs">
                  {f.label}
                </Label>
                {f.long ? (
                  <Textarea
                    id={f.key}
                    rows={2}
                    value={values[f.key] ?? ""}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    id={f.key}
                    value={values[f.key] ?? ""}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
                <p className="text-2xs text-ink-muted">{f.hint}</p>
              </div>
            ))}

            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
