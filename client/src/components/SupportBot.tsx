import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
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
      content: "Hey! 👋 I'm here to help you get the most out of this dashboard. Ask me anything about accounts, intent scores, outreach, or how to use the features. If I can't help, just slack ryan!"
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
        content: response.answer || "Hmm, I'm not sure about that. Slack ryan if you need more help!",
        reasoning: response.reasoning // Always store reasoning for optional viewing
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Oops, something went wrong on my end. Try again or slack ryan if it keeps happening!"
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
        className="fixed bottom-6 left-6 h-12 px-4 rounded-full shadow-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 z-50"
        aria-label="Get Help"
      >
        <HelpCircle className="h-5 w-5 mr-2" />
        Help
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 left-6 w-96 max-h-[600px] shadow-2xl z-50 bg-slate-900 border-slate-700 flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">AI Help</CardTitle>
              <p className="text-xs text-slate-400">Ask anything about the dashboard</p>
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
            <p className="text-xs text-slate-500 mb-2">Quick questions:</p>
            {helpTopics.map((topic, i) => (
              <button
                key={i}
                onClick={() => handleTopicClick(topic)}
                className="w-full text-left p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm text-white">{topic.title}</p>
                    <p className="text-xs text-slate-400">{topic.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
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
              <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                msg.role === "user"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-800 text-slate-200"
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
            
            {/* Optional Reasoning Dropdown (collapsed by default) */}
            {msg.reasoning && msg.role === "assistant" && (
              <div className="ml-0">
                <button
                  onClick={() => toggleReasoning(i)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 transition-colors py-1"
                >
                  {expandedReasoning === i ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{expandedReasoning === i ? "Hide" : "View"} reasoning</span>
                </button>
                {expandedReasoning === i && (
                  <div className="mt-1 bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                    <div className="px-2 py-1 bg-slate-800 text-[10px] text-slate-400 border-b border-slate-700">
                      AI Reasoning
                    </div>
                    <div className="p-2 text-[10px] text-slate-400 overflow-x-auto max-h-32 font-mono whitespace-pre-wrap break-all">
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
            <div className="bg-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                <span className="text-xs text-slate-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask me anything..."
            className="bg-slate-800 border-slate-700"
          />
          <Button 
            onClick={() => handleSend()} 
            disabled={isLoading || !input.trim()} 
            size="icon"
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          Can't find what you need? Just slack ryan!
        </p>
      </div>
    </Card>
  );
}
