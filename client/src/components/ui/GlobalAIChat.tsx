import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { MessageSquare, X, Maximize2, Minimize2, Bot, Send, Loader2, Sparkles, Zap } from "lucide-react";
import { SafeStreamdown } from "@/components/SafeStreamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Global AI Chat - Single instance shared across all pages
 * Features:
 * - Normal mode: Bottom-right floating panel
 * - Full-screen mode: Seamless expansion to full screen
 * - War Room mode: Enhanced full-screen with additional context
 */
export function GlobalAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);

  // Auto-popup on first visit
  useEffect(() => {
    const hasSeenAI = localStorage.getItem('hasSeenAIAssistant');
    if (!hasSeenAI) {
      // Wait 2 seconds after page load to show welcome
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasShownWelcome(true);
        localStorage.setItem('hasSeenAIAssistant', 'true');
        // Add welcome message
        setMessages([{
          role: 'assistant',
          content: "👋 Hi! I'm your AI sales assistant. I can help you find high-intent accounts, generate personalized outreach, analyze buying signals, and answer questions about your pipeline. Try asking me something!"
        }]);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isWarRoomMode, setIsWarRoomMode] = useState(false);
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
      const result = await chatMutation.mutateAsync({ 
        query: userMessage,
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
    if (e.key === "Escape" && isFullScreen) {
      setIsFullScreen(false);
      setIsWarRoomMode(false);
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
    if (!isFullScreen) {
      setIsWarRoomMode(false); // Exit War Room when minimizing
    }
  };

  const toggleWarRoomMode = () => {
    if (!isFullScreen) {
      setIsFullScreen(true);
    }
    setIsWarRoomMode(!isWarRoomMode);
  };

  const suggestedQuestions = isWarRoomMode ? [
    "Show me all high-intent accounts that need immediate attention",
    "Which accounts have buying signals this week?",
    "Generate a priority list for today's outreach",
    "What are the top 5 opportunities closing this quarter?",
    "Show me accounts with recent executive changes",
    "Which contacts haven't been engaged in 30+ days?",
  ] : [
    "Show me high-intent accounts",
    "What are the top opportunities?",
    "Which accounts need follow-up?",
    "Summarize this week's activity",
    "Find accounts with MFA buying signals",
    "Generate outreach email for a prospect"
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 z-50 group"
        aria-label="Toggle AI Assistant"
      >
        <MessageSquare className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
        </span>
      </Button>
    );
  }

  // Full-screen mode
  if (isFullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${isWarRoomMode ? 'from-orange-500 to-red-600' : 'from-purple-600 to-pink-600'} shadow-lg`}>
                    {isWarRoomMode ? <Zap className="h-6 w-6 text-white" /> : <Bot className="h-6 w-6 text-white" />}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      {isWarRoomMode ? "War Room AI Command Center" : "AI Sales Assistant"}
                    </h1>
                    <p className="text-sm text-slate-400">
                      {isWarRoomMode ? "Strategic intelligence and priority actions" : "Ask me anything about your accounts, contacts, and opportunities"}
                    </p>
                  </div>
                  {isWarRoomMode && (
                    <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 px-3 py-1">
                      <Sparkles className="h-3 w-3 mr-1" />
                      War Room Mode
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleWarRoomMode}
                    className={`text-slate-400 hover:text-white ${isWarRoomMode ? 'bg-orange-500/10 text-orange-400' : ''}`}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isWarRoomMode ? "Exit War Room" : "War Room Mode"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullScreen}
                    className="text-slate-400 hover:text-white"
                  >
                    <Minimize2 className="h-4 w-4 mr-2" />
                    Minimize
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsOpen(false);
                      setIsFullScreen(false);
                      setIsWarRoomMode(false);
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="container mx-auto px-6 py-8 max-w-4xl">
              {messages.length === 0 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center space-y-3">
                    <p className="text-slate-300 text-lg">
                      {isWarRoomMode 
                        ? "Welcome to War Room mode. I'll help you prioritize and execute on your highest-value opportunities."
                        : "Hi! I'm your AI sales assistant. I have access to all your accounts, contacts, calls, and intelligence data."}
                    </p>
                    <p className="text-slate-500 text-sm">
                      {isWarRoomMode
                        ? "Ask strategic questions to identify priorities, generate action plans, and get real-time intelligence."
                        : "Ask me anything about your pipeline, or try one of these suggestions:"}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
                    {suggestedQuestions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(q)}
                        className={`text-left p-4 rounded-lg border transition-all hover:scale-[1.02] ${
                          isWarRoomMode
                            ? 'bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40 hover:bg-orange-500/10'
                            : 'bg-purple-500/5 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/10'
                        }`}
                      >
                        <p className={`text-sm font-medium ${isWarRoomMode ? 'text-orange-300' : 'text-purple-300'}`}>
                          {q}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[80%] rounded-xl p-4 ${
                        msg.role === "user" 
                          ? isWarRoomMode
                            ? "bg-gradient-to-br from-orange-600 to-red-600 text-white shadow-lg"
                            : "bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg"
                          : "bg-slate-900 border border-slate-800 text-slate-300"
                      }`}>
                        {msg.role === "assistant" ? (
                          <SafeStreamdown className="text-sm leading-relaxed">{msg.content}</SafeStreamdown>
                        ) : (
                          <p className="text-sm leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                        <Loader2 className={`h-5 w-5 animate-spin ${isWarRoomMode ? 'text-orange-500' : 'text-purple-500'}`} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="container mx-auto px-6 py-4 max-w-4xl">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isWarRoomMode ? "Ask for strategic intelligence..." : "Ask me anything..."}
                  className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 h-12 text-base"
                  disabled={isLoading}
                  autoFocus
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={`h-12 px-6 ${isWarRoomMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Press Enter to send • Shift+Enter for new line • ESC to minimize
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal floating panel mode
  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-4 duration-300">
      <Card className="bg-slate-900 border-slate-700 shadow-2xl h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-white text-sm">AI Assistant</CardTitle>
                <p className="text-xs text-slate-400">Ask me anything</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleWarRoomMode}
                className="h-8 px-2 text-slate-400 hover:text-orange-400"
                title="War Room Mode"
              >
                <Zap className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullScreen}
                className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                title="Full Screen"
              >
                <Maximize2 className="h-4 w-4" />
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
                {suggestedQuestions.slice(0, 4).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(q)}
                    className="block w-full text-left text-xs text-purple-400 hover:text-purple-300 bg-slate-950/50 hover:bg-slate-950 p-2 rounded border border-slate-800 hover:border-purple-500/30 transition-all"
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
                    ? "bg-purple-600 text-white" 
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
                <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
              </div>
            </div>
          )}
        </CardContent>

        <div className="flex-shrink-0 border-t border-slate-800 p-4">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask me anything..."
              className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
              disabled={isLoading}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="bg-purple-600 hover:bg-purple-700 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
