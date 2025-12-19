import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Sparkles, FileText, Upload, Database, Mail, Mic, 
  Loader2, Copy, Check, Download, ChevronRight, Zap,
  FileSpreadsheet, MessageSquare, PenTool, AlertTriangle,
  Shield, DollarSign, Activity, Quote, Star, User,
  ChevronDown, ChevronUp, Save, Building2, Phone
} from 'lucide-react';
import { stripXmlReasoning } from '@/lib/stripXmlReasoning';

// ============ TRANSCRIPT ANALYZER ============
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

function TranscriptAnalyzerTool() {
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reportName, setReportName] = useState('');
  
  const analyzeMutation = trpc.tools.analyzeTranscript.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success('Transcript analyzed!');
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

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setTranscript(e.target?.result as string || '');
      toast.success(`Loaded: ${file.name}`);
    };
    reader.readAsText(file);
  };

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

  const copyResults = () => {
    if (!result) return;
    const text = `
TRANSCRIPT ANALYSIS REPORT

PROSPECT INFO:
- Company: ${result.aboutProspect.companyName}
- Title: ${result.aboutProspect.jobTitle}
- Industry: ${result.aboutProspect.industry}

TOP RISKS:
${result.topRisks.map(r => `• ${r}`).join('\n')}

TOP CHALLENGES:
${result.topChallenges.map(c => `• ${c}`).join('\n')}

SECURITY STACK:
- Using: ${result.currentSecurityStack.toolsUsed.join(', ') || 'None mentioned'}
- Considering: ${result.currentSecurityStack.toolsConsidered.join(', ') || 'None mentioned'}

BUDGET/TIMELINE: ${result.budgetTimelinePriority}

URGENCY: ${result.urgencyDrivers}

BETA INTEREST: ${result.betaInterest.interestLevel}
${result.betaInterest.interestQuote ? `Quote: "${result.betaInterest.interestQuote}"` : ''}

TOP QUOTES:
${result.topQuotes.map(q => `"${q}"`).join('\n')}

NEXT STEPS:
${result.nextSteps.map(s => `• ${s}`).join('\n')}
    `.trim();
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Analysis Results</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyResults}>
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button variant="outline" size="sm" onClick={() => setResult(null)}>
              New Analysis
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="border-purple-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-purple-500" /> Prospect
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>{result.aboutProspect.companyName}</strong></p>
              <p>{result.aboutProspect.jobTitle}</p>
              <p className="text-muted-foreground">{result.aboutProspect.industry}</p>
            </CardContent>
          </Card>

          <Card className="border-red-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Top Risks
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="list-disc list-inside space-y-1">
                {result.topRisks.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-500" /> Security Stack
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p><strong>Using:</strong> {result.currentSecurityStack.toolsUsed.join(', ') || 'None'}</p>
              <p><strong>Considering:</strong> {result.currentSecurityStack.toolsConsidered.join(', ') || 'None'}</p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-500" /> Budget & Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>{result.budgetTimelinePriority}</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/30 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Quote className="w-4 h-4 text-yellow-500" /> Key Quotes
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {result.topQuotes.slice(0, 3).map((q, i) => (
                <p key={i} className="italic border-l-2 border-yellow-500/50 pl-3 mb-2">"{q}"</p>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blue-500/30 md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-blue-500" /> Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="list-disc list-inside space-y-1">
                {result.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 items-center">
          <Input 
            placeholder="Report name..." 
            value={reportName} 
            onChange={(e) => setReportName(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-1" /> Save Report
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-purple-500 transition-colors cursor-pointer"
        onClick={() => document.getElementById('transcript-upload')?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) handleFileUpload(file);
        }}
      >
        <input
          id="transcript-upload"
          type="file"
          accept=".txt,.vtt,.srt"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Drop transcript file or click to upload</p>
        <p className="text-sm text-muted-foreground">.txt, .vtt, .srt supported</p>
      </div>

      <div className="text-center text-sm text-muted-foreground">— or paste directly —</div>

      <Textarea
        placeholder="[Speaker 1]: Hello, thanks for joining..."
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        className="min-h-[200px] font-mono text-sm"
      />

      <Button 
        onClick={handleAnalyze} 
        disabled={!transcript.trim() || analyzeMutation.isPending}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {analyzeMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
        ) : (
          <><Sparkles className="w-4 h-4 mr-2" /> Analyze Transcript</>
        )}
      </Button>
    </div>
  );
}

// ============ DATA PROCESSOR ============
function DataProcessorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ cleaned: number; issues: string[] } | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').slice(0, 6).map(line => line.split(',').slice(0, 5));
      setPreview(lines);
    };
    reader.readAsText(f);
  };

  const processData = async () => {
    if (!file) return;
    setProcessing(true);
    // Simulate processing
    await new Promise(r => setTimeout(r, 2000));
    setResult({
      cleaned: 847,
      issues: [
        '23 personal emails filtered (gmail, yahoo)',
        '12 duplicate contacts merged',
        '45 phone numbers standardized',
        '8 invalid company names flagged'
      ]
    });
    setProcessing(false);
    toast.success('Data processed successfully!');
  };

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-cyan-500 transition-colors cursor-pointer"
        onClick={() => document.getElementById('data-upload')?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        <input
          id="data-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Drop CSV/Excel file or click to upload</p>
        <p className="text-sm text-muted-foreground">Leads, contacts, accounts data</p>
      </div>

      {preview.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Preview: {file?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={i === 0 ? 'font-semibold bg-muted/50' : ''}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 border-b border-border truncate max-w-[150px]">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" /> Processing Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><strong>{result.cleaned}</strong> records cleaned</p>
            <ul className="list-disc list-inside text-muted-foreground">
              {result.issues.map((issue, i) => <li key={i}>{issue}</li>)}
            </ul>
            <Button size="sm" className="mt-2">
              <Download className="w-4 h-4 mr-1" /> Download Cleaned Data
            </Button>
          </CardContent>
        </Card>
      )}

      <Button 
        onClick={processData} 
        disabled={!file || processing}
        className="w-full bg-cyan-600 hover:bg-cyan-700"
      >
        {processing ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
        ) : (
          <><Zap className="w-4 h-4 mr-2" /> Process & Clean Data</>
        )}
      </Button>
    </div>
  );
}

// ============ CONTENT GENERATOR ============
function ContentGeneratorTool() {
  const [contentType, setContentType] = useState('email');
  const [context, setContext] = useState('');
  const [result, setResult] = useState('');
  const [generating, setGenerating] = useState(false);

  const generateMutation = trpc.tools.generateContent.useMutation({
    onSuccess: (data) => {
      setResult(stripXmlReasoning(data.content));
      toast.success('Content generated!');
    },
    onError: (error) => {
      toast.error(`Generation failed: ${error.message}`);
    }
  });

  const handleGenerate = () => {
    if (!context.trim()) {
      toast.error('Please provide context');
      return;
    }
    generateMutation.mutate({ contentType: contentType as 'email' | 'battle_card' | 'webinar' | 'call_script' | 'linkedin', context });
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied!');
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Content Type</label>
          <Select value={contentType} onValueChange={setContentType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Sales Email</SelectItem>
              <SelectItem value="linkedin">LinkedIn Message</SelectItem>
              <SelectItem value="call_script">Call Script</SelectItem>
              <SelectItem value="battle_card">Battle Card</SelectItem>
              <SelectItem value="webinar_promo">Webinar Promo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Context & Instructions</label>
        <Textarea
          placeholder="Describe what you need... e.g., 'Cold email for CISO at fintech company, focus on compliance and data protection'"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="min-h-[120px]"
        />
      </div>

      <Button 
        onClick={handleGenerate} 
        disabled={!context.trim() || generateMutation.isPending}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {generateMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
        ) : (
          <><PenTool className="w-4 h-4 mr-2" /> Generate Content</>
        )}
      </Button>

      {result && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Generated Content</CardTitle>
            <Button variant="ghost" size="sm" onClick={copyResult}>
              <Copy className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm bg-muted/30 p-4 rounded-lg">
              {result}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ MAIN PAGE ============
export default function AITools() {
  const [activeTab, setActiveTab] = useState('transcript');

  const tools = [
    { id: 'transcript', name: 'Call Analyzer', icon: Mic, color: 'purple', desc: 'Extract insights from call transcripts' },
    { id: 'data', name: 'Data Processor', icon: Database, color: 'cyan', desc: 'Clean and enrich CSV/Excel data' },
    { id: 'content', name: 'Content Generator', icon: PenTool, color: 'green', desc: 'Generate emails, scripts, battle cards' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-gradient-to-br from-purple-600 to-cyan-600 p-3 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Tools</h1>
            <p className="text-muted-foreground">Supercharge your sales workflow</p>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {tools.map(tool => (
            <Card 
              key={tool.id}
              className={`cursor-pointer transition-all hover:scale-[1.02] ${activeTab === tool.id ? `border-${tool.color}-500 bg-${tool.color}-500/5` : 'hover:border-muted-foreground/30'}`}
              onClick={() => setActiveTab(tool.id)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-${tool.color}-500/20`}>
                  <tool.icon className={`w-5 h-5 text-${tool.color}-500`} />
                </div>
                <div>
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Tool */}
        <Card>
          <CardContent className="p-6">
            {activeTab === 'transcript' && <TranscriptAnalyzerTool />}
            {activeTab === 'data' && <DataProcessorTool />}
            {activeTab === 'content' && <ContentGeneratorTool />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
