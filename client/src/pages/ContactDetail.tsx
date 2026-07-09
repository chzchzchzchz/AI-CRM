import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, ExternalLink, Building2, Phone, Mail, MapPin, Linkedin, 
  Sparkles, Copy, Check, User, TrendingUp, Loader2, RefreshCw, ChevronRight
} from "lucide-react";
import { Link, useParams } from "wouter";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { toast } from "sonner";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const personId = parseInt(id || "0");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: contact, isLoading } = trpc.people.getById.useQuery(
    { id: personId },
    { enabled: personId > 0 }
  );

  const { data: account } = trpc.accounts.getById.useQuery(
    { id: contact?.accountId || 0 },
    { enabled: !!contact?.accountId }
  );

  const { data: salesforceInstanceUrl } = trpc.salesforce.getInstanceUrl.useQuery();

  // AI Summary
  const summaryMutation = trpc.ai.generateContactSummary.useMutation();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateSummary = async () => {
    if (!contact?.linkedinUrl) {
      toast.error("No LinkedIn profile available for this contact");
      return;
    }
    setIsGenerating(true);
    try {
      const summary = await summaryMutation.mutateAsync({ 
        contactId: personId,
        includeLinkedIn: true 
      });
      setAiSummary(summary);
      toast.success("AI summary generated from LinkedIn!");
    } catch (error) {
      toast.error("Failed to generate summary");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Extract final AI output (hide reasoning)
  const extractFinalOutput = (text: string | null | undefined): string => {
    if (!text) return '';
    let clean = text
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      .replace(/<strategy>[\s\S]*?<\/strategy>/gi, '')
      .replace(/<notes>[\s\S]*?<\/notes>/gi, '')
      .replace(/---+/g, '')
      .trim();
    const outputMatch = clean.match(/OUTPUT[:\s]*([\s\S]*?)(?:$|---)/i);
    if (outputMatch) clean = outputMatch[1].trim();
    return clean;
  };

  const getIntentColor = (score: number) => {
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-gray-500';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-6 max-w-5xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!contact) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-12 max-w-2xl text-center">
          <User className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Contact not found</h3>
          <Button asChild><Link href="/contacts"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        </div>
      </div>
    );
  }

  const intentScore = account?.intentScore || 0;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <AIAssistant context={{ type: "contact", id: personId, name: contact.name || undefined }} />

      <div className="container py-6 space-y-6 max-w-5xl">
        {/* Compact Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/contacts"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold truncate">{contact.name}</h1>
                {contact.title && (
                  <Badge variant="outline" className="hidden sm:inline-flex">{contact.title}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {contact.title && <span className="sm:hidden">{contact.title}</span>}
                {contact.company && (
                  <Link href={account ? `/accounts/${account.id}` : '#'} 
                        className="flex items-center gap-1 hover:text-primary">
                    <Building2 className="h-3 w-3" />{contact.company}
                  </Link>
                )}
                {contact.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />{contact.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {contact.phone && (
              <Button size="sm" variant="outline" className="border-green-500 text-green-500" asChild>
                <a href={`tel:${contact.phone}`}><Phone className="mr-1 h-4 w-4" />Call</a>
              </Button>
            )}
            {contact.email && (
              <Button size="sm" className="gradient-primary text-white" asChild>
                <a href={`mailto:${contact.email}`}><Mail className="mr-1 h-4 w-4" />Email</a>
              </Button>
            )}
            {contact.linkedinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={contact.linkedinUrl} target="_blank"><Linkedin className="mr-1 h-4 w-4" />LinkedIn</a>
              </Button>
            )}
            {(contact as any).sfdcContactId && (
              <Button size="sm" variant="outline" className="border-blue-500 text-blue-500" asChild>
                <a href={`${salesforceInstanceUrl || 'https://login.salesforce.com'}/lightning/r/Contact/${(contact as any).sfdcContactId}/view`} target="_blank">
                  <ExternalLink className="mr-1 h-4 w-4" />Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Contact Info + Account Context Row */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Contact Details */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-purple-500" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {contact.title && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Title</span>
                  <span className="font-medium">{contact.title}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{contact.email}</span>
                    <button onClick={() => copyToClipboard(contact.email!, 'email')} className="p-1 hover:bg-muted rounded">
                      {copiedField === 'email' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              )}
              {contact.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.phone}</span>
                    <button onClick={() => copyToClipboard(contact.phone!, 'phone')} className="p-1 hover:bg-muted rounded">
                      {copiedField === 'phone' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              )}
              {contact.linkedinUrl && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">LinkedIn</span>
                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-blue-500 hover:underline text-sm">
                    View Profile <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Context */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-500" />
                  Account Context
                </span>
                {account && (
                  <Link href={`/accounts/${account.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                    View Account <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {account ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Company</span>
                    <span className="font-medium">{account.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Intent Score</span>
                    <span className={`font-bold text-lg ${getIntentColor(intentScore)}`}>
                      {intentScore}
                      <span className="text-xs ml-1">
                        {intentScore >= 80 ? '🔥' : intentScore >= 60 ? '🌡️' : '❄️'}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Buying Stage</span>
                    <Badge variant="outline">{(account as any).buyingStage || 'Unknown'}</Badge>
                  </div>
                  {account.industry && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Industry</span>
                      <span className="font-medium">{account.industry}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No linked account</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Summary with LinkedIn */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                AI Contact Brief
                {contact.linkedinUrl && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Linkedin className="h-3 w-3" /> LinkedIn Available
                  </Badge>
                )}
              </span>
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleGenerateSummary}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                {aiSummary ? 'Regenerate' : 'Generate'} Brief
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isGenerating ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                {contact.linkedinUrl ? 'Analyzing LinkedIn profile...' : 'Generating summary...'}
              </div>
            ) : aiSummary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <SafeStreamdown>{extractFinalOutput(aiSummary)}</SafeStreamdown>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click "Generate Brief" to create an AI-powered summary</p>
                {contact.linkedinUrl && (
                  <p className="text-xs mt-1">Will include insights from LinkedIn profile</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
