import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { 
  Sparkles, FileText, Upload, Mic, 
  Loader2, Copy, Check, ChevronRight,
  AlertTriangle, Shield, DollarSign, Quote, User, Link2,
  Save, Building2, Zap, MessageSquare, Clock, Target,
  TrendingUp, Lightbulb, Send, X, ExternalLink,
  FileSearch, Brain, Users, Briefcase, AlertCircle
} from 'lucide-react';
import { Link } from 'wouter';

// ============ SAMPLE TRANSCRIPT ============
const SAMPLE_TRANSCRIPT = `[Speaker 1 - Sales Rep]: Thanks for taking the time today. I know you're busy. Can you tell me a bit about what's driving your interest in passwordless authentication?

[Speaker 2 - CISO]: Sure. We're a fintech company, about 2,000 employees. We're heavily regulated, so AI and security are scary topics right now. We had an incident last quarter where a junior dev pasted an API key into ChatGPT. That was a nightmare to clean up.

[Speaker 1]: That's unfortunately common. What are you using today for authentication?

[Speaker 2]: We have Okta for SSO, but we're still using SMS-based MFA for most users. The security team knows it's not ideal, but the business pushes back on anything that adds friction.

[Speaker 1]: What's your biggest concern right now?

[Speaker 2]: Data leakage is number one. I don't know who is using what shadow AI tool. Marketing uses Jasper and ChatGPT Enterprise, which we approved. But developers are actively pushing to use GitHub Copilot, and I'm seeing requests for Claude and other tools I've never heard of.

[Speaker 1]: How are you handling that today?

[Speaker 2]: Honestly, we're not. We block what we can at the firewall, but it's whack-a-mole. The board is asking me for a plan, and I don't have a good answer yet.

[Speaker 1]: Let me show you our visibility dashboard. This shows PII leaving your network in real-time...

[Speaker 2]: Oh wow, that's exactly what I need. Can you show me how the blocking works?

[Speaker 1]: Sure. When we detect sensitive data, we can either alert or block in real-time.

[Speaker 2]: What's the latency on that? If you're inspecting every request, that might kill the developer experience.

[Speaker 1]: Good question. We're typically under 50ms, but I want to be honest - for large payloads it can be higher.

[Speaker 2]: That latency might kill the developer experience. If you can fix that, we have budget for Q4. The board just approved a security modernization initiative.

[Speaker 1]: What would you need to see to move forward?

[Speaker 2]: Send over the docs for the beta program. I want to run a pilot with our engineering team first. If they don't revolt, we can talk about a broader rollout.

[Speaker 1]: Perfect. I'll send that over today. Any other concerns?

[Speaker 2]: Just make sure it works with our existing Okta setup. We can't rip and replace right now.`;

// ============ ANALYSIS RESULT TYPE ============
interface AnalysisResult {
  aboutProspect: {
    jobTitle: string;
    industry: string;
    companyName: string;
    aiToolsUsed: { enterprise: string[]; other: string[] };
    aiUsageContext: string;
  };
  topRisks: string[];
  topChallenges: string[];
  currentSecurityStack: { toolsUsed: string[]; toolsConsidered: string[] };
  budgetTimelinePriority: string;
  urgencyDrivers: string;
  feedbackPoints: string[];
  betaInterest: { interestLevel: string; apprehensions: string; interestQuote: string };
  topQuotes: string[];
  additionalInsights: string[];
  nextSteps: string[];
  linkedAccount?: { id: number; name: string; industry: string; intentScore: number };
}

// ============ MAIN COMPONENT ============
export default function AITools() {
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reportName, setReportName] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [showSavedReports, setShowSavedReports] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const analyzeMutation = trpc.tools.analyzeTranscript.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success('Analysis complete!');
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
    }
  });

  const saveMutation = trpc.tools.saveTranscriptReport.useMutation({
    onSuccess: () => {
      toast.success('Report saved!');
      setReportName('');
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    }
  });

  const savedReportsQuery = trpc.tools.getSavedTranscriptReports.useQuery(undefined, {
    enabled: showSavedReports
  });

  const handleAnalyze = () => {
    if (!transcript.trim() || transcript.length < 100) {
      toast.error('Transcript must be at least 100 characters');
      return;
    }
    analyzeMutation.mutate({ transcript });
  };

  const handleSave = () => {
    if (!result || !reportName.trim()) {
      toast.error('Enter a report name');
      return;
    }
    saveMutation.mutate({ name: reportName, transcript, analysis: result });
  };

  const loadExample = () => {
    setTranscript(SAMPLE_TRANSCRIPT);
    toast.success('Sample transcript loaded');
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = formatResultAsText(result);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const formatResultAsText = (r: AnalysisResult) => `
TRANSCRIPT ANALYSIS REPORT
==========================

ABOUT THE PROSPECT
------------------
Company: ${r.aboutProspect.companyName}
Title: ${r.aboutProspect.jobTitle}
Industry: ${r.aboutProspect.industry}
${r.linkedAccount ? `\n🔗 LINKED TO ACCOUNT: ${r.linkedAccount.name} (Intent Score: ${r.linkedAccount.intentScore})` : ''}

AI TOOLS USED
-------------
Enterprise: ${r.aboutProspect.aiToolsUsed.enterprise.join(', ') || 'None mentioned'}
Other/Shadow: ${r.aboutProspect.aiToolsUsed.other.join(', ') || 'None mentioned'}
Context: ${r.aboutProspect.aiUsageContext}

TOP RISKS
---------
${r.topRisks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

TOP CHALLENGES
--------------
${r.topChallenges.map((c, i) => `${i + 1}. ${c}`).join('\n')}

SECURITY STACK
--------------
Currently Using: ${r.currentSecurityStack.toolsUsed.join(', ') || 'Not mentioned'}
Considering: ${r.currentSecurityStack.toolsConsidered.join(', ') || 'Not mentioned'}

DRIVERS OF URGENCY
------------------
${r.urgencyDrivers}

BUDGET & TIMELINE
-----------------
${r.budgetTimelinePriority}

DEMO/PITCH FEEDBACK
-------------------
${r.feedbackPoints.map(f => `• ${f}`).join('\n')}

BETA INTEREST
-------------
Interest Level: ${r.betaInterest.interestLevel}
Apprehensions: ${r.betaInterest.apprehensions}
${r.betaInterest.interestQuote ? `Quote: "${r.betaInterest.interestQuote}"` : ''}

TOP QUOTES
----------
${r.topQuotes.map(q => `"${q}"`).join('\n\n')}

ADDITIONAL INSIGHTS
-------------------
${r.additionalInsights.map(i => `• ${i}`).join('\n')}

NEXT STEPS
----------
${r.nextSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`.trim();

  const newAnalysis = () => {
    setResult(null);
    setTranscript('');
    setFollowUpAnswer('');
    setFollowUpQuestion('');
  };

  // ============ RESULTS VIEW ============
  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-purple-600 to-cyan-600 p-3 rounded-xl">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Analysis Report</h1>
                <p className="text-sm text-muted-foreground">Extracted insights from your transcript</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyToClipboard}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button variant="outline" size="sm" onClick={newAnalysis}>
                New Analysis
              </Button>
            </div>
          </div>

          {/* Auto-linked Account Banner */}
          {result.linkedAccount && (
            <Card className="mb-6 border-green-500/50 bg-green-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-green-500/20 p-2 rounded-lg">
                    <Link2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-400">Auto-linked to: {result.linkedAccount.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Intent Score: {result.linkedAccount.intentScore} • {result.linkedAccount.industry}
                    </p>
                  </div>
                </div>
                <Link href={`/accounts/${result.linkedAccount.id}`}>
                  <Button variant="outline" size="sm" className="border-green-500/50 text-green-400 hover:bg-green-500/10">
                    <ExternalLink className="w-4 h-4 mr-1" /> View Account
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - About & AI Tools */}
            <div className="space-y-4">
              {/* About the Prospect */}
              <Card className="border-purple-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-purple-500" /> About the Prospect
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Job Title</p>
                    <p className="font-medium">{result.aboutProspect.jobTitle}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Industry</p>
                    <p className="font-medium">{result.aboutProspect.industry}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="font-medium">{result.aboutProspect.companyName}</p>
                  </div>
                </CardContent>
              </Card>

              {/* AI Tools Used */}
              <Card className="border-cyan-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-500" /> AI Tools Used
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Enterprise Accounts</p>
                    <p className="font-medium">
                      {result.aboutProspect.aiToolsUsed.enterprise.length > 0 
                        ? result.aboutProspect.aiToolsUsed.enterprise.join(', ')
                        : 'None mentioned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Other / Individual</p>
                    <p className="font-medium">
                      {result.aboutProspect.aiToolsUsed.other.length > 0 
                        ? result.aboutProspect.aiToolsUsed.other.join(', ')
                        : 'None mentioned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">How AI is being used</p>
                    <p className="text-sm">{result.aboutProspect.aiUsageContext || 'Not mentioned'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Security Stack */}
              <Card className="border-blue-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" /> Current Security Stack
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Tools Used Today</p>
                    <p className="font-medium">
                      {result.currentSecurityStack.toolsUsed.length > 0 
                        ? result.currentSecurityStack.toolsUsed.join(', ')
                        : 'Not mentioned in transcript'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tools Considered</p>
                    <p className="font-medium">
                      {result.currentSecurityStack.toolsConsidered.length > 0 
                        ? result.currentSecurityStack.toolsConsidered.join(', ')
                        : 'None mentioned'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Middle Column - Risks, Challenges, Urgency */}
            <div className="space-y-4">
              {/* Top Risks */}
              <Card className="border-red-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Top Risks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.topRisks.slice(0, 3).map((risk, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-red-500 mt-1">•</span>
                        <span>{risk}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Top Challenges */}
              <Card className="border-orange-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500" /> Top Challenges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.topChallenges.slice(0, 3).map((challenge, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-orange-500 mt-1">•</span>
                        <span>{challenge}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Drivers of Urgency */}
              <Card className="border-yellow-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" /> Drivers of Urgency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{result.urgencyDrivers || 'Not mentioned'}</p>
                </CardContent>
              </Card>

              {/* Budget & Timeline */}
              <Card className="border-green-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-500" /> Budget, Timeline & Priority
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{result.budgetTimelinePriority || 'Not mentioned'}</p>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Feedback, Interest, Quotes */}
            <div className="space-y-4">
              {/* Pitch & Demo Feedback */}
              <Card className="border-purple-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="w-4 h-4 text-purple-500" /> Pitch & Demo Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.feedbackPoints.length > 0 ? (
                    <ul className="space-y-2">
                      {result.feedbackPoints.map((feedback, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-purple-500 mt-1">•</span>
                          <span>{feedback}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No specific feedback captured</p>
                  )}
                </CardContent>
              </Card>

              {/* Beta Interest */}
              <Card className="border-cyan-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-500" /> Beta Interest
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Interest Level:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      result.betaInterest.interestLevel.toLowerCase().includes('high') 
                        ? 'bg-green-500/20 text-green-400'
                        : result.betaInterest.interestLevel.toLowerCase().includes('medium')
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {result.betaInterest.interestLevel}
                    </span>
                  </div>
                  {result.betaInterest.apprehensions && (
                    <div>
                      <p className="text-xs text-muted-foreground">Apprehensions</p>
                      <p className="text-sm">{result.betaInterest.apprehensions}</p>
                    </div>
                  )}
                  {result.betaInterest.interestQuote && (
                    <div>
                      <p className="text-xs text-muted-foreground">Direct Quote</p>
                      <p className="text-sm italic">"{result.betaInterest.interestQuote}"</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Quotes */}
              <Card className="border-yellow-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Quote className="w-4 h-4 text-yellow-500" /> Top Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {result.topQuotes.slice(0, 3).map((quote, i) => (
                      <p key={i} className="text-sm italic border-l-2 border-yellow-500/50 pl-3">
                        "{quote}"
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Additional Insights */}
          {result.additionalInsights.length > 0 && (
            <Card className="mt-6 border-blue-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-blue-500" /> Additional Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid md:grid-cols-2 gap-2">
                  {result.additionalInsights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Next Steps */}
          <Card className="mt-6 border-green-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-green-500" /> Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="bg-green-500/20 text-green-400 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Ask Follow-up Questions */}
          <Card className="mt-6 border-purple-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-500" /> Ask About This Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                I can answer questions about this transcript. What would you like to know?
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question about the transcript (e.g., 'Did they mention specific competitors?')"
                  value={followUpQuestion}
                  onChange={(e) => setFollowUpQuestion(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={() => {
                    toast.info('Follow-up questions coming soon!');
                  }}
                  disabled={!followUpQuestion.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              {followUpAnswer && (
                <div className="mt-3 p-3 bg-muted/30 rounded-lg text-sm">
                  {followUpAnswer}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Report */}
          <div className="mt-6 flex items-center gap-3">
            <Input 
              placeholder="Report name..." 
              value={reportName} 
              onChange={(e) => setReportName(e.target.value)}
              className="max-w-xs"
            />
            <Button onClick={handleSave} disabled={saveMutation.isPending || !reportName.trim()}>
              <Save className="w-4 h-4 mr-1" /> Save Report
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ============ LANDING VIEW ============
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-12 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-purple-600 to-cyan-600 p-4 rounded-2xl mb-6">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3">Turn Transcripts into Actionable Insights</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Paste your meeting transcript below to automatically extract prospect risks, challenges, 
            buying intent, and next steps using AI. Auto-links to your accounts.
          </p>
        </div>

        {/* Main Input Card */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-500" /> Meeting Transcript
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadExample}>
                <FileText className="w-4 h-4 mr-1" /> Load Example
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowSavedReports(!showSavedReports)}
              >
                <FileSearch className="w-4 h-4 mr-1" /> Saved Reports
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload Area */}
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-purple-500/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('transcript-upload')?.click()}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setTranscript(ev.target?.result as string || '');
                    toast.success(`Loaded: ${file.name}`);
                  };
                  reader.readAsText(file);
                }
              }}
            >
              <input
                id="transcript-upload"
                type="file"
                accept=".txt,.vtt,.srt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setTranscript(ev.target?.result as string || '');
                      toast.success(`Loaded: ${file.name}`);
                    };
                    reader.readAsText(file);
                  }
                }}
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drop a file or click to upload (.txt, .vtt, .srt)
              </p>
            </div>

            <div className="text-center text-xs text-muted-foreground">— or paste directly —</div>

            <Textarea
              placeholder="Paste transcript here... (e.g., [Speaker 1]: Hello...)"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="min-h-[250px] font-mono text-sm"
            />

            <Button 
              onClick={handleAnalyze} 
              disabled={!transcript.trim() || transcript.length < 100 || analyzeMutation.isPending}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white"
              size="lg"
            >
              {analyzeMutation.isPending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Analyzing Transcript...</>
              ) : (
                <><Sparkles className="w-5 h-5 mr-2" /> Analyze Transcript</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Saved Reports Panel */}
        {showSavedReports && (
          <Card className="mb-8 border-purple-500/30">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Saved Reports</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowSavedReports(false)}>
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {savedReportsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : savedReportsQuery.data && savedReportsQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savedReportsQuery.data.map((report: any) => (
                    <div 
                      key={report.id} 
                      className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setResult(report.analysis);
                        setTranscript(report.transcript);
                        setShowSavedReports(false);
                        toast.success(`Loaded: ${report.name}`);
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{report.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No saved reports yet. Analyze a transcript and save it!
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Feature Callouts */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Risk Extraction</h3>
              <p className="text-sm text-muted-foreground">
                Identifies top security risks and compliance concerns mentioned by the prospect.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-purple-500/10 p-2 rounded-lg">
              <Target className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Feedback Summaries</h3>
              <p className="text-sm text-muted-foreground">
                Condenses product feedback and feature requests into actionable bullet points.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-green-500/10 p-2 rounded-lg">
              <Check className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Fact-Based Only</h3>
              <p className="text-sm text-muted-foreground">
                Strictly pulls from the transcript. No hallucinations or assumptions added.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-cyan-500/10 p-2 rounded-lg">
              <Link2 className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Auto-Link Accounts</h3>
              <p className="text-sm text-muted-foreground">
                Automatically matches prospects to your 722 accounts for instant context.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-yellow-500/10 p-2 rounded-lg">
              <Quote className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Key Quotes</h3>
              <p className="text-sm text-muted-foreground">
                Extracts the most important quotes for follow-up emails and proposals.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="bg-blue-500/10 p-2 rounded-lg">
              <ChevronRight className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Next Steps</h3>
              <p className="text-sm text-muted-foreground">
                Clear action items extracted from the conversation for immediate follow-up.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
