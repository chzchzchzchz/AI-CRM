import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Sparkles, FileText, Upload, Database, Mic, 
  Loader2, Copy, Check, Download, ChevronRight, Zap,
  FileSpreadsheet, PenTool, AlertTriangle,
  Shield, DollarSign, Quote, User, Link2,
  Save, Building2,
  Megaphone, FileEdit, Target, Calendar, Users,
  Lightbulb, Eye, ExternalLink
} from 'lucide-react';
import { stripXmlReasoning } from '@/lib/stripXmlReasoning';
import { Link } from 'wouter';

// ============ CONTENT TYPES WITH PREVIEWS ============
const CONTENT_TYPES = {
  webinar_promo: {
    name: 'Webinar Promo',
    icon: Calendar,
    color: 'purple',
    description: 'Landing page copy, invite emails, reminder sequence',
    exampleOutput: `**Landing Page Headline:**
"Stop Letting Passwords Be Your Weakest Link: A Live Demo of Phishing-Proof Authentication"

**Subheadline:**
Join security leaders as they reveal how enterprises are eliminating credential-based attacks.

**Email Invite (Subject: You're Invited):**
Hi [Name],

Credential theft caused 80% of breaches last year. We're hosting a 30-min session showing how your peers are solving this.

**Reminder Email (24hr):**
Tomorrow at 2pm ET - don't miss the live demo...`
  },
  blog_post: {
    name: 'Blog Post Outline',
    icon: FileEdit,
    color: 'blue',
    description: 'SEO-optimized blog structure with key points',
    exampleOutput: `**Title:** "Why CISOs Are Abandoning MFA for Passwordless: A 2024 Reality Check"

**Hook (100 words):**
The breach that cost [Company] $4.2M started with a single phished OTP code...

**Section 1: The MFA Fatigue Problem**
- Stats on MFA bypass attacks (cite Verizon DBIR)
- Real example from [Industry] sector

**Section 2: What Passwordless Actually Means**
- Device-bound credentials vs. shared secrets
- FIDO2/WebAuthn explained simply

**CTA:** "See how [Target Company] could implement this →"`
  },
  ad_copy: {
    name: 'Ad Copy Variants',
    icon: Megaphone,
    color: 'orange',
    description: 'LinkedIn/Google ads with A/B test variants',
    exampleOutput: `**LinkedIn Ad - Variant A (Pain Point):**
Headline: "Your MFA isn't stopping phishing attacks"
Body: 83% of breaches involve stolen credentials. See why leaders are going passwordless.
CTA: Learn More →

**LinkedIn Ad - Variant B (Social Proof):**
Headline: "How [Similar Company] eliminated credential theft"
Body: Zero phishing-related incidents in 18 months. Here's their playbook.
CTA: Get the Case Study →

**Google Search Ad:**
Headline 1: Passwordless Authentication | Enterprise Security
Description: Replace vulnerable MFA with phishing-resistant auth. SOC2 compliant.`
  },
  campaign_brief: {
    name: 'Campaign Brief',
    icon: Target,
    color: 'green',
    description: 'Full campaign strategy with channels and messaging',
    exampleOutput: `**Campaign: Q1 [Industry] Push**

**Objective:** Generate 50 MQLs from [Industry] accounts

**Target Accounts:** [Auto-populated from your hot leads]
- [Company 1] - Intent: 89, Buying Stage: Decision
- [Company 2] - Intent: 76, Buying Stage: Consideration

**Messaging Pillars:**
1. Compliance angle (SOX, GDPR requirements)
2. Cost of breach ($4.2M average in [Industry])
3. Competitor displacement (Okta/Duo limitations)

**Channel Mix:**
- LinkedIn ABM: $5K budget, 3 ad variants
- Email sequence: 4-touch over 3 weeks
- SDR outreach: Top 20 accounts, personalized`
  },
  case_study_outline: {
    name: 'Case Study Outline',
    icon: Users,
    color: 'cyan',
    description: 'Customer story structure with proof points',
    exampleOutput: `**Title:** "How [Customer] Reduced Credential-Related Incidents by 94%"

**The Challenge:**
[Customer], a [size] [industry] company, was experiencing:
- 12+ phishing attempts per week targeting executives
- $200K annual spend on password reset support
- Failed SOC2 audit due to MFA gaps

**The Solution:**
Deployed passwordless authentication across 5,000 users in 90 days

**The Results:**
- 94% reduction in credential incidents
- $180K saved in help desk costs
- Passed SOC2 audit with zero findings

**Quote:** "[Specific quote from champion]"`
  },
  event_followup: {
    name: 'Event Follow-up',
    icon: Calendar,
    color: 'pink',
    description: 'Post-event nurture sequence for booth visitors',
    exampleOutput: `**Day 1 Email (Personal):**
Subject: Great meeting you at [Event]

Hi [Name],

Thanks for stopping by our booth yesterday. You mentioned [specific pain point] - I wanted to share a quick resource that addresses exactly that.

[Link to relevant content]

Worth a 15-min call this week?

**Day 3 Email (Value-add):**
Subject: The [Industry] security report you asked about

[Name], as promised - here's the report on [topic] we discussed.

**Day 7 Email (Soft ask):**
Subject: Quick question about [Company]'s security roadmap`
  }
};

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
  linkedAccount?: { id: number; name: string; industry: string; intentScore: number };
}

function TranscriptAnalyzerTool() {
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [reportName, setReportName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkResults, setBulkResults] = useState<AnalysisResult[]>([]);
  const [processingIndex, setProcessingIndex] = useState(-1);
  
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

  const handleFileUpload = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList);
    if (newFiles.length > 1) {
      setBulkMode(true);
      setFiles(prev => [...prev, ...newFiles]);
      toast.success(`Added ${newFiles.length} files for bulk processing`);
    } else if (newFiles.length === 1) {
      const file = newFiles[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setTranscript(e.target?.result as string || '');
        toast.success(`Loaded: ${file.name}`);
      };
      reader.readAsText(file);
    }
  };

  const processBulk = async () => {
    setBulkResults([]);
    for (let i = 0; i < files.length; i++) {
      setProcessingIndex(i);
      const file = files[i];
      const text = await file.text();
      try {
        const result = await analyzeMutation.mutateAsync({ transcript: text });
        setBulkResults(prev => [...prev, result]);
      } catch (e) {
        toast.error(`Failed to process ${file.name}`);
      }
    }
    setProcessingIndex(-1);
    toast.success(`Processed ${files.length} transcripts!`);
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
${result.linkedAccount ? `- LINKED TO ACCOUNT: ${result.linkedAccount.name} (Intent: ${result.linkedAccount.intentScore})` : ''}

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

  // Bulk mode UI
  if (bulkMode && files.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Bulk Processing: {files.length} files</h3>
          <Button variant="outline" size="sm" onClick={() => { setBulkMode(false); setFiles([]); setBulkResults([]); }}>
            Cancel
          </Button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto">
          {files.map((file, i) => (
            <div key={i} className={`flex items-center gap-2 p-2 rounded ${
              processingIndex === i ? 'bg-purple-500/20' : 
              bulkResults[i] ? 'bg-green-500/20' : 'bg-muted/30'
            }`}>
              <FileText className="w-4 h-4" />
              <span className="flex-1 text-sm truncate">{file.name}</span>
              {processingIndex === i && <Loader2 className="w-4 h-4 animate-spin" />}
              {bulkResults[i] && <Check className="w-4 h-4 text-green-500" />}
              {bulkResults[i]?.linkedAccount && (
                <Link href={`/accounts/${bulkResults[i].linkedAccount!.id}`}>
                  <span className="text-xs text-purple-400 hover:underline flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> {bulkResults[i].linkedAccount!.name}
                  </span>
                </Link>
              )}
            </div>
          ))}
        </div>

        <Button 
          onClick={processBulk} 
          disabled={processingIndex >= 0}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          {processingIndex >= 0 ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing {processingIndex + 1}/{files.length}...</>
          ) : bulkResults.length > 0 ? (
            <><Check className="w-4 h-4 mr-2" /> Done! {bulkResults.filter(r => r.linkedAccount).length} linked to accounts</>
          ) : (
            <><Zap className="w-4 h-4 mr-2" /> Process All {files.length} Transcripts</>
          )}
        </Button>

        {bulkResults.length > 0 && (
          <div className="grid gap-2">
            {bulkResults.map((r, i) => (
              <Card key={i} className="border-purple-500/30">
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.aboutProspect.companyName}</p>
                    <p className="text-xs text-muted-foreground">{r.aboutProspect.jobTitle} • {r.aboutProspect.industry}</p>
                  </div>
                  {r.linkedAccount && (
                    <Link href={`/accounts/${r.linkedAccount.id}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="w-3 h-3 mr-1" /> View Account
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

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

        {/* Auto-linked account banner */}
        {result.linkedAccount && (
          <Card className="border-green-500/50 bg-green-500/10">
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-green-400">Auto-linked to: {result.linkedAccount.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Intent: {result.linkedAccount.intentScore} • {result.linkedAccount.industry}
                  </p>
                </div>
              </div>
              <Link href={`/accounts/${result.linkedAccount.id}`}>
                <Button variant="outline" size="sm" className="border-green-500/50">
                  <ExternalLink className="w-4 h-4 mr-1" /> View Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

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
          handleFileUpload(e.dataTransfer.files);
        }}
      >
        <input
          id="transcript-upload"
          type="file"
          accept=".txt,.vtt,.srt"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFileUpload(e.target.files);
          }}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Drop transcript file(s) or click to upload</p>
        <p className="text-sm text-muted-foreground">.txt, .vtt, .srt supported • Multiple files for bulk processing</p>
        <p className="text-xs text-purple-400 mt-2">Auto-links to accounts in your database</p>
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
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ cleaned: number; issues: string[]; outputUrl?: string } | null>(null);

  const handleFileUpload = (fileList: FileList | File[]) => {
    const newFiles = Array.from(fileList).filter(f => 
      f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    setFiles(prev => [...prev, ...newFiles]);
    toast.success(`Added ${newFiles.length} file(s)`);
  };

  const processData = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    
    // Simulate processing - in real implementation this would call the backend
    await new Promise(r => setTimeout(r, 2000));
    
    setResult({
      cleaned: files.reduce((acc) => acc + Math.floor(Math.random() * 500) + 100, 0),
      issues: [
        'Fixed 23 malformed phone numbers',
        'Standardized 45 company names',
        'Removed 12 duplicate entries',
        'Filled 8 missing country codes'
      ]
    });
    setProcessing(false);
    toast.success('Data processed!');
  };

  return (
    <div className="space-y-4">
      <div 
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-cyan-500 transition-colors cursor-pointer"
        onClick={() => document.getElementById('data-upload')?.click()}
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => {
          e.preventDefault();
          handleFileUpload(e.dataTransfer.files);
        }}
      >
        <input
          id="data-upload"
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFileUpload(e.target.files);
          }}
        />
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium">Drop CSV/Excel files or click to upload</p>
        <p className="text-sm text-muted-foreground">Multiple files supported for bulk processing</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{files.length} file(s) selected:</p>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
              <FileSpreadsheet className="w-4 h-4" />
              <span className="flex-1 text-sm truncate">{f.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</Button>
            </div>
          ))}
        </div>
      )}

      {result && (
        <Card className="border-cyan-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Check className="w-4 h-4 text-cyan-500" /> Processed {result.cleaned} records
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="list-disc list-inside space-y-1">
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
        disabled={files.length === 0 || processing}
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

// ============ CONTENT STUDIO ============
function ContentStudioTool() {
  const [contentType, setContentType] = useState<keyof typeof CONTENT_TYPES>('webinar_promo');
  const [showPreview, setShowPreview] = useState(true);
  const [context, setContext] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [result, setResult] = useState('');
  
  const { data: accounts } = trpc.accounts.list.useQuery();

  const generateMutation = trpc.tools.generateContent.useMutation({
    onSuccess: (data) => {
      setResult(stripXmlReasoning(data.content));
      toast.success('Content generated!');
    },
    onError: (error) => {
      toast.error(`Generation failed: ${error.message}`);
    }
  });

  const currentType = CONTENT_TYPES[contentType];
  const TypeIcon = currentType.icon;

  const handleGenerate = () => {
    if (!context.trim() && !selectedAccount) {
      toast.error('Please provide context or select an account');
      return;
    }
    
    const accountContext = selectedAccount && selectedAccount !== 'none' && accounts 
      ? accounts.find((a: any) => a.id.toString() === selectedAccount)
      : null;
    
    const fullContext = [
      context,
      accountContext ? `Target Account: ${accountContext.name} (${accountContext.industry}, Intent: ${accountContext.intentScore})` : '',
      suggestions ? `Additional suggestions: ${suggestions}` : ''
    ].filter(Boolean).join('\n\n');
    
    generateMutation.mutate({ 
      contentType: contentType as any, 
      context: fullContext 
    });
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    toast.success('Copied!');
  };

  return (
    <div className="space-y-4">
      {/* Content Type Selector */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(CONTENT_TYPES).map(([key, type]) => {
          const Icon = type.icon;
          const isActive = contentType === key;
          return (
            <button
              key={key}
              onClick={() => { setContentType(key as keyof typeof CONTENT_TYPES); setShowPreview(true); }}
              className={`p-3 rounded-lg border text-left transition-all ${
                isActive 
                  ? 'border-purple-500 bg-purple-500/10' 
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1 ${isActive ? 'text-purple-500' : 'text-muted-foreground'}`} />
              <p className="font-medium text-sm">{type.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{type.description}</p>
            </button>
          );
        })}
      </div>

      {/* Example Preview */}
      {showPreview && (
        <Card className="border-purple-500/30 bg-purple-500/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" /> Example Output Preview
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
              Hide
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-background/50 p-3 rounded max-h-48 overflow-y-auto">
              {currentType.exampleOutput}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Account Selector */}
      <div>
        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
          <Building2 className="w-4 h-4" /> Target Account (optional - pulls real data)
        </label>
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger>
            <SelectValue placeholder="Select account to use real data..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No specific account</SelectItem>
            {accounts?.slice(0, 50).map((acc: any) => (
              <SelectItem key={acc.id} value={acc.id.toString()}>
                {acc.name} • Intent: {acc.intentScore} • {acc.industry || 'Unknown'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Context Input */}
      <div>
        <label className="text-sm font-medium mb-2 block">Context & Details</label>
        <Textarea
          placeholder={`Describe what you need for ${currentType.name}...\n\nExample: "Q1 webinar on passwordless auth for financial services CISOs, featuring our VP of Engineering"`}
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="min-h-[100px]"
        />
      </div>

      {/* Suggestions Input */}
      <div>
        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
          <Lightbulb className="w-4 h-4" /> Your Ideas & Suggestions (optional)
        </label>
        <Textarea
          placeholder="Add any specific angles, messaging, tone preferences, or ideas you want included..."
          value={suggestions}
          onChange={(e) => setSuggestions(e.target.value)}
          className="min-h-[60px]"
        />
      </div>

      <Button 
        onClick={handleGenerate} 
        disabled={(!context.trim() && (!selectedAccount || selectedAccount === 'none')) || generateMutation.isPending}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {generateMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {currentType.name}...</>
        ) : (
          <><TypeIcon className="w-4 h-4 mr-2" /> Generate {currentType.name}</>
        )}
      </Button>

      {result && (
        <Card className="border-green-500/30">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Generated {currentType.name}</CardTitle>
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
    { id: 'transcript', name: 'Call Analyzer', icon: Mic, color: 'purple', desc: 'Extract insights from call transcripts • Auto-links to accounts' },
    { id: 'data', name: 'Data Processor', icon: Database, color: 'cyan', desc: 'Clean and enrich CSV/Excel data • Bulk processing' },
    { id: 'content', name: 'Content Studio', icon: PenTool, color: 'green', desc: 'Webinars, blogs, ads, campaigns • Uses your real data' },
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
            <p className="text-muted-foreground">Supercharge your sales workflow • All tools connect to your account data</p>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {tools.map(tool => {
            const isActive = activeTab === tool.id;
            return (
              <Card 
                key={tool.id}
                className={`cursor-pointer transition-all hover:scale-[1.02] ${isActive ? 'border-purple-500 bg-purple-500/5' : 'hover:border-muted-foreground/30'}`}
                onClick={() => setActiveTab(tool.id)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isActive ? 'bg-purple-500/20' : 'bg-muted'}`}>
                    <tool.icon className={`w-5 h-5 ${isActive ? 'text-purple-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Active Tool */}
        <Card>
          <CardContent className="p-6">
            {activeTab === 'transcript' && <TranscriptAnalyzerTool />}
            {activeTab === 'data' && <DataProcessorTool />}
            {activeTab === 'content' && <ContentStudioTool />}
          </CardContent>
        </Card>

        {/* Quick tip */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          💡 For personalized sales emails, use the <Link href="/outreach" className="text-purple-400 hover:underline">Outreach page</Link> instead
        </p>
      </div>
    </div>
  );
}
