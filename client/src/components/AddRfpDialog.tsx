import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

/**
 * Add an RFP by hand.
 *
 * `rfps.create` existed and nothing called it, which made the whole page conditional on
 * a SAM.gov key: without one, scraping is the only way in, so the list stays empty
 * forever and the feature looks broken rather than unconfigured. Most RFPs a rep
 * actually chases arrive by email or a portal anyway, not from a federal feed.
 */
export function AddRfpDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    agency: "",
    solicitationNumber: "",
    responseDeadline: "",
    awardAmount: "",
    url: "",
    description: "",
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const create = trpc.rfps.create.useMutation({
    onSuccess: () => {
      toast.success("RFP added");
      setOpen(false);
      setForm({
        title: "",
        agency: "",
        solicitationNumber: "",
        responseDeadline: "",
        awardAmount: "",
        url: "",
        description: "",
      });
      onCreated?.();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Add RFP
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add an RFP</DialogTitle>
          <DialogDescription>
            For anything that didn&apos;t come from SAM.gov — an emailed solicitation, a
            portal listing, a referral.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={e => {
            e.preventDefault();
            if (!form.title.trim()) return;
            // Empty optional fields are omitted rather than sent as "", so a blank box
            // stores null instead of a string that later reads as a real value.
            const clean = Object.fromEntries(
              Object.entries(form).filter(([, v]) => v.trim() !== "")
            ) as { title: string } & Record<string, string>;
            create.mutate({ ...clean, title: form.title.trim(), status: "open" });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rfp-title">Title *</Label>
            <Input
              id="rfp-title"
              value={form.title}
              onChange={set("title")}
              placeholder="Identity and access management modernization"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rfp-agency">Agency / buyer</Label>
              <Input id="rfp-agency" value={form.agency} onChange={set("agency")} placeholder="Dept. of Transportation" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfp-sol">Solicitation number</Label>
              <Input id="rfp-sol" value={form.solicitationNumber} onChange={set("solicitationNumber")} placeholder="W912-26-R-0043" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfp-deadline">Response deadline</Label>
              <Input id="rfp-deadline" type="date" value={form.responseDeadline} onChange={set("responseDeadline")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rfp-amount">Award amount</Label>
              <Input id="rfp-amount" value={form.awardAmount} onChange={set("awardAmount")} placeholder="$2.4M" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfp-url">Link</Label>
            <Input id="rfp-url" type="url" value={form.url} onChange={set("url")} placeholder="https://…" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfp-desc">Description</Label>
            <Textarea
              id="rfp-desc"
              value={form.description}
              onChange={set("description")}
              rows={3}
              placeholder="Scope, incumbent, anything worth remembering."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.title.trim() || create.isPending}>
              {create.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add RFP"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
