import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { HelpCircle, X, Send, Loader2, ChevronRight, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation();

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
      // Use the contextual AI endpoint for intelligent responses
      const systemPrompt = `You are a helpful support assistant for the Target Account Dashboard. Be casual and friendly. 
        
Key features to know about:
- Home page: Priority actions, hot leads, trending keywords, rep view switcher
- Accounts page: Browse all target accounts, filter by intent/region/industry
- Contacts page: View contacts, AI prioritization feature
- Insights page: Analytics on keywords, buying stages, engagement
- CSV Processor: Transform messy CSV files into proper SFDC/HubSpot format
- Rep territories: Reps see only their assigned accounts based on region and company size

Intent scores: Hot (70+) = high buying intent, Warm (40-69) = showing interest, Cold (<40) = low intent

If you can't answer something or the user needs human help, tell them to "slack ryan" - keep it casual!`;

      const response = await chatMutation.mutateAsync({
        query: `${systemPrompt}\n\nUser question: ${userMessage}`,
        conversationHistory: messages.slice(1).map(m => ({ role: m.role, content: m.content }))
      });

      setMessages(prev => [...prev, {
        role: "assistant",
        content: response.answer || "Hmm, I'm not sure about that. Slack ryan if you need more help!"
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
    <Card className="fixed bottom-6 left-6 w-96 max-h-[500px] shadow-2xl z-50 bg-slate-900 border-slate-700 flex flex-col">
      <CardHeader className="flex-shrink-0 pb-2 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                AI Help
                <span className="text-xs font-normal text-slate-400">powered by AI</span>
              </CardTitle>
              <p className="text-xs text-slate-400">Ask me anything!</p>
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
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
              msg.role === "user"
                ? "bg-purple-600 text-white"
                : "bg-slate-800 text-slate-200"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
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
