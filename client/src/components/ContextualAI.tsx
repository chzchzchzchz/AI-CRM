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

const contextSuggestions: Record<string, string[]> = {
  accounts: [
    "Which accounts have the highest intent this week?",
    "Show me accounts with MFA buying signals",
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
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatMutation = trpc.ai.chat.useMutation();

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

    try {
      // Read file contents if attached
      let fileContext = "";
      if (attachedFiles.length > 0) {
        for (const file of attachedFiles) {
          const text = await file.text();
          fileContext += `\n\n--- ${file.name} ---\n${text.slice(0, 10000)}`; // Limit to 10k chars per file
        }
      }

      const result = await chatMutation.mutateAsync({
        query: fileContext ? `${q}\n\nAttached files context:${fileContext}` : q,
        accountId,
        contactId,
      });
      setResponse(result.answer || "I couldn't find relevant information.");
    } catch (error) {
      setResponse("Sorry, I encountered an error. Please try again.");
    } finally {
      setIsLoading(false);
      setQuery("");
      setAttachedFiles([]);
    }
  };

  const suggestions = contextSuggestions[context] || contextSuggestions.home;

  return (
    <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/30 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".pdf,.docx,.pptx,.txt,.md,.csv"
                multiple
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="text-purple-400 hover:text-purple-300"
                title="Attach files (PDF, DOCX, PPTX)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAsk()}
                placeholder={placeholder || "Ask AI anything about this page..."}
                className="bg-slate-900/50 border-purple-500/30 focus:border-purple-500"
              />
              <Button
                onClick={() => handleAsk()}
                disabled={isLoading || !query.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-purple-400"
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {/* Attached Files */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachedFiles.map((file, i) => (
                  <Badge key={i} variant="secondary" className="flex items-center gap-1 bg-purple-900/50">
                    {getFileIcon(file.name)}
                    <span className="max-w-[100px] truncate text-xs">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="ml-1 hover:text-red-400">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Suggestions */}
        {isExpanded && !response && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery(s);
                  handleAsk(s);
                }}
                className="text-xs border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
              >
                {s}
              </Button>
            ))}
          </div>
        )}

        {/* Response */}
        {response && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-purple-500/20">
            <div className="flex items-start justify-between gap-2">
              <div className="prose prose-sm dark:prose-invert max-w-none flex-1">
                <SafeStreamdown>{response}</SafeStreamdown>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResponse(null)}
                className="text-slate-400 hover:text-white flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
