import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { HelpCircle, X, Send, Loader2, Mail, MessageSquare, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUPPORT_EMAIL = "ryan.chazi@company.com";

const helpTopics = [
  {
    title: "Getting Started",
    description: "Learn how to use the dashboard",
    content: `Welcome to the Target Account Dashboard! Here's how to get started:

**1. Home Page** - Your daily command center showing priority actions, hot leads, and trending keywords.

**2. Accounts** - Browse all target accounts, filter by intent score, industry, or region. Click any account for detailed intelligence.

**3. Contacts** - View and search contacts across all accounts. Use AI prioritization to find the best people to reach out to.

**4. Calls** - Review Gong call history and AI-generated summaries.

**5. Insights** - Deep analytics on intent keywords, buying stages, and engagement metrics.

**6. AI Assistant** - Ask questions anywhere! Use the purple AI bar at the top of each page or the chat bubble in the corner.`
  },
  {
    title: "Using AI Features",
    description: "Get the most out of AI assistance",
    content: `The AI assistant can help you with:

**Account Intelligence**
- Generate executive briefings
- Analyze tech stacks and security posture
- Identify buying signals and intent

**Outreach**
- Generate personalized emails
- Suggest talking points for calls
- Prioritize contacts by engagement

**Analytics**
- Find high-intent accounts
- Identify trends and patterns
- Generate action plans

**Tips:**
- Be specific in your questions
- Mention account or contact names for context
- Use the suggested questions as starting points`
  },
  {
    title: "Understanding Intent Scores",
    description: "What the numbers mean",
    content: `Intent scores indicate how likely an account is to buy:

**🔥 Hot (70+)** - High buying intent, prioritize immediate outreach
**🌡️ Warm (40-69)** - Showing interest, nurture with relevant content
**❄️ Cold (<40)** - Low intent, maintain awareness

**Buying Stages:**
- **Target** - Identified but no signals yet
- **Awareness** - Researching the problem
- **Consideration** - Evaluating solutions
- **Decision** - Comparing vendors
- **Purchase** - Ready to buy

Intent scores are calculated from 6sense data including web visits, keyword searches, and engagement activities.`
  },
  {
    title: "Contact Support",
    description: "Get help from a human",
    content: `Need more help? Contact our team:

**Email:** ${SUPPORT_EMAIL}

We'll respond within 24 hours. Include:
- Your question or issue
- Screenshots if relevant
- Account/contact names involved

For urgent issues, mention "URGENT" in the subject line.`
  }
];

export function SupportBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hi! I'm your support assistant. I can help you learn how to use this dashboard or connect you with our team. What would you like help with?"
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showTopics, setShowTopics] = useState(true);

  const supportMutation = trpc.system.notifyOwner.useMutation();

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);
    setShowTopics(false);

    // Check if user wants to contact support
    const wantsSupport = userMessage.toLowerCase().includes("contact") || 
                         userMessage.toLowerCase().includes("email") ||
                         userMessage.toLowerCase().includes("human") ||
                         userMessage.toLowerCase().includes("help");

    if (wantsSupport) {
      // Send notification to support email
      try {
        await supportMutation.mutateAsync({
          title: "Support Request from Dashboard",
          content: `User message: ${userMessage}\n\nPlease respond to this user's inquiry.`
        });
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `I've forwarded your message to our team at ${SUPPORT_EMAIL}. They'll get back to you within 24 hours!\n\nIn the meantime, is there anything else I can help you with?`
        }]);
        toast.success("Support request sent!");
      } catch (error) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `I couldn't send the notification automatically, but you can email us directly at ${SUPPORT_EMAIL}. Is there anything else I can help with?`
        }]);
      }
    } else {
      // Provide helpful response based on keywords
      let response = "I'm not sure about that. Would you like me to connect you with our support team?";
      
      const lowerMsg = userMessage.toLowerCase();
      if (lowerMsg.includes("account") || lowerMsg.includes("company")) {
        response = "For account-related questions, check out the Accounts page. Click any account to see detailed intelligence, contacts, and AI insights. You can also use the AI bar at the top to ask specific questions about any account.";
      } else if (lowerMsg.includes("contact") || lowerMsg.includes("person")) {
        response = "The Contacts page shows all people in your target accounts. Use filters to find specific roles or companies. Click any contact for their full profile and to generate personalized outreach.";
      } else if (lowerMsg.includes("intent") || lowerMsg.includes("score")) {
        response = "Intent scores (0-100) indicate buying likelihood. Hot leads (70+) should be prioritized. Scores come from 6sense data including web activity, keyword searches, and engagement.";
      } else if (lowerMsg.includes("ai") || lowerMsg.includes("assistant")) {
        response = "The AI assistant is available throughout the app! Use the purple bar at the top of each page for contextual help, or click the chat bubble in the corner for full conversations.";
      } else if (lowerMsg.includes("email") || lowerMsg.includes("outreach")) {
        response = "To generate outreach emails, go to any contact's detail page and click 'Generate Email'. The AI will create personalized content based on the contact's role, company, and engagement history.";
      }
      
      setMessages(prev => [...prev, { role: "assistant", content: response }]);
    }

    setIsLoading(false);
  };

  const handleTopicClick = (topic: typeof helpTopics[0]) => {
    setShowTopics(false);
    setMessages(prev => [
      ...prev,
      { role: "user", content: topic.title },
      { role: "assistant", content: topic.content }
    ]);
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
            <div className="p-2 bg-slate-800 rounded-lg">
              <HelpCircle className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-base">Help & Support</CardTitle>
              <p className="text-xs text-slate-400">How can I help you?</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Help Topics */}
        {showTopics && (
          <div className="space-y-2">
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
                  <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {!showTopics && messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
              msg.role === "user"
                ? "bg-cyan-600 text-white"
                : "bg-slate-800 text-slate-200"
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-lg p-3">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            </div>
          </div>
        )}
      </CardContent>

      {/* Input */}
      <div className="flex-shrink-0 p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your question..."
            className="bg-slate-800 border-slate-700"
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
          <Mail className="h-3 w-3" />
          <span>Or email {SUPPORT_EMAIL}</span>
        </div>
      </div>
    </Card>
  );
}
