import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Linkedin,
  Loader2,
  Mail,
  Phone,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";

/**
 * Act on a follow-up without leaving the page it appeared on.
 *
 * A due task whose only affordance is a link to the contact record is a task that costs
 * you your place in the list. Ten of those is a morning spent navigating. Everything
 * needed to actually do the thing — who they are, how to reach them, and a draft to
 * send — is resolved server-side with the follow-up and rendered here.
 *
 * The draft goes through `outreach.generateEmail`, the same generator the Outreach page
 * uses. A second email brain that drifted from the first is exactly the problem this
 * codebase has been unpicking.
 */

type FollowUpItem = {
  id: number;
  title: string;
  notes: string | null;
  dueDate: string;
  daysUntilDue: number;
  overdue: boolean;
  account: { id: number; name: string; domain: string | null; industry: string | null } | null;
  contact: {
    id: number;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    linkedinUrl: string | null;
  } | null;
};

export function dueLabel(days: number): string {
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days < 7) return `Due in ${days} days`;
  if (days < 30) return `Due in ${Math.round(days / 7)} weeks`;
  return `Due in ${Math.round(days / 30)} months`;
}

/** A value with a one-click copy. Reaching someone means getting the string out. */
function CopyRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2.5 rounded-sm border border-border-subtle bg-surface-raised px-3 py-2">
      <Icon className="size-3.5 shrink-0 text-ink-subtle" />
      <div className="min-w-0 flex-1">
        <div className="text-2xs text-ink-muted">{label}</div>
        <div className="truncate text-sm text-foreground">{value}</div>
      </div>
      {href && (
        <Button variant="ghost" size="icon-sm" asChild aria-label={`Open ${label}`}>
          <a href={href} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-3.5 text-positive" /> : <Copy className="size-3.5" />}
      </Button>
    </div>
  );
}

export function FollowUpDialog({
  followUp,
  open,
  onOpenChange,
  onChanged,
}: {
  followUp: FollowUpItem | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const complete = trpc.followUps.complete.useMutation({
    onSuccess: () => {
      toast.success("Marked done");
      onOpenChange(false);
      onChanged?.();
    },
    onError: e => toast.error(e.message),
  });

  const snooze = trpc.followUps.snooze.useMutation({
    onSuccess: () => {
      toast.success("Snoozed");
      onOpenChange(false);
      onChanged?.();
    },
    onError: e => toast.error(e.message),
  });

  // generateEmail returns { content } and deliberately writes no subject line or
  // signature — the follow-up's own title is the subject when opening a mail client.
  const generate = trpc.outreach.generateEmail.useMutation({
    onSuccess: res => setDraft(res.content),
    onError: e => toast.error(e.message),
  });

  if (!followUp) return null;
  const { account, contact } = followUp;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-start gap-2 pr-6">
            <span className="min-w-0">{followUp.title}</span>
            <Badge variant={followUp.overdue ? "critical" : "secondary"} size="sm">
              {followUp.overdue ? (
                <AlertTriangle className="size-3" />
              ) : (
                <Clock className="size-3" />
              )}
              {dueLabel(followUp.daysUntilDue)}
            </Badge>
          </DialogTitle>
          {account && (
            <DialogDescription className="flex flex-wrap items-center gap-1.5">
              <Building2 className="size-3.5" />
              {/* A link is offered, never required — the point of this panel is that you
                  don't have to take it. */}
              <Link href={`/accounts/${account.id}`} className="text-accent hover:underline">
                {account.name}
              </Link>
              {account.industry && <span className="text-ink-subtle">· {account.industry}</span>}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {followUp.notes && (
            <div className="rounded-sm border border-border-subtle bg-muted p-3">
              <div className="text-2xs font-medium uppercase tracking-wide text-ink-muted">
                Your note
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{followUp.notes}</p>
            </div>
          )}

          {/* Contact info — the first thing you need and the most common reason to
              navigate away. */}
          {contact ? (
            <section>
              <h3 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                Reach {contact.name}
              </h3>
              <div className="space-y-1.5">
                <div className="px-1 text-xs text-ink-muted">{contact.title || "No title on file"}</div>
                {contact.email && (
                  <CopyRow
                    icon={Mail}
                    label="Email"
                    value={contact.email}
                    href={`mailto:${contact.email}`}
                  />
                )}
                {contact.phone && <CopyRow icon={Phone} label="Phone" value={contact.phone} href={`tel:${contact.phone}`} />}
                {contact.linkedinUrl && (
                  <CopyRow
                    icon={Linkedin}
                    label="LinkedIn"
                    value={contact.linkedinUrl}
                    href={contact.linkedinUrl}
                  />
                )}
                {!contact.email && !contact.phone && !contact.linkedinUrl && (
                  <p className="px-1 text-xs text-ink-muted">
                    No contact details on file. Nothing here is inferred.
                  </p>
                )}
              </div>
            </section>
          ) : (
            <p className="text-xs text-ink-muted">
              No contact attached to this follow-up.
            </p>
          )}

          {/* Draft — generated on demand, editable, copyable. Never sent from here. */}
          {account && (
            <section>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                  Email draft
                </h3>
                <Button
                  size="sm"
                  variant={draft ? "ghost" : "outline"}
                  disabled={generate.isPending}
                  onClick={() =>
                    generate.mutate({
                      accountIds: [account.id],
                      contactIds: contact ? [contact.id] : undefined,
                      // The rep's own note is the brief. It is the only thing here that
                      // says why this follow-up exists.
                      prompt: followUp.notes
                        ? `${followUp.title}. Context from the rep: ${followUp.notes}`
                        : followUp.title,
                    })
                  }
                >
                  {generate.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      Drafting…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 size-3.5" />
                      {draft ? "Redraft" : "Draft email"}
                    </>
                  )}
                </Button>
              </div>

              {draft ? (
                <>
                  <Textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    rows={10}
                    className="text-sm"
                    aria-label="Email draft"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(draft);
                        toast.success("Draft copied");
                      }}
                    >
                      <Copy className="mr-1.5 size-3.5" />
                      Copy
                    </Button>
                    {contact?.email && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={`mailto:${contact.email}?subject=${encodeURIComponent(
                            followUp.title
                          )}&body=${encodeURIComponent(draft)}`}
                        >
                          <Mail className="mr-1.5 size-3.5" />
                          Open in mail
                        </a>
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-sm border border-dashed border-border px-3 py-4 text-center text-xs text-ink-muted">
                  Generated from this account&apos;s real signals and your note.
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "1 week", days: 7 },
              { label: "1 month", days: 30 },
              { label: "3 months", days: 90 },
            ].map(o => (
              <Button
                key={o.days}
                size="sm"
                variant="ghost"
                disabled={snooze.isPending}
                onClick={() => snooze.mutate({ id: followUp.id, days: o.days })}
              >
                {o.label}
              </Button>
            ))}
            <span className="self-center text-2xs text-ink-subtle">snooze</span>
          </div>

          <Button
            size="sm"
            disabled={complete.isPending}
            onClick={() => complete.mutate({ id: followUp.id })}
            className={cn(complete.isPending && "opacity-70")}
          >
            {complete.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 size-3.5" />
            )}
            Mark done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
