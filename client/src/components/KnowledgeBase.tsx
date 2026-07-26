import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileText, Loader2, Search, Trash2, Upload, X } from "lucide-react";

/** Text formats the indexer can actually read. */
const ACCEPTED = ["txt", "md", "csv", "json", "html"];

/**
 * The other half of the knowledge base.
 *
 * Documents could be uploaded from two screens and seen from none: `getDocuments`,
 * `deleteDocument` and `searchKnowledge` were all built and none was reachable. You
 * could put a document in and never find out whether it landed, what else was in
 * there, or how to remove something out of date — which is the failure that matters,
 * because a stale battle card doesn't sit quietly, it feeds every generated email.
 */

const CATEGORY_LABEL: Record<string, string> = {
  battle_card: "Battle card",
  case_study: "Case study",
  product_sheet: "Product sheet",
  competitor_intel: "Competitor intel",
  playbook: "Playbook",
  general: "General",
};

function formatBytes(n: number | null | undefined): string {
  if (!n || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(v: unknown): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function KnowledgeBase() {
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  // Only search once asked. Firing per keystroke would run a retrieval pass over the
  // whole corpus on every character.
  const [submitted, setSubmitted] = useState("");

  const docs = trpc.tools.getDocuments.useQuery(undefined, { refetchOnWindowFocus: false });

  const results = trpc.tools.searchKnowledge.useQuery(
    { query: submitted, topK: 5 },
    { enabled: submitted.trim().length > 0, refetchOnWindowFocus: false }
  );

  const remove = trpc.tools.deleteDocument.useMutation({
    onSuccess: () => {
      toast.success("Removed from the knowledge base");
      utils.tools.getDocuments.invalidate();
      if (submitted) utils.tools.searchKnowledge.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  // Upload lives here rather than in a separate card, so adding a document and seeing
  // it land are the same place. They were two screens apart, which is how uploads went
  // unverified for so long.
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = trpc.tools.uploadDocument.useMutation({
    onSuccess: (_r, vars) => {
      toast.success(`Added "${vars.fileName}"`);
      utils.tools.getDocuments.invalidate();
    },
    onError: e => toast.error(e.message || "Upload failed"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED.includes(ext)) {
      toast.error(`Text documents only (${ACCEPTED.map(x => `.${x}`).join(", ")}).`);
      return;
    }
    upload.mutate({
      fileName: file.name,
      content: await file.text(),
      mimeType: file.type || "text/plain",
      category: "general",
    });
  };

  const list = (docs.data ?? []) as Array<Record<string, any>>;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FileText className="size-4 text-accent" />
          Knowledge base
          {!docs.isLoading && (
            <span data-numeric className="tabular-nums text-sm font-normal text-ink-muted">
              {list.length}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          What the AI reads before it writes. Anything in here is grounding for generated
          content — so what's out of date is worth removing, not just ignoring.
        </CardDescription>

        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={e => {
            e.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          {/* min-w-40, not min-w-0: in a narrow sidebar this component shares a row with
              two buttons, and a shrink-to-zero input collapses to just its icon. A floor
              forces the row to wrap instead. */}
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search what the AI knows…"
              aria-label="Search the knowledge base"
              className="h-9 pl-8"
            />
          </div>
          <Button type="submit" size="sm" disabled={!query.trim() || results.isFetching}>
            {results.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : "Search"}
          </Button>
          {submitted && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setSubmitted("");
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.map(x => `.${x}`).join(",")}
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={upload.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 size-3.5" />
            )}
            Add document
          </Button>
        </form>
      </CardHeader>

      <CardContent className="p-0">
        {/* Search results replace the list while a query is active, so it's always clear
            which of the two you're looking at. */}
        {submitted ? (
          results.isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !results.data?.length ? (
            <EmptyState
              icon={Search}
              title="No matches"
              description={`Nothing in the knowledge base matches "${submitted}".`}
              compact
            />
          ) : (
            <ul className="divide-y divide-border-subtle">
              {(results.data as Array<Record<string, any>>).map((r, i) => (
                <li key={i} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {r.fileName || r.documentName || "Untitled"}
                    </span>
                    {typeof r.score === "number" && (
                      <Badge variant="secondary" size="sm">
                        <span className="tabular-nums">{Math.round(r.score * 100)}%</span> match
                      </Badge>
                    )}
                  </div>
                  {r.content && (
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-ink-muted">
                      {String(r.content).slice(0, 400)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : docs.isLoading ? (
          <div className="space-y-2 p-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : docs.isError ? (
          <EmptyState icon={FileText} title="Couldn't load documents" description={docs.error.message} compact />
        ) : !list.length ? (
          <EmptyState
            icon={FileText}
            title="Nothing uploaded yet"
            description="Add battle cards, case studies or playbooks above and the AI will use them as grounding."
            compact
          />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map(doc => (
              <li key={doc.id} className="flex items-center gap-3 px-5 py-3">
                <FileText className="size-4 shrink-0 text-ink-subtle" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{doc.fileName || "Untitled"}</div>
                  <div className="flex flex-wrap items-center gap-x-1.5 text-2xs text-ink-muted">
                    {doc.category && <span>{CATEGORY_LABEL[doc.category] ?? doc.category}</span>}
                    {doc.category && <span className="text-ink-faint">·</span>}
                    <span className="tabular-nums">{formatBytes(doc.fileSize ?? doc.size)}</span>
                    {formatDate(doc.createdAt) && (
                      <>
                        <span className="text-ink-faint">·</span>
                        <span>{formatDate(doc.createdAt)}</span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${doc.fileName || "document"} from the knowledge base`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ documentId: Number(doc.id) })}
                  className={cn("shrink-0 text-ink-muted hover:text-critical")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
