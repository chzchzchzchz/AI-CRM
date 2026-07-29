import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { KnowledgeBase } from "@/components/KnowledgeBase";
import { ContentFeedback } from "@/components/ContentFeedback";
import { toast } from "sonner";
import {
  Sparkles, Loader2, Copy, CheckCircle2,
  FileText, Mail, Video, Mic, BookOpen,
  Upload, Brain, Zap, MessageSquare, Target
} from "lucide-react";

type ContentType = 'email' | 'webinar' | 'battle_card' | 'call_script' | 'linkedin';

interface GeneratedContent {
  content: string;
  title?: string;
  metadata?: any;
}

export default function ContentStudio() {
  const [contentType, setContentType] = useState<ContentType>('email');
  const [context, setContext] = useState("");
  const [targetAccount, setTargetAccount] = useState("");
  const [targetContact, setTargetContact] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Whether the knowledge base actually contributed. The page used to display a
  // hardcoded list — "Product Overview.pdf", "Competitor Analysis.docx" — as though
  // those were the documents consulted. The server reports a real boolean; naming
  // files it cannot name would be inventing evidence for its own output.
  const [ragUsed, setRagUsed] = useState<boolean | null>(null);
  const [contentId, setContentId] = useState<number | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");

  // `tools.generateContent` handles every type this page offers, grounded in the
  // knowledge base. It was built and unrouted, so the page shipped its own fake:
  // four of the five types returned a hardcoded template after a two-second delay
  // and then reported "Content generated successfully!".
  const generateMutation = trpc.tools.generateContent.useMutation();

  const contentTypes = [
    { value: 'email', label: 'Sales Email', icon: <Mail className="h-4 w-4" />, description: 'Personalized outreach emails' },
    { value: 'webinar', label: 'Webinar Promo', icon: <Video className="h-4 w-4" />, description: 'Landing pages, emails, social' },
    { value: 'battle_card', label: 'Battle Card', icon: <Target className="h-4 w-4" />, description: 'Competitive positioning' },
    { value: 'call_script', label: 'Call Script', icon: <Mic className="h-4 w-4" />, description: 'Discovery & demo scripts' },
    { value: 'linkedin', label: 'LinkedIn Message', icon: <MessageSquare className="h-4 w-4" />, description: 'Connection & InMail' },
  ];

  const handleGenerate = async () => {
    if (!context.trim()) {
      toast.error("Please provide some context for generation");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);
    setRagUsed(null);

    try {
      // One path for every type. The server picks the prompt for the content type and
      // pulls knowledge-base context itself.
      const result = await generateMutation.mutateAsync({
        contentType,
        context,
        targetAccount: targetAccount || undefined,
        targetContact: targetContact || undefined,
        additionalNotes: additionalNotes || undefined,
      });

      // No model was reachable. The server used to hand this back looking exactly like
      // a successful generation, so the panel read "Generated Blog Post" over an
      // apology and a success toast confirmed it. Say what actually happened instead.
      if (result.available === false) {
        setGeneratedContent({
          content: result.content,
          title: "No model configured",
        });
        setContentId(null);
        setOriginalContent("");
        setRagUsed(false);
        toast.error("No AI model is configured — nothing was generated");
        return;
      }

      setGeneratedContent({
        content: result.content,
        title: `Generated ${contentTypes.find(c => c.value === contentType)?.label}`,
      });
      // Kept so feedback can be attached to this exact generation, and so an edit can
      // be told apart from the text we produced.
      setContentId(result.contentId ?? null);
      setOriginalContent(result.content);
      setRagUsed(result.ragSourcesUsed);
      toast.success("Content generated");
    } catch (error) {
      // Surface the real reason. "Please try again" hides the usual cause, which is
      // that no model is configured — retrying will not help with that.
      toast.error(error instanceof Error ? error.message : "Failed to generate content");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div>
      <div className="container py-1 space-y-5 max-w-6xl">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 rounded-sm bg-muted border border-border-strong">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Content Studio</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered content generation grounded in your knowledge base.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">What do you want to create?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {contentTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setContentType(type.value as ContentType)}
                    className={`p-3 rounded-sm border text-center transition-all ${contentType === type.value ? 'border-accent/30 bg-accent-subtle text-accent' : 'border-border-strong text-muted-foreground hover:border-accent/30 hover:bg-muted'}`}
                  >
                    <div className="flex justify-center mb-1">{type.icon}</div>
                    <p className="text-xs font-medium">{type.label}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Context Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Context & Instructions
              </CardTitle>
              <CardDescription>
                Describe what you need - the AI will pull relevant info from your knowledge base
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Account</label>
                  <Input
                    value={targetAccount}
                    onChange={(e) => setTargetAccount(e.target.value)}
                    placeholder="e.g., Acme Corp"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Contact</label>
                  <Input
                    value={targetContact}
                    onChange={(e) => setTargetContact(e.target.value)}
                    placeholder="e.g., John Smith, VP Security"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Main Context</label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder={
                    contentType === 'email' ? "What's the purpose of this email? Any specific pain points to address?" :
                    contentType === 'webinar' ? "Paste your webinar talking points, agenda, or key topics..." :
                    contentType === 'battle_card' ? "Which competitor? What are the key differentiators?" :
                    contentType === 'call_script' ? "What stage is this call? Discovery, demo, follow-up?" :
                    "What message do you want to convey?"
                  }
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Additional Notes</label>
                <Textarea
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Any specific requirements, tone preferences, or things to include/avoid..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            variant="signal"
            size="lg"
            onClick={handleGenerate}
            disabled={!context.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Content
              </>
            )}
          </Button>

          {/* Generated Content */}
          {generatedContent && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-positive" />
                    {generatedContent.title || 'Generated Content'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.content, 'main')}
                  >
                    {copiedField === 'main' ? (
                      <CheckCircle2 className="h-4 w-4 text-positive" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Editable, not a <pre>. A rep is going to change this before sending
                    it, and the edit is the most useful feedback there is — it says what
                    the draft should have been rather than that it was wrong. */}
                <Textarea
                  value={generatedContent.content}
                  onChange={e =>
                    setGeneratedContent(g => (g ? { ...g, content: e.target.value } : g))
                  }
                  rows={14}
                  aria-label="Generated content"
                  className="text-sm"
                />

                <ContentFeedback
                  contentId={contentId}
                  editedContent={generatedContent?.content}
                  originalContent={originalContent}
                  className="mt-4 border-t pt-4"
                />

                {ragUsed !== null && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      {ragUsed
                        ? "Grounded in your knowledge base."
                        : "No knowledge-base context was available — this came from the prompt alone."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Was an upload button that listed "PDFs" and "Word docs" as supported while
              its file input accepted only .txt/.md/.csv/.json/.html — a claim the code
              could not honour. The shared component states the real formats, and shows
              what is in the knowledge base, which is what actually grounds the content
              generated on this page. */}
          <KnowledgeBase />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                AI Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                'Pulls from your knowledge base',
                'Uses account & contact data',
                'References past Gong calls',
                'Learns from your edits',
                'Applies Revenue Architect persona',
              ].map((cap, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-positive" />
                  <span>{cap}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                Quick Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Cold Outreach', type: 'email' },
                { label: 'Follow-up Email', type: 'email' },
                { label: 'Security Webinar', type: 'webinar' },
                { label: 'Discovery Call', type: 'call_script' },
              ].map((template, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setContentType(template.type as ContentType);
                    toast.info(`Template: ${template.label} selected`);
                  }}
                >
                  {template.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>
  );
}
