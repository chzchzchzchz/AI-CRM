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
        content: result.answer || "I couldn't find relevant information for that query."
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
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all z-50 group"
      >
        <Bot className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all ${isMinimized ? 'w-80' : 'w-96'}`}>
      <Card className={`bg-slate-900 border-slate-700 shadow-2xl ${isMinimized ? 'h-16' : 'h-[600px]'} flex flex-col`}>
        <CardHeader className="flex-shrink-0 border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-sm">Sales AI Assistant</CardTitle>
                {context && (
                  <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs mt-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    {context.type === "account" ? "Account Context" : 
                     context.type === "contact" ? "Contact Context" : "General"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
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
                  <p className="text-slate-400 text-sm">
                    Hi! I'm your AI sales assistant. I can help you with:
                  </p>
                  <ul className="text-slate-400 text-sm space-y-2 list-disc list-inside">
                    <li>Finding accounts and contacts</li>
                    <li>Analyzing call transcripts</li>
                    <li>Identifying buying signals</li>
                    <li>Generating outreach emails</li>
                    <li>Summarizing account activity</li>
                  </ul>
                  <div className="space-y-2">
                    <p className="text-slate-500 text-xs font-semibold">Try asking:</p>
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs text-cyan-400 hover:text-cyan-300 bg-slate-950/50 hover:bg-slate-950 p-2 rounded border border-slate-800 hover:border-cyan-500/30 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-lg p-3 ${
                      msg.role === "user" 
                        ? "bg-cyan-600 text-white" 
                        : "bg-slate-950 border border-slate-800 text-slate-300"
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
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-500" />
                  </div>
                </div>
              )}
            </CardContent>

            <div className="flex-shrink-0 border-t border-slate-800 p-4">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-cyan-600 hover:bg-cyan-700 shrink-0"
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
