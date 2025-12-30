import { useState, useEffect } from 'react';
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
  FileSearch, Brain, Users, Briefcase, AlertCircle,
  Layers, PenTool, BarChart3, ArrowLeft, Eye
} from 'lucide-react';
import { Link, useLocation } from 'wouter';

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

// ============ TYPES ============
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

interface SavedReport {
  id: number;
  name: string;
  transcript: string;
  analysis: any; // JSON from database
  createdAt: Date | string;
  shareId: string;
}

type Tool = 'analyzer' | 'processor' | 'content';

// ============ MAIN COMPONENT ============
export default function AITools() {
  const [location, setLocation] = useLocation();
  const [activeTool, setActiveTool] = useState<Tool>('analyzer');
  
  // Check if viewing a shared report
  const urlParams = new URLSearchParams(window.location.search);
  const sharedReportId = urlParams.get('report');

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Tools</h1>
            <p className="text-muted-foreground">Analyze transcripts, process data, and generate content</p>
          </div>
        </div>

        {/* Tool Tabs */}
        <div className="flex gap-2 mb-6 border-b border-border pb-4">
          <Button
            variant={activeTool === 'analyzer' ? 'default' : 'ghost'}
            onClick={() => setActiveTool('analyzer')}
            className={activeTool === 'analyzer' ? 'bg-purple-600 hover:bg-purple-700' : ''}
          >
            <Mic className="w-4 h-4 mr-2" />
            Call Analyzer
          </Button>
          <Button
            variant={activeTool === 'processor' ? 'default' : 'ghost'}
            onClick={() => setActiveTool('processor')}
            className={activeTool === 'processor' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Data Processor
          </Button>
          <Button
            variant={activeTool === 'content' ? 'default' : 'ghost'}
            onClick={() => setActiveTool('content')}
            className={activeTool === 'content' ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <PenTool className="w-4 h-4 mr-2" />
            Content Studio
          </Button>
        </div>

        {/* Tool Content */}
        {activeTool === 'analyzer' && <CallAnalyzerTool sharedReportId={sharedReportId} />}
        {activeTool === 'processor' && <DataProcessorTool />}
        {activeTool === 'content' && <ContentStudioTool />}
      </div>
    </div>
  );
}

// ============ CALL ANALYZER TOOL ============
type AnalyzerMode = 'single' | 'compare' | 'bulk';

function CallAnalyzerTool({ sharedReportId }: { sharedReportId: string | null }) {
  const [analyzerMode, setAnalyzerMode] = useState<AnalyzerMode>('single');
  const [transcript, setTranscript] = useState('');
  const [transcript2, setTranscript2] = useState('');
  const [result2, setResult2] = useState<AnalysisResult | null>(null);
  const [bulkTranscripts, setBulkTranscripts] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<AnalysisResult[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reportName, setReportName] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [askingFollowUp, setAskingFollowUp] = useState(false);
  const [showSavedReports, setShowSavedReports] = useState(false);
  const [viewingReport, setViewingReport] = useState<SavedReport | null>(null);
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
    onSuccess: (data) => {
      toast.success('Report saved! Share link copied to clipboard.');
      const shareUrl = `${window.location.origin}/tools?report=${data.shareId}`;
      navigator.clipboard.writeText(shareUrl);
      setReportName('');
      savedReportsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    }
  });

  const savedReportsQuery = trpc.tools.getSavedTranscriptReports.useQuery(undefined, {
    enabled: showSavedReports || !!sharedReportId
  });

  const askFollowUpMutation = trpc.tools.askTranscriptQuestion.useMutation({
    onSuccess: (data) => {
      setFollowUpAnswer(typeof data.answer === 'string' ? data.answer : String(data.answer));
      setAskingFollowUp(false);
    },
    onError: (error) => {
      toast.error(`Failed to answer: ${error.message}`);
      setAskingFollowUp(false);
    }
  });

  // Load shared report if ID provided
  useEffect(() => {
    if (sharedReportId && savedReportsQuery.data) {
      const report = savedReportsQuery.data.find((r: SavedReport) => r.shareId === sharedReportId);
      if (report) {
        setViewingReport(report);
        setResult(report.analysis as AnalysisResult);
        setTranscript(report.transcript);
      }
    }
  }, [sharedReportId, savedReportsQuery.data]);

  const handleAnalyze = () => {
    if (!transcript.trim() || transcript.length < 100) {
      toast.error('Transcript must be at least 100 characters');
      return;
    }
    setViewingReport(null);
    analyzeMutation.mutate({ transcript });
  };

  const handleSave = () => {
    if (!result || !reportName.trim()) {
      toast.error('Enter a report name');
      return;
    }
    saveMutation.mutate({ name: reportName, transcript, analysis: result });
  };

  const handleAskFollowUp = () => {
    if (!followUpQuestion.trim() || !transcript) {
      toast.error('Enter a question');
      return;
    }
    setAskingFollowUp(true);
    setFollowUpAnswer('');
    askFollowUpMutation.mutate({ transcript, question: followUpQuestion });
  };

  const loadExample = () => {
    setTranscript(SAMPLE_TRANSCRIPT);
    setViewingReport(null);
    setResult(null);
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

  const copyShareLink = (shareId: string) => {
    const shareUrl = `${window.location.origin}/tools?report=${shareId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Share link copied!');
  };

  const loadReport = (report: SavedReport) => {
    setViewingReport(report);
    setResult(report.analysis as AnalysisResult);
    setTranscript(report.transcript);
    setShowSavedReports(false);
    setFollowUpAnswer('');
    setFollowUpQuestion('');
  };

  const newAnalysis = () => {
    setResult(null);
    setTranscript('');
    setViewingReport(null);
    setFollowUpAnswer('');
    setFollowUpQuestion('');
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

  // Show saved reports panel
  if (showSavedReports) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowSavedReports(false)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h2 className="text-xl font-semibold text-white">Saved Reports</h2>
          </div>
        </div>

        {savedReportsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : savedReportsQuery.data?.length === 0 ? (
          <Card className="bg-card/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No saved reports yet</p>
              <Button variant="outline" className="mt-4" onClick={() => setShowSavedReports(false)}>
                Analyze a Transcript
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {savedReportsQuery.data?.map((report: SavedReport) => (
              <Card key={report.id} className="bg-card/50 hover:bg-card/70 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1" onClick={() => loadReport(report)}>
                      <h3 className="font-medium text-white">{report.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {report.analysis.aboutProspect.companyName || 'Unknown Company'} • {report.analysis.aboutProspect.jobTitle || 'Unknown Role'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => copyShareLink(report.shareId)}>
                        <Link2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => loadReport(report)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Show results
  if (result) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {viewingReport ? viewingReport.name : 'Analysis Report'}
              </h2>
              <p className="text-sm text-muted-foreground">Extracted insights from your transcript</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="outline" size="sm" onClick={newAnalysis}>
              New Analysis
            </Button>
          </div>
        </div>

        {/* Linked Account Banner */}
        {result.linkedAccount && (
          <Card className="bg-purple-500/10 border-purple-500/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm font-medium text-white">Linked to Account: {result.linkedAccount.name}</p>
                  <p className="text-xs text-muted-foreground">{result.linkedAccount.industry} • Intent Score: {result.linkedAccount.intentScore}</p>
                </div>
              </div>
              <Link href={`/accounts/${result.linkedAccount.id}`}>
                <Button variant="outline" size="sm">
                  View Account <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* 3-Column Results Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            {/* About Prospect */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  About the Prospect
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Job Title</p>
                  <p className="font-medium text-white">{result.aboutProspect.jobTitle || 'Not mentioned'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Industry</p>
                  <p className="font-medium text-white">{result.aboutProspect.industry || 'Not mentioned'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="font-medium text-white">{result.aboutProspect.companyName || 'Not mentioned in transcript'}</p>
                </div>
              </CardContent>
            </Card>

            {/* AI Tools Used */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  AI Tools Used
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Enterprise Accounts</p>
                  <p className="text-sm text-white">{result.aboutProspect.aiToolsUsed.enterprise.join(', ') || 'None mentioned'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Other / Individual</p>
                  <p className="text-sm text-white">{result.aboutProspect.aiToolsUsed.other.join(', ') || 'None mentioned'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">How AI is being used</p>
                  <p className="text-sm text-white">{result.aboutProspect.aiUsageContext || 'Not mentioned'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Security Stack */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  Current Security Stack
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Tools Used Today</p>
                  <p className="text-sm text-white">{result.currentSecurityStack.toolsUsed.join(', ') || 'None mentioned'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tools Considered</p>
                  <p className="text-sm text-white">{result.currentSecurityStack.toolsConsidered.join(', ') || 'None mentioned'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column */}
          <div className="space-y-4">
            {/* Top Risks */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Top Risks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.topRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                      <span className="text-white">{risk}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Top Challenges */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-400" />
                  Top Challenges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.topChallenges.map((challenge, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-2 flex-shrink-0" />
                      <span className="text-white">{challenge}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Drivers of Urgency */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Drivers of Urgency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white">{result.urgencyDrivers || 'No urgency drivers identified'}</p>
              </CardContent>
            </Card>

            {/* Budget & Timeline */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  Budget, Timeline & Priority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white">{result.budgetTimelinePriority || 'Not discussed'}</p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Pitch & Demo Feedback */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-green-400" />
                  Pitch & Demo Feedback
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.feedbackPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 mt-2 flex-shrink-0" />
                      <span className="text-white">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Beta Interest */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  Beta Interest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Interest Level</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                    result.betaInterest.interestLevel.toLowerCase().includes('high') 
                      ? 'bg-green-500/20 text-green-400'
                      : result.betaInterest.interestLevel.toLowerCase().includes('medium')
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {result.betaInterest.interestLevel}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Apprehensions</p>
                  <p className="text-sm text-white">{result.betaInterest.apprehensions || 'None mentioned'}</p>
                </div>
                {result.betaInterest.interestQuote && (
                  <div>
                    <p className="text-xs text-muted-foreground">Direct Quote</p>
                    <p className="text-sm text-white italic">"{result.betaInterest.interestQuote}"</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Quotes */}
            <Card className="bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Quote className="w-4 h-4 text-pink-400" />
                  Top Quotes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.topQuotes.map((quote, i) => (
                    <p key={i} className="text-sm text-white italic border-l-2 border-pink-500/50 pl-3">
                      "{quote}"
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Additional Insights */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              Additional Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {result.additionalInsights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 flex-shrink-0" />
                  <span className="text-white">{insight}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-cyan-400" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {result.nextSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                    {i + 1}
                  </span>
                  <span className="text-white pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Ask About This Meeting */}
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              Ask About This Meeting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">I can answer questions about this transcript. What would you like to know?</p>
            <div className="flex gap-2">
              <Input
                placeholder="Ask a question about the transcript (e.g., 'Did they mention specific competitors?')"
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskFollowUp()}
                className="flex-1"
              />
              <Button onClick={handleAskFollowUp} disabled={askingFollowUp}>
                {askingFollowUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            {followUpAnswer && (
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-sm text-white">{followUpAnswer}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Report */}
        {!viewingReport && (
          <Card className="bg-card/50">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Report name..."
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Report
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Saved reports are public and can be shared with anyone via link</p>
            </CardContent>
          </Card>
        )}

        {viewingReport && (
          <Card className="bg-blue-500/10 border-blue-500/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-blue-400" />
                <p className="text-sm text-white">Viewing saved report: <span className="font-medium">{viewingReport.name}</span></p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyShareLink(viewingReport.shareId)}>
                <Link2 className="w-4 h-4 mr-2" />
                Copy Share Link
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Handle compare analysis
  const handleCompareAnalyze = async () => {
    if (!transcript.trim() || transcript.length < 100) {
      toast.error('First transcript must be at least 100 characters');
      return;
    }
    if (!transcript2.trim() || transcript2.length < 100) {
      toast.error('Second transcript must be at least 100 characters');
      return;
    }
    setViewingReport(null);
    // Analyze both transcripts
    try {
      const [res1, res2] = await Promise.all([
        analyzeMutation.mutateAsync({ transcript }),
        analyzeMutation.mutateAsync({ transcript: transcript2 })
      ]);
      setResult(res1);
      setResult2(res2);
    } catch (e) {
      // Error handled by mutation
    }
  };

  // Handle bulk analysis
  const handleBulkAnalyze = async () => {
    if (bulkTranscripts.length === 0) {
      toast.error('Add at least one transcript');
      return;
    }
    setBulkProcessing(true);
    setBulkProgress(0);
    const results: AnalysisResult[] = [];
    for (let i = 0; i < bulkTranscripts.length; i++) {
      try {
        const res = await analyzeMutation.mutateAsync({ transcript: bulkTranscripts[i] });
        results.push(res);
        setBulkProgress(((i + 1) / bulkTranscripts.length) * 100);
      } catch (e) {
        // Skip failed ones
      }
    }
    setBulkResults(results);
    setBulkProcessing(false);
    toast.success(`Analyzed ${results.length} transcripts!`);
  };

  const addBulkTranscript = () => {
    if (transcript.trim().length >= 100) {
      setBulkTranscripts([...bulkTranscripts, transcript]);
      setTranscript('');
      toast.success('Transcript added to batch');
    } else {
      toast.error('Transcript must be at least 100 characters');
    }
  };

  // Show input form
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">
          {analyzerMode === 'single' && 'Turn Transcripts into Actionable Insights'}
          {analyzerMode === 'compare' && 'Compare Two Conversations'}
          {analyzerMode === 'bulk' && 'Bulk Transcript Analysis'}
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {analyzerMode === 'single' && 'Paste your meeting transcript below to automatically extract prospect risks, challenges, buying intent, and next steps using AI.'}
          {analyzerMode === 'compare' && 'Compare two transcripts side-by-side to track how prospect sentiment and priorities changed between meetings.'}
          {analyzerMode === 'bulk' && 'Process multiple transcripts at once and generate a summary report across all calls with an account.'}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="flex justify-center gap-2">
        <Button
          variant={analyzerMode === 'single' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAnalyzerMode('single')}
          className={analyzerMode === 'single' ? 'bg-purple-600 hover:bg-purple-700' : ''}
        >
          <FileText className="w-4 h-4 mr-2" />
          Single Analysis
        </Button>
        <Button
          variant={analyzerMode === 'compare' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAnalyzerMode('compare')}
          className={analyzerMode === 'compare' ? 'bg-cyan-600 hover:bg-cyan-700' : ''}
        >
          <Layers className="w-4 h-4 mr-2" />
          Compare
        </Button>
        <Button
          variant={analyzerMode === 'bulk' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAnalyzerMode('bulk')}
          className={analyzerMode === 'bulk' ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          <Users className="w-4 h-4 mr-2" />
          Bulk
        </Button>
      </div>

      {/* SINGLE MODE */}
      {analyzerMode === 'single' && (
      <Card className="bg-card/50 max-w-4xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              Meeting Transcript
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadExample}>
                <FileText className="w-4 h-4 mr-2" />
                Load Example
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSavedReports(true)}>
                <Save className="w-4 h-4 mr-2" />
                Saved Reports
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-purple-500/50 transition-colors cursor-pointer">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Drop a file or click to upload (.txt, .vtt, .srt)</p>
          </div>

          <div className="text-center text-sm text-muted-foreground">— or paste directly —</div>

          {/* Textarea */}
          <Textarea
            placeholder="Paste transcript here... (e.g., [Speaker 1]: Hello...)"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />

          {/* Analyze Button */}
          <Button 
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700"
            size="lg"
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending || transcript.length < 100}
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Analyze Transcript
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      )}

      {/* COMPARE MODE */}
      {analyzerMode === 'compare' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-400">
                <FileText className="w-5 h-5" />
                First Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste first transcript..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[250px] font-mono text-sm"
              />
            </CardContent>
          </Card>
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-400">
                <FileText className="w-5 h-5" />
                Second Meeting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Paste second transcript..."
                value={transcript2}
                onChange={(e) => setTranscript2(e.target.value)}
                className="min-h-[250px] font-mono text-sm"
              />
            </CardContent>
          </Card>
          <div className="lg:col-span-2">
            <Button
              className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-700 hover:to-purple-700"
              size="lg"
              onClick={handleCompareAnalyze}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Comparing...</>
              ) : (
                <><Layers className="w-5 h-5 mr-2" />Compare Transcripts</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* BULK MODE */}
      {analyzerMode === 'bulk' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-400" />
                Add Transcripts to Batch ({bulkTranscripts.length} added)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste a transcript and click Add to Batch..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={addBulkTranscript} className="flex-1">
                  <Zap className="w-4 h-4 mr-2" />
                  Add to Batch
                </Button>
                <Button variant="outline" onClick={loadExample}>
                  <FileText className="w-4 h-4 mr-2" />
                  Load Example
                </Button>
              </div>
            </CardContent>
          </Card>

          {bulkTranscripts.length > 0 && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="text-sm">Batch Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {bulkTranscripts.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-background/50 rounded">
                      <span className="text-sm text-muted-foreground">Transcript {i + 1} ({t.length} chars)</span>
                      <Button variant="ghost" size="sm" onClick={() => setBulkTranscripts(bulkTranscripts.filter((_, j) => j !== i))}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {bulkProcessing && (
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Loader2 className="w-5 h-5 animate-spin text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white">Processing {bulkTranscripts.length} transcripts...</p>
                    <div className="w-full bg-background/50 rounded-full h-2 mt-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${bulkProgress}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            className="w-full bg-gradient-to-r from-green-600 to-cyan-600 hover:from-green-700 hover:to-cyan-700"
            size="lg"
            onClick={handleBulkAnalyze}
            disabled={bulkProcessing || bulkTranscripts.length === 0}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Analyze All ({bulkTranscripts.length}) Transcripts
          </Button>

          {bulkResults.length > 0 && (
            <Card className="bg-card/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Bulk Analysis Summary ({bulkResults.length} transcripts)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-red-400">{bulkResults.reduce((acc, r) => acc + r.topRisks.length, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Risks</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-400">{bulkResults.reduce((acc, r) => acc + r.topChallenges.length, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Challenges</p>
                  </div>
                  <div className="text-center p-3 bg-cyan-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-cyan-400">{bulkResults.reduce((acc, r) => acc + r.nextSteps.length, 0)}</p>
                    <p className="text-xs text-muted-foreground">Action Items</p>
                  </div>
                  <div className="text-center p-3 bg-purple-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-purple-400">{bulkResults.filter(r => r.betaInterest.interestLevel.toLowerCase().includes('high')).length}</p>
                    <p className="text-xs text-muted-foreground">High Interest</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-white">Common Risks Across Calls:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(bulkResults.flatMap(r => r.topRisks))).slice(0, 5).map((risk, i) => (
                      <span key={i} className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">{risk.slice(0, 50)}...</span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Feature Callouts - only show in single mode */}
      {analyzerMode === 'single' && (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
        {[
          { icon: AlertTriangle, title: 'Risk Extraction', desc: 'Identifies top security risks and compliance concerns mentioned by the prospect.', color: 'text-red-400' },
          { icon: MessageSquare, title: 'Feedback Summaries', desc: 'Condenses product feedback and feature requests into actionable bullet points.', color: 'text-cyan-400' },
          { icon: Check, title: 'Fact-Based Only', desc: 'Strictly pulls from the transcript. No hallucinations or assumptions added.', color: 'text-green-400' },
          { icon: Link2, title: 'Auto-Link Accounts', desc: 'Automatically matches prospects to your 722 accounts for instant context.', color: 'text-purple-400' },
          { icon: Quote, title: 'Key Quotes', desc: 'Extracts the most important quotes for follow-up emails and proposals.', color: 'text-pink-400' },
          { icon: ChevronRight, title: 'Next Steps', desc: 'Clear action items extracted from the conversation for immediate follow-up.', color: 'text-yellow-400' },
        ].map((feature, i) => (
          <div key={i} className="text-center space-y-2">
            <feature.icon className={`w-6 h-6 ${feature.color} mx-auto`} />
            <h3 className="font-medium text-white text-sm">{feature.title}</h3>
            <p className="text-xs text-muted-foreground">{feature.desc}</p>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

// ============ DATA PROCESSOR TOOL ============
function DataProcessorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mx-auto">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">Process & Enrich Your Data</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Upload CSV files to clean, deduplicate, and enrich your account and contact data with AI-powered insights.
        </p>
      </div>

      {/* Upload Section */}
      <Card className="bg-card/50 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            Upload Data File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-cyan-500/50 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-white mb-2">Drop your CSV file here</p>
            <p className="text-sm text-muted-foreground">or click to browse (max 10MB)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: 'Clean & Dedupe', desc: 'Remove duplicates and fix formatting issues', icon: FileSearch },
              { title: 'Enrich Data', desc: 'Add missing company info and contact details', icon: Sparkles },
              { title: 'Validate', desc: 'Verify emails, domains, and company info', icon: Check },
            ].map((feature, i) => (
              <div key={i} className="p-4 bg-card rounded-lg border border-border">
                <feature.icon className="w-6 h-6 text-cyan-400 mb-2" />
                <h3 className="font-medium text-white text-sm">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>

          <Button 
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            size="lg"
            disabled={!file || processing}
          >
            {processing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Process Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ CONTENT STUDIO TOOL ============
function ContentStudioTool() {
  const [contentType, setContentType] = useState<'webinar_promo' | 'blog_post' | 'ad_copy' | 'campaign_brief' | 'case_study_outline' | 'event_followup'>('webinar_promo');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [context, setContext] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [generatedContent, setGeneratedContent] = useState('');
  const [generating, setGenerating] = useState(false);

  const accountsQuery = trpc.accounts.list.useQuery();

  const generateMutation = trpc.tools.generateContent.useMutation({
    onSuccess: (data) => {
      setGeneratedContent(data.content);
      toast.success('Content generated!');
    },
    onError: (error) => {
      toast.error(`Generation failed: ${error.message}`);
    }
  });

  const contentTypes = [
    { id: 'webinar_promo', name: 'Webinar Promo', desc: 'Promotional content for upcoming webinars', icon: Users },
    { id: 'blog_post', name: 'Blog Post Outline', desc: 'Structured outline for thought leadership', icon: FileText },
    { id: 'ad_copy', name: 'Ad Copy Variants', desc: 'Multiple ad variations for campaigns', icon: Target },
    { id: 'campaign_brief', name: 'Campaign Brief', desc: 'Full campaign strategy document', icon: Briefcase },
    { id: 'case_study', name: 'Case Study Outline', desc: 'Customer success story structure', icon: TrendingUp },
    { id: 'event_followup', name: 'Event Follow-up', desc: 'Post-event nurture sequence', icon: MessageSquare },
  ];

  const handleGenerate = () => {
    setGenerating(true);
    generateMutation.mutate({
      contentType,
      accountId: selectedAccount ? parseInt(selectedAccount) : undefined,
      context
    });
    setGenerating(false);
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto">
          <PenTool className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-white">AI Content Studio</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Generate personalized marketing content using your account data and AI. Select a content type and let AI do the heavy lifting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
        {/* Left: Configuration */}
        <div className="space-y-6">
          {/* Content Type Selection */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm">Select Content Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {contentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setContentType(type.id as typeof contentType)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      contentType === type.id
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-border hover:border-green-500/50'
                    }`}
                  >
                    <type.icon className={`w-5 h-5 mb-2 ${contentType === type.id ? 'text-green-400' : 'text-muted-foreground'}`} />
                    <h3 className="font-medium text-white text-sm">{type.name}</h3>
                    <p className="text-xs text-muted-foreground">{type.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Account Selection */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm">Link to Account (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full p-3 bg-background border border-border rounded-lg text-white"
              >
                <option value="">No account selected</option>
                {accountsQuery.data?.map((account: any) => (
                  <option key={account.id} value={account.id}>
                    {account.name} (Intent: {account.intentScore || 0})
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>

          {/* Context */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm">Context & Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any specific context, key messages, or requirements..."
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm">Your Ideas & Suggestions (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Any specific ideas, angles, or suggestions you want included..."
                value={suggestions}
                onChange={(e) => setSuggestions(e.target.value)}
                className="min-h-[80px]"
              />
            </CardContent>
          </Card>

          <Button 
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            size="lg"
            onClick={handleGenerate}
            disabled={generating || generateMutation.isPending}
          >
            {generating || generateMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Content
              </>
            )}
          </Button>
        </div>

        {/* Right: Output */}
        <Card className="bg-card/50 h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-400" />
              Generated Content
            </CardTitle>
          </CardHeader>
          <CardContent>
            {generatedContent ? (
              <div className="space-y-4">
                <div className="p-4 bg-background rounded-lg border border-border whitespace-pre-wrap text-sm text-white">
                  {generatedContent}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedContent);
                      toast.success('Copied to clipboard!');
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setGeneratedContent('')}>
                    <X className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a content type and click generate</p>
                <p className="text-xs text-muted-foreground mt-2">AI will create personalized content based on your inputs</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
