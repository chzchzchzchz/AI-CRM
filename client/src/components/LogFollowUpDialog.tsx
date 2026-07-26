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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";

/**
 * Log a commitment from wherever you made it.
 *
 * The moment a rep decides "call the CISO in six months" is the moment they are looking
 * at the account — not later, in a separate planner. Capture has to be one click from
 * here or it doesn't happen, and a commitment that isn't captured isn't kept.
 */

/** Common horizons, so the usual case is one click rather than a date picker. */
const PRESETS = [
  { label: "Tomorrow", days: 1 },
  { label: "In 1 week", days: 7 },
  { label: "In 2 weeks", days: 14 },
  { label: "In 1 month", days: 30 },
  { label: "In 3 months", days: 90 },
  { label: "In 6 months", days: 182 },
  { label: "In 1 year", days: 365 },
];

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  // Local date, not toISOString() — that converts to UTC and can land a "tomorrow"
  // on today for anyone west of Greenwich.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function LogFollowUpDialog({
  accountId,
  contactId,
  accountName,
  contacts,
  variant = "outline",
  size = "sm",
}: {
  accountId?: number;
  contactId?: number;
  accountName?: string;
  /** Offered when logging from an account, so the follow-up can name a person. */
  contacts?: Array<{ id: number; name: string; title?: string | null }>;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState(isoDaysFromNow(7));
  const [person, setPerson] = useState<string>(contactId ? String(contactId) : "none");

  const create = trpc.followUps.create.useMutation({
    onSuccess: () => {
      toast.success("Follow-up logged");
      setOpen(false);
      setTitle("");
      setNotes("");
      setDueDate(isoDaysFromNow(7));
      utils.followUps.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <CalendarPlus className="mr-1.5 h-4 w-4" />
          Follow up
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log a follow-up</DialogTitle>
          <DialogDescription>
            {accountName
              ? `It'll appear on your dashboard when it's due, with ${accountName}'s details attached.`
              : "It'll appear on your dashboard when it's due."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={e => {
            e.preventDefault();
            if (!title.trim()) return;
            create.mutate({
              title: title.trim(),
              dueDate,
              notes: notes.trim() || undefined,
              accountId,
              contactId: person !== "none" ? Number(person) : undefined,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="fu-title">What needs doing *</Label>
            <Input
              id="fu-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Call the CISO about the renewal"
              required
            />
          </div>

          {!!contacts?.length && (
            <div className="space-y-2">
              <Label htmlFor="fu-contact">Who</Label>
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger id="fu-contact" aria-label="Contact for this follow-up">
                  <SelectValue placeholder="No one in particular" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No one in particular</SelectItem>
                  {contacts.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.title ? ` — ${c.title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fu-date">When</Label>
            <Input
              id="fu-date"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {PRESETS.map(p => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDueDate(isoDaysFromNow(p.days))}
                  aria-pressed={dueDate === isoDaysFromNow(p.days)}
                  className={
                    dueDate === isoDaysFromNow(p.days)
                      ? "rounded-sm border border-accent/30 bg-accent-subtle px-2 py-0.5 text-2xs font-medium text-accent"
                      : "rounded-sm border border-border px-2 py-0.5 text-2xs text-ink-muted transition-colors hover:bg-muted"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fu-notes">Why (optional)</Label>
            <Textarea
              id="fu-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Renewal lands in Q3; they wanted to revisit after the audit."
            />
            <p className="text-2xs text-ink-subtle">
              This becomes the brief for the email draft when the follow-up comes due.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Log follow-up"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
