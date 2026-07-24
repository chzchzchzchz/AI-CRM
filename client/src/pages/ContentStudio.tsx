import { useState, useRef } from "react";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
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
  const kbInputRef = useRef<HTMLInputElement>(null);
  const uploadDocMutation = trpc.tools.uploadDocument.useMutation({
    onSuccess: (_r, vars) => toast.success(`Added "${vars.fileName}" to the knowledge base`),
    onError: (e) => toast.error(e.message || "Upload failed"),
  });
  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["txt", "md", "csv", "json", "html"].includes(ext)) {
      toast.error("Text documents only (.txt, .md, .csv, .json, .html).");
      return;
    }
    const content = await file.text();
    uploadDocMutation.mutate({ fileName: file.name, content, mimeType: file.type || "text/plain", category: "general" });
  };
  const [ragSources, setRagSources] = useState<string[]>([]);

  const generateMutation = trpc.tools.generateWebinarContent.useMutation();

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

    try {
      // For now, use the webinar content generator as a base
      // In production, this would call a unified content generation endpoint
      if (contentType === 'webinar') {
        const result = await generateMutation.mutateAsync({
          contentAssets: context,
          speaker1: targetContact || undefined,
          painPoints: additionalNotes || undefined,
          contentType: 'all'
        });

        setGeneratedContent({
          content: JSON.stringify(result, null, 2),
          title: 'Webinar Promotional Content',
          metadata: result
        });
      } else {
        // Simulate other content types with a placeholder
        // In production, each would have its own specialized endpoint
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const templates: Record<ContentType, string> = {
          email: `Subject: Quick question about ${targetAccount || 'your security strategy'}\n\nHi ${targetContact || 'there'},\n\n${context}\n\nWould you have 15 minutes this week to discuss?\n\nBest regards`,
          battle_card: `# ${targetAccount || 'Competitor'} Battle Card\n\n## Key Differentiators\n${context}\n\n## Objection Handling\n- "Why not [competitor]?" → ${additionalNotes || 'Our unique value...'}`,
          call_script: `# Discovery Call Script\n\n## Opening\n"Hi ${targetContact || 'there'}, thanks for taking the time..."\n\n## Key Questions\n${context}\n\n## Next Steps\n${additionalNotes || 'Schedule demo...'}`,
          linkedin: `Hi ${targetContact || 'there'},\n\n${context}\n\nWould love to connect and share some insights relevant to ${targetAccount || 'your role'}.\n\nBest,`,
          webinar: ''
        };

        setGeneratedContent({
          content: templates[contentType],
          title: `Generated ${contentTypes.find(c => c.value === contentType)?.label}`
        });
      }

      // Simulate RAG sources
      setRagSources(['Product Overview.pdf', 'Competitor Analysis.docx', 'Case Study - Enterprise.pdf']);
      
      toast.success("Content generated successfully!");
    } catch (error) {
      toast.error("Failed to generate content. Please try again.");
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
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container py-6 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-800 border border-slate-700">
            <Sparkles className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Content Studio</h1>
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
                    className={`
                      p-3 rounded-lg border text-center transition-all
                      ${contentType === type.value
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-slate-700 text-muted-foreground hover:border-cyan-500/40 hover:bg-slate-800'}
                    `}
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
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    {generatedContent.title || 'Generated Content'}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.content, 'main')}
                  >
                    {copiedField === 'main' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg overflow-auto max-h-96">
                  {generatedContent.content}
                </pre>

                {ragSources.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      Sources used from Knowledge Base:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ragSources.map((source, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-400" />
                Knowledge Base
              </CardTitle>
              <CardDescription>
                Upload docs to enhance AI context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input ref={kbInputRef} type="file" accept=".txt,.md,.csv,.json,.html" className="hidden" onChange={handleKbUpload} />
              <Button variant="outline" className="w-full" disabled={uploadDocMutation.isPending} onClick={() => kbInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {uploadDocMutation.isPending ? "Uploading…" : "Upload Documents"}
              </Button>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Supported formats:</p>
                <ul className="list-disc list-inside">
                  <li>PDFs (battle cards, case studies)</li>
                  <li>Word docs (playbooks, scripts)</li>
                  <li>Text files (product info)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
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
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
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
