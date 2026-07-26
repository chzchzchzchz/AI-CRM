import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { SUPPORT_CONTACT } from "@/const";
import { HelpCircle, X, Send, Loader2, ChevronRight, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  reasoning?: string; // Raw XML reasoning from Layer 1 (always captured, optionally shown)
}

const helpTopics = [
  {
    title: "Getting Started",
    description: "Learn how to use the dashboard",
    question: "How do I get started with this dashboard?"
  },
  {
    title: "Understanding Intent Scores",
    description: "What the numbers mean",
    question: "What do the intent scores mean and how should I use them?"
  },
  {
    title: "Using AI Features",
    description: "Get the most out of AI assistance",
    question: "What AI features are available and how do I use them?"
  },
  {
    title: "Rep Territories",
    description: "How account assignments work",
    question: "How do rep territories and account assignments work?"
  }
];

export function SupportBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `I'm here to help you get the most out of this dashboard. Ask me anything about accounts, intent scores, outreach, or how to use the features. If I can't help, reach out to ${SUPPORT_CONTACT}!`
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTopics, setShowTopics] = useState(true);
  const [expandedReasoning, setExpandedReasoning] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use Deep-Think endpoint for 2-layer AI
  const deepThinkMutation = trpc.deepThink.help.useMutation();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (questionOverride?: string) => {
    const userMessage = questionOverride || input.trim();
    if (!userMessage || isLoading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setShowTopics(false);

    try {
      // Use Deep-Think 2-layer architecture - always capture reasoning
      const response = await deepThinkMutation.mutateAsync({
        query: userMessage,
        debugMode: true // Always capture reasoning, but we'll hide it by default
      });

      setMessages(prev => [...prev, {
        role: "assistant",
        content: response.answer || `Hmm, I'm not sure about that. Reach out to ${SUPPORT_CONTACT} if you need more help!`,
        reasoning: response.reasoning // Always store reasoning for optional viewing
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Oops, something went wrong on my end. Try again or contact ${SUPPORT_CONTACT} if it keeps happening!`
      }]);
    }

    setIsLoading(false);
  };

  const handleTopicClick = (topic: typeof helpTopics[0]) => {
    handleSend(topic.question);
  };

  const toggleReasoning = (index: number) => {
    setExpandedReasoning(expandedReasoning === index ? null : index);
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-24 z-40 h-10 rounded-sm border border-border bg-surface px-3 text-ink-muted shadow-md hover:bg-muted hover:text-foreground"
        aria-label="Get Help"
      >
        <HelpCircle className="h-5 w-5 mr-2" />
        Help
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 z-40 flex max-h-[600px] w-96 max-w-[calc(100vw-3rem)] flex-col border-border shadow-xl">
      <CardHeader className="flex-shrink-0 pb-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Sparkles className="size-5 shrink-0 text-ink-faint" />
            <div>
              <CardTitle className="text-base">AI Help</CardTitle>
              <p className="text-xs text-ink-muted">Ask anything about the dashboard</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
        {/* Help Topics - Quick Start */}
        {showTopics && (
          <div className="space-y-2">
            <p className="text-xs text-ink-subtle mb-2">Quick questions:</p>
            {helpTopics.map((topic, i) => (
              <button
                key={i}
                onClick={() => handleTopicClick(topic)}
                className="w-full text-left p-3 rounded-sm bg-muted hover:bg-muted border border-border-strong transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-foreground">{topic.title}</p>
                    <p className="text-xs text-ink-muted">{topic.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-subtle group-hover:text-accent transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} className="space-y-1">
            {/* Main Message (Layer 2 Response) */}
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-sm p-3 text-sm ${ msg.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground" }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
            
            {/* Optional Reasoning Dropdown (collapsed by default) */}
            {msg.reasoning && msg.role === "assistant" && (
              <div className="ml-0">
                <button
                  onClick={() => toggleReasoning(i)}
                  className="flex flex-wrap items-center gap-1 text-[10px] text-ink-subtle hover:text-ink-muted transition-colors py-1"
                >
                  {expandedReasoning === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{expandedReasoning === i ? "Hide" : "View"} reasoning</span>
                </button>
                {expandedReasoning === i && (
                  <div className="mt-1 bg-muted border border-border-strong rounded-sm overflow-hidden">
                    <div className="px-2 py-1 bg-muted text-[10px] text-ink-muted border-b border-border-strong">
                      AI Reasoning
                    </div>
                    <div className="p-2 text-[10px] text-ink-muted overflow-x-auto max-h-32 font-mono whitespace-pre-wrap break-all">
                      <code>{msg.reasoning}</code>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-sm p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                <span className="text-xs text-ink-muted">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-border">
        <div className="flex flex-wrap gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything..."
            className="bg-muted border-border-strong"
          />
          <Button 
            onClick={() => handleSend()} 
            disabled={isLoading || !input.trim()} 
            size="icon"
            className="bg-accent hover:bg-accent"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-ink-subtle">
          Can't find what you need? Reach out to {SUPPORT_CONTACT}!
        </p>
      </div>
    </Card>
  );
}
