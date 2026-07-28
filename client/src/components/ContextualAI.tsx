import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Sparkles, Send, Loader2, X, ChevronDown, ChevronUp, Paperclip, FileText, File } from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ContextualAIProps {
  context: "accounts" | "contacts" | "home" | "calls" | "insights" | "account-detail" | "contact-detail";
  accountId?: number;
  contactId?: number;
  placeholder?: string;
}

interface AIResponse {
  answer: string;
  reasoning?: string;
  cached?: boolean;
  cacheHitCount?: number;
}

const contextSuggestions: Record<string, string[]> = {
  accounts: [
    "Which accounts have the highest intent this week?",
    "Show me accounts with strong buying signals",
    "Find accounts that need immediate follow-up",
  ],
  contacts: [
    "Who are the key decision makers I should reach out to?",
    "Find contacts with recent engagement",
    "Which contacts haven't been contacted in 30 days?",
  ],
  home: [
    "What should I prioritize today?",
    "Show me my top opportunities",
    "Generate a daily action plan",
  ],
  calls: [
    "Summarize recent call themes",
    "Which accounts have had the most calls?",
    "Find calls mentioning security concerns",
  ],
  insights: [
    "What are the trending intent keywords?",
    "Show me buying stage distribution",
    "Which industries are most active?",
  ],
  "account-detail": [
    "Generate an executive briefing for this account",
    "What's the best outreach strategy?",
    "Who should I contact first?",
  ],
  "contact-detail": [
    "Generate a personalized email for this contact",
    "What's this contact's engagement history?",
    "Suggest talking points for a call",
  ],
};

export function ContextualAI({ context, accountId, contactId, placeholder }: ContextualAIProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showReasoning, setShowReasoning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use Deep-Think endpoint for 2-layer AI architecture
  const deepThinkMutation = trpc.deepThink.sales.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ['pdf', 'docx', 'pptx', 'txt', 'md', 'csv'].includes(ext || '');
    });
    if (validFiles.length < files.length) {
      toast.error("Some files were skipped. Supported: PDF, DOCX, PPTX, TXT, MD, CSV");
    }
    setAttachedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="h-3 w-3" />;
    return <File className="h-3 w-3" />;
  };

  const handleAsk = async (question?: string) => {
    const q = question || query;
    if (!q.trim() || isLoading) return;

    setIsLoading(true);
    setResponse(null);
    setShowReasoning(false);

    try {
      // Read file contents if attached
      let fileContext = "";
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          const text = await file.text();
          fileContext += `\n\n--- ${file.name} ---\n${text.slice(0, 10000)}`; // Limit to 10k chars per file
        }
      }

      // Build additional context based on page context
      let additionalContext = `Page context: ${context}`;
      if (fileContext) {
        additionalContext += `\n\nAttached files:${fileContext}`;
      }

      // Use Deep-Think 2-layer architecture
      const result = await deepThinkMutation.mutateAsync({
        query: q,
        accountData: accountId ? { id: accountId } : undefined,
        contactData: contactId ? { id: contactId } : undefined,
        additionalContext,
        debugMode: true // Always capture reasoning for optional viewing
      });

      setResponse({
        answer: result.answer || "I couldn't find relevant information.",
        reasoning: result.reasoning,
        cached: result.cached,
        cacheHitCount: result.cacheHitCount
      });
    } catch (error) {
      setResponse({
        answer: "Sorry, I encountered an error. Please try again."
      });
    } finally {
      setIsLoading(false);
      setQuery("");
      setAttachedFiles([]);
    }
  };

  const suggestions = contextSuggestions[context] || contextSuggestions.home;

  return (
    <Card variant="sunken" className="mb-5">
      <CardContent className="p-2">
        <div className="flex items-center gap-1.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.docx,.pptx,.txt,.md,.csv"
            multiple
            className="hidden"
          />
          <Sparkles className="ml-1.5 size-4 shrink-0 text-ink-faint" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleAsk()}
            placeholder={placeholder || "Ask about this page…"}
            className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 hover:border-0"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => fileInputRef.current?.click()}
            title="Attach files (PDF, DOCX, PPTX, TXT, MD, CSV)"
          >
            <Paperclip className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Hide suggestions" : "Show suggestions"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          <Button
            size="sm"
            onClick={() => handleAsk()}
            disabled={isLoading || !query.trim()}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            <span className="sr-only">Ask</span>
          </Button>
        </div>

        {/* Attached Files */}
        {attachedFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 px-1.5">
            {attachedFiles.map((file, i) => (
              <Badge key={i} variant="secondary" className="gap-1">
                {getFileIcon(file.name)}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 hover:text-critical"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {isExpanded && !response && (
          <div className="mt-2 flex flex-wrap gap-1.5 px-1.5 pb-1">
            {suggestions.map((s, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(s);
                  handleAsk(s);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="mt-4 p-4 bg-card rounded-sm border border-accent/30">
            {/* Cache indicator */}
            {response.cached && (
              <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-accent/30">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-positive-subtle text-positive text-2xs font-medium">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Instant response (cached)
                </span>
                {response.cacheHitCount && response.cacheHitCount > 1 && (
                  <span className="text-2xs text-ink-subtle">• Served {response.cacheHitCount} times</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="prose prose-sm dark:prose-invert max-w-none flex-1">
                <SafeStreamdown>{response.answer}</SafeStreamdown>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResponse(null)}
                className="text-ink-muted hover:text-foreground flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Optional Reasoning Dropdown */}
            {response.reasoning && (
              <div className="mt-3 pt-3 border-t border-accent/30">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex flex-wrap items-center gap-1 text-2xs text-accent/60 hover:text-accent transition-colors"
                >
                  {showReasoning ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{showReasoning ? "Hide" : "View"} reasoning</span>
                </button>
                {showReasoning && (
                  <div className="mt-2 bg-muted border border-border-strong rounded-sm overflow-hidden">
                    <div className="px-2 py-1 bg-muted text-2xs text-ink-muted border-b border-border-strong">
                      AI Reasoning
                    </div>
                    <div className="p-2 text-2xs text-ink-muted overflow-x-auto max-h-48 font-mono whitespace-pre-wrap break-all">
                      <code>{response.reasoning}</code>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
