import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Copy,
  Layers,
  Linkedin,
  Loader2,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

/**
 * SEQUENCE BUILDER
 *
 * A sequence is the shape a rep follows so the fifth touch isn't invented on the fifth
 * day. It holds no accounts and sends nothing — it is a template, and saying so plainly
 * is the difference between this and a campaign tool it isn't.
 *
 * The whole cadence is edited on one screen. A step-at-a-time wizard hides the thing you
 * are actually judging: whether the rhythm makes sense end to end.
 */

type StepType = "email" | "call" | "linkedin" | "wait";

type Step = {
  id: string;
  type: StepType;
  day: number;
  subject?: string;
  content?: string;
  notes?: string;
};

const STEP_META: Record<StepType, { icon: typeof Mail; label: string; cls: string }> = {
  email: { icon: Mail, label: "Email", cls: "text-accent" },
  call: { icon: Phone, label: "Call", cls: "text-positive" },
  linkedin: { icon: Linkedin, label: "LinkedIn", cls: "text-accent" },
  wait: { icon: Clock, label: "Wait", cls: "text-ink-muted" },
};

/** Ids only have to be unique within one unsaved edit, so a counter beats a uuid dep. */
let seq = 0;
const newId = () => `step-${Date.now()}-${seq++}`;

function dayLabel(day: number): string {
  if (day === 0) return "Day 0 · same day";
  if (day === 1) return "Day 1";
  return `Day ${day}`;
}

export default function Sequences() {
  const utils = trpc.useUtils();
  const { data: sequences, isLoading } = trpc.sequences.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  /** null = list view; otherwise the sequence being edited (id null = unsaved new one). */
  const [editing, setEditing] = useState<{
    id: number | null;
    name: string;
    description: string;
    steps: Step[];
  } | null>(null);

  const save = trpc.sequences.save.useMutation({
    onSuccess: () => {
      toast.success("Sequence saved");
      utils.sequences.list.invalidate();
      setEditing(null);
    },
    onError: e => toast.error(e.message),
  });

  const remove = trpc.sequences.delete.useMutation({
    onSuccess: () => {
      toast.success("Sequence deleted");
      utils.sequences.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const duplicate = trpc.sequences.duplicate.useMutation({
    onSuccess: () => {
      toast.success("Duplicated");
      utils.sequences.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  // Draft copy for a step. `tools.generateContent` needs no account, which is right for
  // a template — the personalisation happens when the sequence is actually used.
  const draft = trpc.tools.generateContent.useMutation();
  const [draftingId, setDraftingId] = useState<string | null>(null);

  const patchStep = (id: string, patch: Partial<Step>) =>
    setEditing(e =>
      e ? { ...e, steps: e.steps.map(s => (s.id === id ? { ...s, ...patch } : s)) } : e
    );

  const addStep = (type: StepType) =>
    setEditing(e => {
      if (!e) return e;
      const lastDay = e.steps.length ? Math.max(...e.steps.map(s => s.day)) : -3;
      return {
        ...e,
        steps: [...e.steps, { id: newId(), type, day: Math.max(0, lastDay + 3) }],
      };
    });

  const ordered = useMemo(
    () => (editing ? [...editing.steps].sort((a, b) => a.day - b.day) : []),
    [editing]
  );

  /* ------------------------------------------------------------------ list view */
  if (!editing) {
    return (
      <div className="container py-1 space-y-5 max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sequences</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Reusable cadences. A sequence is a template — it holds no accounts and sends
              nothing on its own.
            </p>
          </div>
          <Button
            onClick={() =>
              setEditing({ id: null, name: "", description: "", steps: [] })
            }
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New sequence
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !sequences?.length ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Layers}
                title="No sequences yet"
                description="Build a cadence once and reuse it. Most start as a copy of one that worked."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sequences.map(s => (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 py-4">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setEditing({
                        id: s.id,
                        name: s.name,
                        description: s.description ?? "",
                        steps: s.steps as Step[],
                      })
                    }
                  >
                    <div className="truncate text-sm font-medium hover:text-accent">
                      {s.name}
                    </div>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                        {s.description}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-2xs text-ink-muted">
                      <span className="tabular-nums">{s.summary.stepCount}</span>
                      <span>steps</span>
                      <span className="text-ink-faint">·</span>
                      <span className="tabular-nums">{s.summary.durationDays}</span>
                      <span>days</span>
                      {/* A step with no copy is work deferred, not work done. */}
                      {!!s.summary.incomplete && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span className="text-caution">
                            <span className="tabular-nums">{s.summary.incomplete}</span> without
                            copy
                          </span>
                        </>
                      )}
                    </div>
                  </button>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {(Object.keys(STEP_META) as StepType[])
                      .filter(t => s.summary.byType?.[t])
                      .map(t => {
                        const M = STEP_META[t];
                        return (
                          <Badge key={t} variant="secondary" size="sm">
                            <M.icon className="size-3" />
                            <span className="tabular-nums">{s.summary.byType[t]}</span>
                          </Badge>
                        );
                      })}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Duplicate ${s.name}`}
                      disabled={duplicate.isPending}
                      onClick={() => duplicate.mutate({ id: s.id })}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${s.name}`}
                      className="text-ink-muted hover:text-critical"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ id: s.id })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------------------------------------- editor view */
  const duration = ordered.length ? Math.max(...ordered.map(s => s.day)) : 0;

  return (
    <div className="container py-1 space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Back to sequences" onClick={() => setEditing(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {editing.id ? "Edit sequence" : "New sequence"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button
            disabled={!editing.name.trim() || !editing.steps.length || save.isPending}
            onClick={() =>
              save.mutate({
                id: editing.id ?? undefined,
                name: editing.name.trim(),
                description: editing.description.trim() || undefined,
                steps: editing.steps,
              })
            }
          >
            {save.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save sequence"
            )}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="space-y-2">
            <Label htmlFor="seq-name">Name *</Label>
            <Input
              id="seq-name"
              value={editing.name}
              onChange={e => setEditing(v => (v ? { ...v, name: e.target.value } : v))}
              placeholder="Post-webinar follow-up"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seq-desc">When to use it</Label>
            <Input
              id="seq-desc"
              value={editing.description}
              onChange={e => setEditing(v => (v ? { ...v, description: e.target.value } : v))}
              placeholder="Attended a webinar but didn't book time"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Layers className="size-4 text-accent" />
            Steps
            {!!ordered.length && (
              <span className="text-sm font-normal text-ink-muted">
                <span className="tabular-nums">{ordered.length}</span> over{" "}
                <span className="tabular-nums">{duration}</span> days
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Days count from the start of the sequence, not from the previous step.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 pt-4">
          {!ordered.length ? (
            <p className="rounded-sm border border-dashed border-border py-6 text-center text-sm text-ink-muted">
              No steps yet. Add the first touch below.
            </p>
          ) : (
            ordered.map((step, i) => {
              const M = STEP_META[step.type];
              return (
                <div
                  key={step.id}
                  className="rounded-sm border border-border-subtle bg-surface-raised p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-sm bg-muted",
                        M.cls
                      )}
                    >
                      <M.icon className="size-3.5" />
                    </span>
                    <span className="text-sm font-medium">{M.label}</span>
                    <span className="text-2xs text-ink-subtle">{dayLabel(step.day)}</span>

                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                      <Label htmlFor={`day-${step.id}`} className="text-2xs text-ink-muted">
                        Day
                      </Label>
                      <Input
                        id={`day-${step.id}`}
                        type="number"
                        min={0}
                        max={365}
                        value={step.day}
                        onChange={e =>
                          patchStep(step.id, { day: Math.max(0, Number(e.target.value) || 0) })
                        }
                        className="h-8 w-16 tabular-nums"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove step ${i + 1}`}
                        className="text-ink-muted hover:text-critical"
                        onClick={() =>
                          setEditing(e =>
                            e ? { ...e, steps: e.steps.filter(s => s.id !== step.id) } : e
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {step.type === "wait" ? (
                    <p className="mt-2 text-xs text-ink-muted">
                      Nothing happens on this day — it holds the gap before the next touch.
                    </p>
                  ) : (
                    <div className="mt-2.5 space-y-2">
                      {step.type === "email" && (
                        <Input
                          value={step.subject ?? ""}
                          onChange={e => patchStep(step.id, { subject: e.target.value })}
                          placeholder="Subject line"
                          aria-label={`Subject for step ${i + 1}`}
                          className="h-8"
                        />
                      )}
                      <Textarea
                        value={step.content ?? ""}
                        onChange={e => patchStep(step.id, { content: e.target.value })}
                        rows={4}
                        aria-label={`Content for step ${i + 1}`}
                        placeholder={
                          step.type === "call"
                            ? "What to open with, and the one question worth asking."
                            : step.type === "linkedin"
                              ? "Connection note or InMail."
                              : "Body copy. Leave the specifics to the send."
                        }
                        className="text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={draft.isPending}
                        onClick={async () => {
                          setDraftingId(step.id);
                          try {
                            const res = await draft.mutateAsync({
                              contentType: step.type === "call" ? "call_script" : step.type === "linkedin" ? "linkedin" : "email",
                              context: `Step ${i + 1} of the "${editing.name || "untitled"}" sequence, sent on day ${step.day}. ${editing.description || ""}`.trim(),
                              additionalNotes: step.subject || undefined,
                            });
                            // The server returns `available: false` (not a thrown error) when
                            // no model was reachable — `res.content` is the degradation note in
                            // that case, not real copy. AITools.tsx already guards this exact
                            // response shape (server/tools-router.ts generateContent); this
                            // button called the same endpoint and wrote the note into the step
                            // as if a rep had reviewed and approved it.
                            if (res.available === false) {
                              toast.error(res.content || "AI generation is unavailable right now.");
                              return;
                            }
                            patchStep(step.id, { content: res.content });
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Draft failed");
                          } finally {
                            setDraftingId(null);
                          }
                        }}
                      >
                        {draft.isPending && draftingId === step.id ? (
                          <>
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                            Drafting…
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1.5 size-3.5" />
                            {step.content ? "Redraft" : "Draft copy"}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
            <span className="self-center text-2xs text-ink-muted">Add</span>
            {(Object.keys(STEP_META) as StepType[]).map(t => {
              const M = STEP_META[t];
              return (
                <Button key={t} variant="outline" size="sm" onClick={() => addStep(t)}>
                  <M.icon className={cn("mr-1.5 size-3.5", M.cls)} />
                  {M.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
