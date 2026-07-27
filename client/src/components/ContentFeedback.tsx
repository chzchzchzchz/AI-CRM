import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Check, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

/**
 * The half of "the AI learns from you" that was missing.
 *
 * Data Hub advertises "The AI improves based on your corrections" and Content Studio
 * lists "Learns from your edits" among its capabilities. `tools.submitFeedback` and the
 * feedback recorder behind it were fully built — and nothing ever called them, so both
 * claims were false. Every generation was forgotten the moment it was rendered.
 *
 * Three signals, because they mean different things: good, bad, and "I kept it but
 * changed it" — the last being the most useful and the one a thumbs pair can't express.
 */
export function ContentFeedback({
  contentId,
  editedContent,
  originalContent,
  className,
}: {
  contentId?: number | null;
  /** Current text, so an edit can be submitted as the correction itself. */
  editedContent?: string;
  originalContent?: string;
  className?: string;
}) {
  const [sent, setSent] = useState<null | "positive" | "negative" | "edited">(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState("");

  const submit = trpc.tools.submitFeedback.useMutation({
    onSuccess: (_r, vars) => {
      setSent(vars.feedback);
      setShowDetail(false);
      setDetail("");
      toast.success("Noted — future drafts use this");
    },
    onError: e => toast.error(e.message),
  });

  // Without a contentId the server has nothing to attach feedback to. Rendering the
  // controls anyway would be the same class of lie this component exists to remove.
  if (!contentId) return null;

  const wasEdited =
    !!editedContent && !!originalContent && editedContent.trim() !== originalContent.trim();

  if (sent) {
    return (
      <p className={cn("flex items-center gap-1.5 text-2xs text-positive", className)}>
        <Check className="size-3" />
        Feedback recorded
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-2xs text-ink-muted">Was this useful?</span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Good draft"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ contentId, feedback: "positive" })}
        >
          <ThumbsUp className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Poor draft"
          disabled={submit.isPending}
          onClick={() => setShowDetail(true)}
        >
          <ThumbsDown className="size-3.5" />
        </Button>

        {/* Only offered once the text actually differs — otherwise it claims a
            correction that didn't happen. */}
        {wasEdited && (
          <Button
            size="sm"
            variant="ghost"
            disabled={submit.isPending}
            onClick={() =>
              submit.mutate({ contentId, feedback: "edited", editedContent })
            }
          >
            {submit.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : null}
            Save my edit as the better version
          </Button>
        )}
      </div>

      {showDetail && (
        <form
          className="space-y-2"
          onSubmit={e => {
            e.preventDefault();
            submit.mutate({
              contentId,
              feedback: "negative",
              details: detail.trim() || undefined,
            });
          }}
        >
          <Textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={2}
            placeholder="What was wrong with it? This is what the next draft is told to avoid."
            aria-label="What was wrong with this draft"
            className="text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={submit.isPending}>
              {submit.isPending ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : null}
              Send
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowDetail(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
