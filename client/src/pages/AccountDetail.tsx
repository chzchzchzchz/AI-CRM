import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, ExternalLink, Users, TrendingUp, Building2,
  Sparkles, Copy, Check, Flame, Mail, Linkedin, Globe,
  Loader2, ChevronRight, Shield, AlertTriangle, RefreshCw, BrainCircuit,
  ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import { Link, useParams } from "wouter";
import { SafeStreamdown } from "@/components/SafeStreamdown";
import { toast } from "sonner";

// --- Signal helpers -------------------------------------------------------
// Heat pairs a tinted color with a word + shape/glyph so it survives greyscale
// and colour blindness (never colour alone).
function heatMeta(score: number): { label: string; cls: string; hot: boolean } {
  if (score >= 80) return { label: "Hot", cls: "text-red-400", hot: true };
  if (score >= 60) return { label: "Warm", cls: "text-amber-400", hot: false };
  if (score >= 40) return { label: "Cool", cls: "text-blue-400", hot: false };
  return { label: "Cold", cls: "text-slate-400", hot: false };
}

// Buying-stage colour is a status, not a signal — cyan stays reserved for the
// AI/intent voice, so stages map to the status ramp instead.
function stageMeta(stage: string): { cls: string } {
  switch (stage) {
    case "Purchase": return { cls: "text-emerald-400" };
    case "Decision": return { cls: "text-blue-400" };
    case "Consideration": return { cls: "text-amber-400" };
    case "Awareness": return { cls: "text-slate-300" };
    default: return { cls: "text-slate-400" };
  }
}

export default function AccountDetailEnhanced() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });
  const { data: people } = trpc.people.getByAccountId.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

  // AI Intelligence queries — deferred until the account has loaded so they don't
  // join the initial request batch and block the core page render on slow LLM calls.
  const overviewQuery = trpc.ai.compileOverview.useQuery({ accountId }, { enabled: accountId > 0 && !!account });
  const { data: salesforceInstanceUrl } = trpc.salesforce.getInstanceUrl.useQuery();
  const { data: accountOpportunities } = trpc.opportunities.getByAccountId.useQuery({ accountId }, { enabled: accountId > 0 });
  const { data: intentSignals } = trpc.intentScores.list.useQuery({ accountId }, { enabled: accountId > 0 && !!account });

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Parse rawData for additional fields
  const rawData = (account?.rawData as Record<string, any>) || {};
  const accountOwner = rawData.accountOwner || rawData.owner;
  const ssoProvider = rawData['SSO Provider'];
  const mfaSolution = rawData['MFA Solution'];
  const securityIncidents = rawData['Recent Security Incidents'];
  const competitorIntent = rawData['Competitor MFA Intent'];

  const getIntentColor = (score: number) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-blue-400';
    return 'text-slate-400';
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-6 max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="h-40 bg-muted rounded" />
            <div className="grid md:grid-cols-3 gap-6">
              <div className="h-96 bg-muted rounded md:col-span-1" />
              <div className="h-96 bg-muted rounded md:col-span-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not found state
  if (!account) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container py-12 max-w-2xl text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Account not found</h3>
          <Button asChild><Link href="/accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        </div>
      </div>
    );
  }

  const intentScore = account.intentScore || 0;
  // Prefer the real 6sense stage (column: sixsenseBuyingStage); fall back to an intent-band
  // inference only when it is genuinely absent. Reading `.buyingStage` — which is not a
  // column — meant the real stage was never shown and every account looked "Inferred".
  const realBuyingStage = (account as any).sixsenseBuyingStage as string | null | undefined;
  const buyingStage = realBuyingStage || (
    intentScore >= 86 ? 'Purchase' :
    intentScore >= 70 ? 'Decision' :
    intentScore >= 50 ? 'Consideration' :
    intentScore >= 20 ? 'Awareness' : 'Target'
  );

  const heat = heatMeta(intentScore);
  const stage = stageMeta(buyingStage);
  const profileFit = (account as any).sixsenseProfileFit as string | undefined;

  // Intent trend: compare the two most recent signals. Real numbers only — null
  // when there isn't enough history to compute a delta.
  const intentTrend =
    intentSignals && intentSignals.length >= 2
      ? intentSignals[0].score - intentSignals[1].score
      : null;

  // Pipeline is summed from real opportunity amounts.
  const openDeals = accountOpportunities?.length || 0;
  const pipelineValue = accountOpportunities?.reduce((sum: number, o: any) => sum + Number(o.amount || 0), 0) || 0;

  // "Why now" is composed strictly from fields we actually have. If nothing is
  // recorded we say so plainly rather than inventing a narrative.
  const whyNowParts: string[] = [];
  whyNowParts.push(`${buyingStage} stage${realBuyingStage ? '' : ' (inferred from intent)'}`);
  if (profileFit) whyNowParts.push(`${profileFit} profile fit`);
  if (intentSignals && intentSignals.length > 0) {
    const latest = intentSignals[0];
    const d = new Date(latest.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    whyNowParts.push(`latest signal ${d}${latest.category ? ` · ${latest.category}` : ''}`);
  }
  const whyNow = whyNowParts.join(' · ');
  const hasSignalActivity = !!(intentSignals && intentSignals.length > 0);

  // Extract final AI output (hide reasoning)
  const extractFinalOutput = (text: string | null | undefined): string => {
    if (!text) return '';
    // Remove XML tags and reasoning sections
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
    // If there's an OUTPUT section, extract just that
    const outputMatch = clean.match(/OUTPUT[:\s]*([\s\S]*?)(?:$|---)/i);
    if (outputMatch) clean = outputMatch[1].trim();
    return clean;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <AIAssistant context={{ type: 'account', id: accountId, name: account.name }} />

      <div className="container py-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/accounts"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            {/* Company Logo */}
            <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden">
              <img
                src={`https://logo.clearbit.com/${account.domain}`}
                alt={`${account.name} logo`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement!.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-400 font-bold text-xl">${account.name.charAt(0)}</div>`;
                }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight truncate">{account.name}</h1>
                {/* Stage badge: colour + word + shape */}
                <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium ${stage.cls}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {buyingStage}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400 mt-0.5">
                {account.domain && (
                  <a href={`https://${account.domain}`} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
                    <Globe className="h-3 w-3" />{account.domain}
                  </a>
                )}
                {account.industry && <span>{account.industry}</span>}
                {account.employeeCount && (
                  <span><span className="font-mono tabular-nums text-slate-300">{Number(account.employeeCount).toLocaleString()}</span> employees</span>
                )}
                {accountOwner && <span>Owner: {accountOwner}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <Button size="sm" className="bg-cyan-500 text-slate-950 hover:bg-blue-500" asChild>
              <Link href="/outreach"><Mail className="mr-1 h-4 w-4" />Outreach</Link>
            </Button>
            {account.linkedinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={account.linkedinUrl} target="_blank"><Linkedin className="mr-1 h-4 w-4" />LinkedIn</a>
              </Button>
            )}
            {(account as any).sfdcAccountId && (
              <Button size="sm" variant="outline" className="border-blue-500 text-blue-400" asChild>
                <a href={`${salesforceInstanceUrl || 'https://login.salesforce.com'}/lightning/r/Account/${(account as any).sfdcAccountId}/view`} target="_blank">
                  <ExternalLink className="mr-1 h-4 w-4" />Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Signature Account Signal band — the one clear read, evidence a glance away */}
        <Card className="border-slate-800 bg-slate-900 shadow-none">
          <CardContent className="px-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,auto)_1fr]">
              {/* Intent score — the signal, in cyan mono */}
              <div className="flex items-start gap-5 lg:border-r lg:border-slate-800 lg:pr-8">
                <div>
                  <div className="text-xs text-slate-400">Intent score</div>
                  <div className="flex items-end gap-2">
                    <span className="font-mono tabular-nums text-6xl font-semibold leading-none text-cyan-400">{intentScore}</span>
                    <span className="mb-1 font-mono text-sm text-slate-400">/ 100</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium ${heat.cls}`}>
                      {heat.hot
                        ? <Flame className="h-3 w-3" />
                        : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      {heat.label}
                    </span>
                    {intentTrend !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 font-mono text-xs ${
                          intentTrend > 0 ? 'text-emerald-400' : intentTrend < 0 ? 'text-red-400' : 'text-slate-400'
                        }`}
                        title="Change vs. the previous recorded signal"
                      >
                        {intentTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : intentTrend < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {intentTrend > 0 ? '+' : ''}{intentTrend}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    {realBuyingStage ? '6sense' : 'Inferred from intent band'}
                  </div>
                </div>
              </div>

              {/* Why now + supporting facts */}
              <div className="min-w-0 space-y-4">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Why now</div>
                  {hasSignalActivity ? (
                    <p className="text-sm text-slate-100 leading-relaxed">{whyNow}</p>
                  ) : (
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {whyNow}. No 6sense signal activity recorded yet.
                    </p>
                  )}
                </div>

                {/* Fact strip — hairline-separated, differentiated by value type */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg bg-slate-800">
                  <div className="bg-slate-900 p-3">
                    <div className="text-xs text-slate-400">Profile fit</div>
                    <div className="mt-1 text-base font-medium text-slate-100">{profileFit || 'Unknown'}</div>
                  </div>
                  <div className="bg-slate-900 p-3">
                    <div className="text-xs text-slate-400">Contacts</div>
                    <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-purple-400">{people?.length || 0}</div>
                  </div>
                  <div className="bg-slate-900 p-3">
                    <div className="text-xs text-slate-400">Pipeline</div>
                    {pipelineValue > 0 ? (
                      <>
                        <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-emerald-400">
                          ${pipelineValue.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="font-mono tabular-nums">{openDeals}</span> open
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-base font-medium text-slate-400">None</div>
                    )}
                  </div>
                  <div className="bg-slate-900 p-3">
                    <div className="text-xs text-slate-400">Relationship</div>
                    <div className="mt-1 text-base font-medium text-slate-100">{account.relationship || 'Prospect'}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Deals, Signals, Contacts, Security */}
          <div className="md:col-span-1 space-y-4">
            {/* Active Deals */}
            <Card className="border-slate-800 bg-slate-900 shadow-none">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Active Deals
                  </span>
                  {openDeals > 0 && (
                    <span className="font-mono tabular-nums text-xs text-slate-400">{openDeals}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {!accountOpportunities || accountOpportunities.length === 0 ? (
                  <p className="text-sm text-slate-400">No open opportunities</p>
                ) : accountOpportunities.map((opp: any) => (
                  <div key={opp.id} className="p-3 rounded-lg bg-slate-800/60">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-sm font-medium truncate">{opp.name}</span>
                      <span className="shrink-0 rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {opp.stage}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-mono tabular-nums text-sm font-semibold text-emerald-400">
                        ${Number(opp.amount).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-2.5">
                        {/* The CRM's own probability — distinct from the AI prediction beside it. */}
                        {opp.probability != null && (
                          <span className="font-mono tabular-nums text-[11px] text-slate-400" title="Probability recorded in the CRM">
                            {opp.probability}% CRM
                          </span>
                        )}
                        {opp.aiSuccessScore != null && (
                          <div
                            className="flex items-center gap-1"
                            title="AI-predicted likelihood of winning — not the CRM probability"
                          >
                            <BrainCircuit className="h-3 w-3 text-cyan-400" />
                            <span className="font-mono tabular-nums text-[11px] font-semibold text-cyan-400">
                              {opp.aiSuccessScore}% AI
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Intent Signals (6sense) */}
            {intentSignals && intentSignals.length > 0 && (
              <Card className="border-slate-800 bg-slate-900 shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Flame className="h-4 w-4 text-amber-400" />
                    Intent Signals
                    <span className="text-xs font-normal text-slate-400">{intentSignals[0].source}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  {intentSignals.slice(0, 4).map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                      <span className="text-slate-400 truncate">
                        {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        {s.category ? ` · ${s.category}` : ''}
                      </span>
                      <span className={`font-mono tabular-nums font-semibold ${getIntentColor(s.score)}`}>{s.score}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Key Contacts */}
            <Card className="border-slate-800 bg-slate-900 shadow-none">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    Key Contacts
                    <span className="font-mono tabular-nums text-xs font-normal text-slate-400">{people?.length || 0}</span>
                  </span>
                  <Link href={`/contacts?account=${accountId}`} className="text-xs text-cyan-400 hover:text-cyan-300">
                    View all
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1">
                {!people || people.length === 0 ? (
                  <p className="text-sm text-slate-400">No contacts found</p>
                ) : (
                  people.slice(0, 5).map((person: any) => (
                    <Link key={person.id} href={`/contacts/${person.id}`}>
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer group transition-colors">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate group-hover:text-cyan-400 transition-colors">
                            {person.name}
                          </div>
                          <div className="text-xs text-slate-400 truncate">
                            {person.title || 'No title'}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {person.linkedinUrl && (
                            <button type="button" aria-label="Open LinkedIn profile"
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(person.linkedinUrl!, '_blank', 'noopener,noreferrer'); }}
                               className="p-1 hover:bg-blue-500/20 rounded">
                              <Linkedin className="h-3 w-3 text-blue-400" />
                            </button>
                          )}
                          {person.email && (
                            <button onClick={(e) => { e.preventDefault(); copyToClipboard(person.email!, `email-${person.id}`); }}
                                    aria-label="Copy email address"
                                    className="p-1 hover:bg-slate-700 rounded">
                              {copiedField === `email-${person.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-slate-400" />}
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Security Intelligence */}
            {(ssoProvider || mfaSolution || securityIncidents || competitorIntent) && (
              <Card className="border-slate-800 bg-slate-900 shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-400" />
                    Security Intel
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {ssoProvider && (
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-slate-400">SSO</span>
                      <span className="font-medium">{ssoProvider}</span>
                    </div>
                  )}
                  {mfaSolution && (
                    <div className="flex justify-between items-center gap-2 text-sm">
                      <span className="text-slate-400">MFA</span>
                      <span className="font-medium">{mfaSolution}</span>
                    </div>
                  )}
                  {competitorIntent && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/25 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Competitor Intent
                      </div>
                      <p className="text-xs text-slate-200">{competitorIntent}</p>
                    </div>
                  )}
                  {securityIncidents && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/25 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-red-400 mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Security Incidents
                      </div>
                      <p className="text-xs text-slate-200">{String(securityIncidents).slice(0, 200)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - AI Intelligence */}
          <div className="md:col-span-2 space-y-4">
            {/* AI Account Brief — the trustworthy centrepiece */}
            <Card className="border-slate-800 bg-slate-900 shadow-none">
              <CardHeader className="px-6 pt-1">
                <CardTitle className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-base font-semibold">
                      <Sparkles className="h-4 w-4 text-cyan-400" />
                      AI Account Brief
                    </span>
                    <span className="mt-1 block text-xs font-normal text-slate-400">
                      Computed from this account's own signals, deals, and contacts.
                    </span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {overviewQuery.data?.cached && (
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400">
                        Updated <span className="font-mono tabular-nums">{overviewQuery.data.cacheAge}m</span> ago
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Regenerate brief"
                      onClick={() => overviewQuery.refetch()}
                      disabled={overviewQuery.isFetching}
                    >
                      <RefreshCw className={`h-4 w-4 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-6">
                {overviewQuery.isLoading ? (
                  <div className="space-y-2.5 py-1">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      Generating brief…
                    </div>
                    <div className="animate-pulse space-y-2 pt-1">
                      <div className="h-3 w-11/12 rounded bg-slate-800" />
                      <div className="h-3 w-full rounded bg-slate-800" />
                      <div className="h-3 w-9/12 rounded bg-slate-800" />
                    </div>
                  </div>
                ) : overviewQuery.data?.summary ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-cyan-400">
                    <SafeStreamdown>{extractFinalOutput(overviewQuery.data.summary)}</SafeStreamdown>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-800 py-8 text-center">
                    <Sparkles className="h-7 w-7 mx-auto mb-2 text-slate-600" />
                    <p className="text-sm text-slate-400">No brief available yet</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => overviewQuery.refetch()}
                      disabled={overviewQuery.isFetching}
                    >
                      <RefreshCw className={`mr-1 h-4 w-4 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />
                      Generate brief
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
