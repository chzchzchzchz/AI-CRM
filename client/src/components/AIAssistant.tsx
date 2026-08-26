import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Bot, Send, X, Minimize2, Maximize2, Loader2, Sparkles } from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  unavailable?: boolean;
}

interface AIAssistantProps {
  context?: {
    type: "account" | "contact" | "call" | "general";
    id?: number;
    name?: string;
  };
}

export function AIAssistant({ context }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const chatMutation = trpc.ai.chat.useMutation();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context-aware query
      let contextualQuery = userMessage;
      if (context) {
        if (context.type === "account" && context.name) {
          contextualQuery = `Regarding account ${context.name}: ${userMessage}`;
        } else if (context.type === "contact" && context.name) {
          contextualQuery = `Regarding contact ${context.name}: ${userMessage}`;
        }
      }

      const result = await chatMutation.mutateAsync({ 
        query: contextualQuery,
        accountId: context?.id,
        contactId: context?.type === 'contact' ? context.id : undefined,
        conversationHistory: messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      });
      
      setMessages(prev => [...prev, {
        role: "assistant",
        content: result.answer || "I couldn't find relevant information for that query.",
        // The mutation resolves (no thrown error) even when no model was reachable —
        // `answer` is the outage note in that case, not a real reply. Flagged here so
        // the bubble below renders it as a notice, not as the assistant's own words.
        unavailable: result.available === false,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, I encountered an error processing your request."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = context?.type === "account" 
    ? [
        "What are the key buying signals?",
        "Summarize recent activity",
        "What's our engagement strategy?",
        "Who are the key decision makers?"
      ]
    : context?.type === "contact"
    ? [
        "What topics has this person discussed?",
        "What are their pain points?",
        "Generate an outreach email",
        "What's their role in the buying process?"
      ]
    : [
        "Show me high-intent accounts",
        "What are the top opportunities?",
        "Which accounts need follow-up?",
        "Summarize this week's activity"
      ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-accent text-accent-foreground rounded-sm shadow-lg hover:shadow-xl transition-all z-50 group"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-accent"></span>
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all ${isMinimized ? 'w-80' : 'w-96'}`}>
      <Card className={`bg-card border-border-strong shadow-2xl ${isMinimized ? 'h-16' : 'h-[600px]'} flex flex-col`}>
        <CardHeader className="flex-shrink-0 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Bot className="size-5 shrink-0 text-ink-faint" />
              <div>
                <CardTitle className="text-foreground text-sm">Sales AI Assistant</CardTitle>
                {context && (
                  <Badge variant="outline" className="border-accent/30 text-accent text-xs mt-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {context.type === "account" ? "Account Context" : 
                     context.type === "contact" ? "Contact Context" : "General"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0 text-ink-muted hover:text-foreground"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0 text-ink-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-ink-muted text-sm">
                    Hi! I'm your AI sales assistant. I can help you with:
                  </p>
                  <ul className="text-ink-muted text-sm space-y-2 list-disc list-inside">
                    <li>Finding accounts and contacts</li>
                    <li>Analyzing call transcripts</li>
                    <li>Identifying buying signals</li>
                    <li>Generating outreach emails</li>
                    <li>Summarizing account activity</li>
                  </ul>
                  <div className="space-y-2">
                    <p className="text-ink-subtle text-xs font-semibold">Try asking:</p>
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs text-accent hover:text-accent bg-canvas hover:bg-canvas p-2 rounded border border-border hover:border-accent/30 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-sm p-3 ${
                      msg.role === "user"
                        ? "bg-accent text-accent-foreground"
                        : msg.unavailable
                          ? "bg-caution-subtle border border-caution/30 text-caution"
                          : "bg-canvas border border-border text-ink-muted"
                    }`}>
                      {msg.role === "assistant" ? (
                        <SafeStreamdown className="text-sm">{msg.content}</SafeStreamdown>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-canvas border border-border rounded-sm p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  </div>
                </div>
              )}
            </CardContent>

            <div className="flex-shrink-0 border-t border-border p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="bg-canvas border-border-strong text-foreground placeholder:text-ink-subtle"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-accent hover:bg-accent shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
