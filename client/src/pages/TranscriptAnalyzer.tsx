import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  FileText, Sparkles, AlertTriangle, Shield, DollarSign, 
  Activity, MessageSquare, Star, Quote, Save, Copy, Check,
  User, Loader2, Download, ChevronDown, ChevronUp
} from 'lucide-react';

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
}

interface SavedReport extends AnalysisResult {
  id: string;
  name: string;
  timestamp: number;
  originalTranscript: string;
}

const EXAMPLE_TRANSCRIPT = `[Speaker 1] Thanks for joining, Sarah. I'm excited to show you what we've been building at AI Shield.
[Speaker 2] Happy to be here. I'm Sarah, the CISO at FinTech Global. We're heavily regulated, so AI is a scary topic right now.
[Speaker 1] Makes sense. What tools are you guys exploring?
[Speaker 2] Currently, our marketing team is using Jasper and ChatGPT Enterprise. Our devs are pushing for GitHub Copilot.
[Speaker 1] What keeps you up at night regarding these tools?
[Speaker 2] Data leakage is number one. We had an incident where a junior dev pasted an API key into ChatGPT. That was a nightmare. Also, we don't have visibility. I don't know who is using what shadow AI tool.
[Speaker 1] That's exactly what we solve. Let me show you the demo... [Demo occurs] ... So, what do you think?
[Speaker 2] The visibility dashboard is great. I love that I can see the PII leaving the network. However, the blocking mechanism seems a bit slow. That latency might kill the developer experience.
[Speaker 1] Valid point. We are optimizing that.
[Speaker 2] If you can fix the latency, we have budget for Q4. This is a top priority for our board.
[Speaker 1] Would you be open to beta testing?
[Speaker 2] Yes, absolutely. Send over the docs.`;

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        {children}
      </CardContent>
    </Card>
  );
}

function ListItems({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <p className="text-muted-foreground italic">None mentioned</p>;
  return (
    <ul className="list-disc list-outside ml-5 space-y-1">
      {items.map((item, idx) => (
        <li key={idx} className="pl-1">{item}</li>
      ))}
    </ul>
  );
}

export default function TranscriptAnalyzer() {
  const [transcript, setTranscript] = useState('');
  const [reportName, setReportName] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [showTranscript, setShowTranscript] = useState(false);

  const analyzeMutation = trpc.tools.analyzeTranscript.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success('Transcript analyzed successfully!');
    },
    onError: (error) => {
      toast.error(`Analysis failed: ${error.message}`);
    }
  });

  const { data: reports, refetch: refetchReports } = trpc.tools.getSavedTranscriptReports.useQuery();

  const saveMutation = trpc.tools.saveTranscriptReport.useMutation({
    onSuccess: () => {
      toast.success('Report saved!');
      refetchReports();
      setReportName('');
    },
    onError: (error) => {
      toast.error(`Save failed: ${error.message}`);
    }
  });

  const handleAnalyze = () => {
    if (!transcript.trim()) {
      toast.error('Please enter a transcript');
      return;
    }
    analyzeMutation.mutate({ transcript });
  };

  const handleSave = () => {
    if (!result) return;
    if (!reportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    saveMutation.mutate({
      name: reportName,
      transcript,
      analysis: result
    });
  };

  const handleCopy = () => {
    if (!result) return;
    const text = formatForClipboard(result, reportName);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadExample = () => {
    setTranscript(EXAMPLE_TRANSCRIPT);
  };

  const formatForClipboard = (data: AnalysisResult, name: string) => {
    return `
Analysis Report${name ? `: ${name}` : ''}

About the Prospect:
- Job Title: ${data.aboutProspect.jobTitle}
- Industry: ${data.aboutProspect.industry}
- Company: ${data.aboutProspect.companyName}
- AI Tools (Enterprise): ${data.aboutProspect.aiToolsUsed.enterprise.join(', ') || 'None'}
- AI Tools (Other): ${data.aboutProspect.aiToolsUsed.other.join(', ') || 'None'}
- Usage: ${data.aboutProspect.aiUsageContext}

Top 3 Risks:
${data.topRisks.map(r => `- ${r}`).join('\n')}

Top 3 Challenges:
${data.topChallenges.map(c => `- ${c}`).join('\n')}

Current Security Stack:
- Tools Used: ${data.currentSecurityStack.toolsUsed.join(', ') || 'None'}
- Tools Considered: ${data.currentSecurityStack.toolsConsidered.join(', ') || 'None'}

Budget, Timeline & Priority:
${data.budgetTimelinePriority}

Urgency Drivers:
${data.urgencyDrivers}

Pitch & Demo Feedback:
${data.feedbackPoints.map(f => `- ${f}`).join('\n')}

Beta Interest:
- Level: ${data.betaInterest.interestLevel}
- Apprehensions: ${data.betaInterest.apprehensions}
- Quote: "${data.betaInterest.interestQuote}"

Top Quotes:
${data.topQuotes.map(q => `"${q}"`).join('\n\n')}

Next Steps:
${data.nextSteps.map(s => `- ${s}`).join('\n')}
    `.trim();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-purple-600 p-3 rounded-xl">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Transcript Analyzer</h1>
            <p className="text-muted-foreground">Turn call transcripts into actionable sales insights</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="new">New Analysis</TabsTrigger>
            <TabsTrigger value="saved">Saved Reports ({reports?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-6">
            {/* Input Section */}
            {!result && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Meeting Transcript</CardTitle>
                      <CardDescription>Paste your call transcript below to extract insights</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadExample}>
                      Load Example
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Paste transcript here... (e.g., [Speaker 1]: Hello...)"
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    className="min-h-[400px] font-mono text-sm"
                    disabled={analyzeMutation.isPending}
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAnalyze} 
                      disabled={!transcript.trim() || analyzeMutation.isPending}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {analyzeMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Analyze Transcript
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Section */}
            {result && (
              <div className="space-y-6">
                {/* Action Bar */}
                <div className="flex items-center justify-between bg-card p-4 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <Input
                      placeholder="Report name..."
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      className="w-64"
                    />
                    <Button onClick={handleSave} disabled={saveMutation.isPending || !reportName.trim()}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Report
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleCopy}>
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? 'Copied!' : 'Copy All'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowTranscript(!showTranscript)}>
                      <FileText className="w-4 h-4 mr-2" />
                      {showTranscript ? 'Hide' : 'View'} Transcript
                    </Button>
                    <Button variant="ghost" onClick={() => { setResult(null); setTranscript(''); }}>
                      New Analysis
                    </Button>
                  </div>
                </div>

                {/* Transcript Viewer */}
                {showTranscript && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Original Transcript
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg max-h-64 overflow-y-auto">
                        {transcript}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {/* About the Prospect */}
                <SectionCard title="About the Prospect" icon={<User className="w-5 h-5 text-purple-500" />}>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Job Title</span>
                      <p className="font-medium">{result.aboutProspect.jobTitle}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Industry</span>
                      <p className="font-medium">{result.aboutProspect.industry}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Company</span>
                      <p className="font-medium">{result.aboutProspect.companyName || 'Not mentioned'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Tools (Enterprise)</span>
                      <p className="font-medium text-purple-400">{result.aboutProspect.aiToolsUsed.enterprise.join(', ') || 'None'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Tools (Other)</span>
                      <p className="font-medium">{result.aboutProspect.aiToolsUsed.other.join(', ') || 'None'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">How AI is Being Used</span>
                      <p>{result.aboutProspect.aiUsageContext}</p>
                    </div>
                  </div>
                </SectionCard>

                {/* Risks and Challenges */}
                <div className="grid grid-cols-2 gap-6">
                  <SectionCard title="Top 3 Risks" icon={<AlertTriangle className="w-5 h-5 text-red-500" />}>
                    <ListItems items={result.topRisks} />
                  </SectionCard>
                  <SectionCard title="Top 3 Challenges" icon={<Activity className="w-5 h-5 text-orange-500" />}>
                    <ListItems items={result.topChallenges} />
                  </SectionCard>
                </div>

                {/* Security Stack and Urgency */}
                <div className="grid grid-cols-2 gap-6">
                  <SectionCard title="Current Security Stack" icon={<Shield className="w-5 h-5 text-cyan-500" />}>
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Tools Used Today</span>
                        <ListItems items={result.currentSecurityStack.toolsUsed} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Tools Considered</span>
                        <ListItems items={result.currentSecurityStack.toolsConsidered} />
                      </div>
                    </div>
                  </SectionCard>
                  <SectionCard title="Drivers of Urgency" icon={<Activity className="w-5 h-5 text-yellow-500" />}>
                    <p>{result.urgencyDrivers}</p>
                  </SectionCard>
                </div>

                {/* Budget and Feedback */}
                <SectionCard title="Budget, Timeline & Priority" icon={<DollarSign className="w-5 h-5 text-green-500" />}>
                  <p>{result.budgetTimelinePriority}</p>
                </SectionCard>

                <div className="grid grid-cols-2 gap-6">
                  <SectionCard title="Pitch & Demo Feedback" icon={<MessageSquare className="w-5 h-5 text-blue-500" />}>
                    <ListItems items={result.feedbackPoints} />
                  </SectionCard>
                  <SectionCard title="Beta Interest" icon={<Star className="w-5 h-5 text-yellow-500" />}>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Interest Level</span>
                        <p className="font-medium text-lg text-purple-400">{result.betaInterest.interestLevel}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-muted-foreground uppercase">Apprehensions</span>
                        <p>{result.betaInterest.apprehensions || 'None mentioned'}</p>
                      </div>
                      {result.betaInterest.interestQuote && (
                        <div className="bg-muted border-l-2 border-purple-500 pl-3 py-2 italic">
                          "{result.betaInterest.interestQuote}"
                        </div>
                      )}
                    </div>
                  </SectionCard>
                </div>

                {/* Top Quotes */}
                <SectionCard title="Top Quotes" icon={<Quote className="w-5 h-5 text-purple-500" />}>
                  <div className="space-y-4">
                    {result.topQuotes.map((quote, idx) => (
                      <div key={idx} className="bg-muted border-l-2 border-purple-500 pl-4 py-3 italic">
                        "{quote}"
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Additional Insights */}
                {result.additionalInsights && result.additionalInsights.length > 0 && (
                  <SectionCard title="Additional Insights" icon={<Sparkles className="w-5 h-5 text-purple-500" />}>
                    <ListItems items={result.additionalInsights} />
                  </SectionCard>
                )}

                {/* Next Steps */}
                {result.nextSteps && result.nextSteps.length > 0 && (
                  <SectionCard title="Recommended Next Steps" icon={<Activity className="w-5 h-5 text-green-500" />}>
                    <ListItems items={result.nextSteps} />
                  </SectionCard>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved" className="space-y-4">
            {reports && reports.length > 0 ? (
              reports.map((report: any) => (
                <Card key={report.id} className="cursor-pointer hover:border-purple-500 transition-colors">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{report.name}</CardTitle>
                        <CardDescription>
                          {new Date(report.createdAt).toLocaleDateString()} • {report.analysis?.aboutProspect?.companyName || 'Unknown Company'}
                        </CardDescription>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setResult(report.analysis);
                          setTranscript(report.transcript);
                          setReportName(report.name);
                          setActiveTab('new');
                        }}
                      >
                        View Report
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No saved reports yet</p>
                  <p className="text-sm text-muted-foreground">Analyze a transcript and save it to see it here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
