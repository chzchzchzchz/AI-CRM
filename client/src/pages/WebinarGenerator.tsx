import { useState } from"react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { Textarea } from"@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from"@/components/ui/tabs";
import { trpc } from"@/lib/trpc";
import { toast } from"sonner";
import { 
  Sparkles, Loader2, Copy, CheckCircle2, 
  FileText, Mail, Share2, Video
} from"lucide-react";

interface GeneratedContent {
  landingPage: {
    headline: string;
    subheadline: string;
    bullets: string[];
    cta: string;
  };
  emailSequence: {
    invite: { subject: string; body: string };
    reminder: { subject: string; body: string };
    lastChance: { subject: string; body: string };
  };
  socialPosts: {
    linkedin: string;
    twitter: string;
  };
}

export default function WebinarGenerator() {
  const [contentAssets, setContentAssets] = useState("");
  const [speaker1, setSpeaker1] = useState("");
  const [speaker2, setSpeaker2] = useState("");
  const [painPoints, setPainPoints] = useState("");
  const [styleGuidelines, setStyleGuidelines] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const generateMutation = trpc.tools.generateWebinarContent.useMutation();

  const handleGenerate = async () => {
    if (!contentAssets.trim()) {
      toast.error("Please provide webinar content");
      return;
    }

    setIsGenerating(true);
    setGeneratedContent(null);

    try {
      const result = await generateMutation.mutateAsync({
        contentAssets,
        speaker1: speaker1 || undefined,
        speaker2: speaker2 || undefined,
        painPoints: painPoints || undefined,
        styleGuidelines: styleGuidelines || undefined,
        brandContext: brandContext || undefined,
        contentType: 'all'
      });

      setGeneratedContent(result);
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

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, field)}
      className="h-8"
    >
      {copiedField === field ? (
        <CheckCircle2 className="h-4 w-4 text-positive" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="container py-1 max-w-5xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
          <div className="p-2 bg-muted border border-border-strong rounded-md">
            <Video className="h-6 w-6 text-foreground" />
          </div>
          <h1 className="text-xl font-semibold">Webinar Content Generator</h1>
        </div>
        <p className="text-muted-foreground">
          AI-powered promotional content for your webinars
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-positive" />
                Step 1: Webinar Content
              </CardTitle>
              <CardDescription>
                Paste your webinar talking points, agenda, or slide content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={contentAssets}
                onChange={(e) => setContentAssets(e.target.value)}
                placeholder="Paste your webinar content here... (talking points, agenda, key topics)"
                rows={8}
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Speaker Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Speaker 1</label>
                <Textarea
                  value={speaker1}
                  onChange={(e) => setSpeaker1(e.target.value)}
                  placeholder="Name, title, company, bio..."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Speaker 2 (Optional)</label>
                <Textarea
                  value={speaker2}
                  onChange={(e) => setSpeaker2(e.target.value)}
                  placeholder="Name, title, company, bio..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Pain Points</CardTitle>
              <CardDescription>
                What problems does this webinar solve?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={painPoints}
                onChange={(e) => setPainPoints(e.target.value)}
                placeholder="e.g., alert fatigue, misconfigured clouds, zero-day threats..."
                rows={3}
                className="resize-none"
              />
            </CardContent>
          </Card>

          {/* Settings Accordion */}
          <Card>
            <CardHeader 
              className="cursor-pointer"
              onClick={() => setShowSettings(!showSettings)}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <span>Style & Brand Settings</span>
                <span className="text-xs text-muted-foreground">
                  {showSettings ?"Hide" :"Show"}
                </span>
              </CardTitle>
            </CardHeader>
            {showSettings && (
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Style Guidelines</label>
                  <Textarea
                    value={styleGuidelines}
                    onChange={(e) => setStyleGuidelines(e.target.value)}
                    placeholder="e.g., Be direct. Avoid cheesy phrases. No exclamation points."
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Brand Context</label>
                  <Textarea
                    value={brandContext}
                    onChange={(e) => setBrandContext(e.target.value)}
                    placeholder="Paste your company's About Us, product info, value props..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            )}
          </Card>

          <Button
            onClick={handleGenerate}
            disabled={!contentAssets.trim() || isGenerating}
            className="w-full py-6 text-lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </div>

        {/* Output Section */}
        <div>
          {!generatedContent && !isGenerating && (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Generated content will appear here</p>
              </div>
            </Card>
          )}

          {isGenerating && (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-positive" />
                <p className="text-muted-foreground">Generating your content...</p>
              </div>
            </Card>
          )}

          {generatedContent && (
            <Tabs defaultValue="landing" className="h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="landing" className="flex flex-wrap items-center gap-1">
                  <FileText className="h-4 w-4" />
                  Landing
                </TabsTrigger>
                <TabsTrigger value="email" className="flex flex-wrap items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Emails
                </TabsTrigger>
                <TabsTrigger value="social" className="flex flex-wrap items-center gap-1">
                  <Share2 className="h-4 w-4" />
                  Social
                </TabsTrigger>
              </TabsList>

              <TabsContent value="landing" className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Landing Page Copy</CardTitle>
                      <CopyButton 
                        text={`${generatedContent.landingPage.headline}\n\n${generatedContent.landingPage.subheadline}\n\n${generatedContent.landingPage.bullets.map(b => `• ${b}`).join('\n')}\n\nCTA: ${generatedContent.landingPage.cta}`}
                        field="landing"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Headline</label>
                      <p className="text-xl font-bold">{generatedContent.landingPage.headline}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Subheadline</label>
                      <p className="text-muted-foreground">{generatedContent.landingPage.subheadline}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Key Points</label>
                      <ul className="list-disc list-inside space-y-1 mt-1">
                        {generatedContent.landingPage.bullets.map((bullet, i) => (
                          <li key={i}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">CTA</label>
                      <p className="font-semibold text-positive">{generatedContent.landingPage.cta}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="email" className="mt-4 space-y-4">
                {(['invite', 'reminder', 'lastChance'] as const).map((type) => (
                  <Card key={type}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base capitalize">
                          {type === 'lastChance' ? 'Last Chance' : type} Email
                        </CardTitle>
                        <CopyButton 
                          text={`Subject: ${generatedContent.emailSequence[type].subject}\n\n${generatedContent.emailSequence[type].body}`}
                          field={`email-${type}`}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="mb-2">
                        <label className="text-xs text-muted-foreground">Subject</label>
                        <p className="font-medium">{generatedContent.emailSequence[type].subject}</p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Body</label>
                        <p className="text-sm whitespace-pre-wrap">{generatedContent.emailSequence[type].body}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="social" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">LinkedIn Post</CardTitle>
                      <CopyButton text={generatedContent.socialPosts.linkedin} field="linkedin" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{generatedContent.socialPosts.linkedin}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Twitter/X Post</CardTitle>
                      <CopyButton text={generatedContent.socialPosts.twitter} field="twitter" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{generatedContent.socialPosts.twitter}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
