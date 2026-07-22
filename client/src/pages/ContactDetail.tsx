import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, ExternalLink, Building2, Phone, Mail, MapPin, Linkedin,
  Sparkles, Copy, Check, User, Loader2, RefreshCw, ChevronRight, Flame
} from "lucide-react";
import { Link, useParams } from "wouter";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { toast } from "sonner";

// Heat pairs a tinted colour with a word + shape so it never relies on colour alone.
function heatMeta(score: number): { label: string; cls: string; hot: boolean } {
  if (score >= 80) return { label: "Hot", cls: "text-red-400", hot: true };
  if (score >= 60) return { label: "Warm", cls: "text-amber-400", hot: false };
  if (score >= 40) return { label: "Cool", cls: "text-blue-400", hot: false };
  return { label: "Cold", cls: "text-slate-400", hot: false };
}

function stageMeta(stage: string): { cls: string } {
  switch (stage) {
    case "Purchase": return { cls: "text-emerald-400" };
    case "Decision": return { cls: "text-blue-400" };
    case "Consideration": return { cls: "text-amber-400" };
    case "Awareness": return { cls: "text-slate-300" };
    default: return { cls: "text-slate-400" };
  }
}

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
      // Only strip standalone horizontal rules. A bare /---+/ also ate the
      // separator row of every markdown table (|---|---|), which silently
      // disabled GFM table rendering across the app.
      .replace(/^\s*-{3,}\s*$/gm, '')
      .trim();
    const outputMatch = clean.match(/OUTPUT[:\s]*([\s\S]*?)(?:$|---)/i);
    if (outputMatch) clean = outputMatch[1].trim();
    return clean;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-6 max-w-5xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid md:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => <div key={i} className="h-40 bg-muted rounded" />)}
            </div>
            <div className="h-56 bg-muted rounded" />
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
  const heat = heatMeta(intentScore);
  const accountStage = (account as any)?.sixsenseBuyingStage as string | undefined;
  const stage = stageMeta(accountStage || '');

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <AIAssistant context={{ type: "contact", id: personId, name: contact.name || undefined }} />

      <div className="container py-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/contacts"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            {/* Contact avatar — purple is the identity accent */}
            <div className="hidden sm:flex w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/25 items-center justify-center flex-shrink-0 text-purple-300 font-semibold text-lg">
              {(contact.name || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight truncate">{contact.name}</h1>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400 mt-0.5">
                {contact.title && <span className="text-slate-300">{contact.title}</span>}
                {contact.company && (
                  <Link href={account ? `/accounts/${account.id}` : '#'}
                        className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
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
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {contact.phone && (
              <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-400" asChild>
                <a href={`tel:${contact.phone}`}><Phone className="mr-1 h-4 w-4" />Call</a>
              </Button>
            )}
            {contact.email && (
              <Button size="sm" className="bg-cyan-500 text-slate-950 hover:bg-blue-500" asChild>
                <a href={`mailto:${contact.email}`}><Mail className="mr-1 h-4 w-4" />Email</a>
              </Button>
            )}
            {contact.linkedinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={contact.linkedinUrl} target="_blank"><Linkedin className="mr-1 h-4 w-4" />LinkedIn</a>
              </Button>
            )}
            {(contact as any).sfdcContactId && (
              <Button size="sm" variant="outline" className="border-blue-500 text-blue-400" asChild>
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
          <Card className="border-slate-800 bg-slate-900 shadow-none">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-purple-400" />
                Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 divide-y divide-slate-800">
              {contact.title && (
                <div className="flex justify-between items-center gap-3 py-2.5 first:pt-0">
                  <span className="text-sm text-slate-400">Title</span>
                  <span className="font-medium text-sm text-right">{contact.title}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex justify-between items-center gap-3 py-2.5 first:pt-0">
                  <span className="text-sm text-slate-400">Email</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{contact.email}</span>
                    <button onClick={() => copyToClipboard(contact.email!, 'email')} aria-label="Copy email address" className="p-1 hover:bg-slate-800 rounded shrink-0">
                      {copiedField === 'email' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
                    </button>
                  </div>
                </div>
              )}
              {contact.phone && (
                <div className="flex justify-between items-center gap-3 py-2.5 first:pt-0">
                  <span className="text-sm text-slate-400">Phone</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-sm">{contact.phone}</span>
                    <button onClick={() => copyToClipboard(contact.phone!, 'phone')} aria-label="Copy phone number" className="p-1 hover:bg-slate-800 rounded shrink-0">
                      {copiedField === 'phone' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
                    </button>
                  </div>
                </div>
              )}
              {contact.linkedinUrl && (
                <div className="flex justify-between items-center gap-3 py-2.5 first:pt-0">
                  <span className="text-sm text-slate-400">LinkedIn</span>
                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm">
                    View Profile <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Context — a compact echo of the account signal card */}
          <Card className="border-slate-800 bg-slate-900 shadow-none">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  Account Context
                </span>
                {account && (
                  <Link href={`/accounts/${account.id}`} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    View Account <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {account ? (
                <div className="space-y-3">
                  {/* Intent — cyan mono, with heat glyph + word */}
                  <div className="flex items-end justify-between gap-3 rounded-lg bg-slate-800/60 p-3">
                    <div>
                      <div className="text-xs text-slate-400">Intent score</div>
                      <div className="flex items-end gap-1.5">
                        <span className="font-mono tabular-nums text-3xl font-semibold leading-none text-cyan-400">{intentScore}</span>
                        <span className="mb-0.5 font-mono text-xs text-slate-400">/ 100</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-700/60 px-2.5 py-1 text-xs font-medium ${heat.cls}`}>
                      {heat.hot
                        ? <Flame className="h-3 w-3" />
                        : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      {heat.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm text-slate-400">Company</span>
                    <span className="font-medium text-sm text-right">{account.name}</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-sm text-slate-400">Buying Stage</span>
                    {accountStage ? (
                      <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium ${stage.cls}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {accountStage}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Unknown</span>
                    )}
                  </div>
                  {account.industry && (
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-sm text-slate-400">Industry</span>
                      <span className="font-medium text-sm text-right">{account.industry}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No linked account</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI Contact Brief */}
        <Card className="border-slate-800 bg-slate-900 shadow-none">
          <CardHeader className="px-6 pt-1">
            <CardTitle className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-base font-semibold">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  AI Contact Brief
                  {contact.linkedinUrl && (
                    <Badge variant="outline" className="text-[11px] font-normal gap-1 border-slate-700 text-slate-300">
                      <Linkedin className="h-3 w-3 text-blue-400" /> LinkedIn available
                    </Badge>
                  )}
                </span>
                <span className="mt-1 block text-xs font-normal text-slate-400">
                  {contact.linkedinUrl
                    ? "Synthesised from this contact's role and LinkedIn profile."
                    : "Add a LinkedIn profile to enrich this brief."}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
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
          <CardContent className="px-6">
            {isGenerating ? (
              <div className="space-y-2.5 py-1">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  {contact.linkedinUrl ? 'Analyzing LinkedIn profile…' : 'Generating summary…'}
                </div>
                <div className="animate-pulse space-y-2 pt-1">
                  <div className="h-3 w-11/12 rounded bg-slate-800" />
                  <div className="h-3 w-full rounded bg-slate-800" />
                  <div className="h-3 w-8/12 rounded bg-slate-800" />
                </div>
              </div>
            ) : aiSummary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-cyan-400">
                <SafeStreamdown>{extractFinalOutput(aiSummary)}</SafeStreamdown>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-800 py-8 text-center">
                <Sparkles className="h-7 w-7 mx-auto mb-2 text-slate-600" />
                <p className="text-sm text-slate-400">No brief generated yet</p>
                <p className="text-xs mt-1 text-slate-500">
                  {contact.linkedinUrl
                    ? 'Generate one to pull in insights from the LinkedIn profile.'
                    : 'A LinkedIn profile is needed to generate a brief.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
