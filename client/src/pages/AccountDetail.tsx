import { useState } from"react";
import { Card, CardContent, CardHeader, CardTitle } from"@/components/ui/card";
import { Button } from"@/components/ui/button";
import { AIAssistant } from"@/components/AIAssistant";
import { AccountJudgement } from"@/components/AccountJudgement";
import { trpc } from"@/lib/trpc";
import {
  ArrowLeft, ExternalLink, Users, TrendingUp, Building2,
  Copy, Check, Flame, Mail, Linkedin, Globe,
  ChevronRight, Shield, AlertTriangle, BrainCircuit, ListChecks, Zap,
  ArrowUpRight, ArrowDownRight, Minus
} from"lucide-react";
import { Link, useParams } from"wouter";
import { toast } from"sonner";
import { CompanyLogo } from"@/components/ui/company-logo";
import { TechStackDisplay } from"@/components/TechStackDisplay";
import { ActivityTimeline } from"@/components/ActivityTimeline";
import { LogFollowUpDialog } from"@/components/LogFollowUpDialog";
import { AccountTrajectory } from"@/components/AccountTrajectory";
import { AccountResearch } from"@/components/AccountResearch";

// --- Signal helpers -------------------------------------------------------
// Heat pairs a tinted color with a word + shape/glyph so it survives greyscale
// and colour blindness (never colour alone).
function heatMeta(score: number): { label: string; cls: string; hot: boolean } {
  if (score >= 80) return { label:"Hot", cls:"text-critical", hot: true };
  if (score >= 60) return { label:"Warm", cls:"text-caution", hot: false };
  if (score >= 40) return { label:"Cool", cls:"text-accent", hot: false };
  return { label:"Cold", cls:"text-ink-muted", hot: false };
}

// Buying-stage colour is a status, not a signal — cyan stays reserved for the
// AI/intent voice, so stages map to the status ramp instead.
function stageMeta(stage: string): { cls: string } {
  switch (stage) {
    case"Purchase": return { cls:"text-positive" };
    case"Decision": return { cls:"text-accent" };
    case"Consideration": return { cls:"text-caution" };
    case"Awareness": return { cls:"text-ink-muted" };
    default: return { cls:"text-ink-muted" };
  }
}

export default function AccountDetailEnhanced() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id ||"0");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });

  // One signal pack drives every fact on this page: contacts, deals, intent history,
  // coverage. It is the same pack the brief is generated from, so the numbers at the
  // top and the judgement below can never disagree — previously the page composed its
  // own "why now" from raw columns while the brief reasoned from a different read.
  //
  // Deterministic and LLM-free, so the facts render immediately; only the judgement
  // (in AccountJudgement) waits on a model.
  const { data: signals } = trpc.intel.accountSignals.useQuery(
    { accountId },
    { enabled: accountId > 0, refetchOnWindowFocus: false }
  );

  const { data: timeline, isLoading: timelineLoading } = trpc.accounts.getTimeline.useQuery(
    { accountId, limit: 50 },
    { enabled: accountId > 0, refetchOnWindowFocus: false }
  );

  const { data: salesforceInstanceUrl } = trpc.salesforce.getInstanceUrl.useQuery();

  const people = signals?.stakeholders.people;
  const accountOpportunities = signals?.pipeline.opportunities;
  // Newest first — the pack stores the series chronologically for trend maths.
  const intentSignals = signals ? [...signals.intent.history].reverse() : undefined;

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
    if (score >= 80) return 'text-critical';
    if (score >= 60) return 'text-caution';
    if (score >= 40) return 'text-accent';
    return 'text-ink-muted';
  };

  // Loading state
  if (isLoading) {
    return (
      <div>
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
      <div>
        <div className="container py-1 max-w-2xl text-center">
          <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-2xl font-semibold mb-2">Account not found</h3>
          <Button asChild><Link href="/accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link></Button>
        </div>
      </div>
    );
  }

  const intentScore = signals?.intent.score ?? account.intentScore ?? 0;
  // Prefer the real 6sense stage (column: sixsenseBuyingStage); fall back to an intent-band
  // inference only when it is genuinely absent. Reading `.buyingStage` — which is not a
  // column — meant the real stage was never shown and every account looked"Inferred".
  const realBuyingStage = signals?.intent.buyingStage ?? ((account as any).sixsenseBuyingStage as string | null | undefined);
  const buyingStage = realBuyingStage || (
    intentScore >= 86 ? 'Purchase' :
    intentScore >= 70 ? 'Decision' :
    intentScore >= 50 ? 'Consideration' :
    intentScore >= 20 ? 'Awareness' : 'Target'
  );

  const heat = heatMeta(intentScore);
  const stage = stageMeta(buyingStage);
  const profileFit = signals?.intent.profileFit ?? ((account as any).sixsenseProfileFit as string | undefined);

  // Intent trend: compare the two most recent readings. Real numbers only — null
  // when there isn't enough history to compute a delta.
  const intentTrend =
    intentSignals && intentSignals.length >= 2
      ? intentSignals[0].score - intentSignals[1].score
      : null;

  // Pipeline totals come from the pack, which already computes the probability-weighted
  // figure. Summing amounts client-side gave a number no one should forecast against.
  const openDeals = signals?.pipeline.open ?? 0;
  const pipelineValue = signals?.pipeline.totalValue ?? 0;
  const weightedPipeline = signals?.pipeline.weightedValue ?? 0;

  // How much of this account we actually hold data for. Stating it up front is what
  // stops a thin brief from reading like a quiet account.
  const coverage = signals?.coverage;

  return (
    <div>
      <AIAssistant context={{ type: 'account', id: accountId, name: account.name }} />

      <div className="container py-1 space-y-5 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/accounts"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            {/* Company Logo */}
            <CompanyLogo name={account.name} website={account.domain} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-semibold tracking-tight truncate">{account.name}</h1>
                {/* Stage badge: colour + word + shape */}
                <span className={`inline-flex items-center gap-1.5 rounded-sm bg-muted px-2.5 py-1 text-xs font-medium ${stage.cls}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {buyingStage}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted mt-0.5">
                {account.domain && (
                  <a href={`https://${account.domain}`} target="_blank" rel="noopener noreferrer"
                     className="flex flex-wrap items-center gap-1 hover:text-accent transition-colors">
                    <Globe className="h-3 w-3" />{account.domain}
                  </a>
                )}
                {account.industry && <span>{account.industry}</span>}
                {account.employeeCount && (
                  <span><span className="tabular-nums text-ink-muted">{Number(account.employeeCount).toLocaleString()}</span> employees</span>
                )}
                {accountOwner && <span>Owner: {accountOwner}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            {/* Capture happens where the decision happens. A commitment made while
                looking at the account and written down later is a commitment lost. */}
            <LogFollowUpDialog
              accountId={accountId}
              accountName={account.name}
              contacts={people?.map(p => ({ id: p.id, name: p.name, title: p.title }))}
            />
            <Button size="sm" asChild>
              <Link href="/outreach"><Mail className="mr-1 h-4 w-4" />Outreach</Link>
            </Button>
            {account.linkedinUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={account.linkedinUrl} target="_blank"><Linkedin className="mr-1 h-4 w-4" />LinkedIn</a>
              </Button>
            )}
            {(account as any).sfdcAccountId && (
              <Button size="sm" variant="outline" className="border-accent/30 text-accent" asChild>
                <a href={`${salesforceInstanceUrl || 'https://login.salesforce.com'}/lightning/r/Account/${(account as any).sfdcAccountId}/view`} target="_blank">
                  <ExternalLink className="mr-1 h-4 w-4" />Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Signature Account Signal band — the one clear read, evidence a glance away */}
        <Card className="border-border bg-card shadow-none">
          <CardContent className="px-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,auto)_1fr]">
              {/* Intent score — the signal, in cyan mono */}
              <div className="flex flex-wrap items-start gap-5 lg:border-r lg:border-border lg:pr-8">
                <div>
                  <div className="text-xs text-ink-muted">Intent score</div>
                  <div className="flex flex-wrap items-end gap-2">
                    <span className="tabular-nums text-6xl font-semibold leading-none text-accent">{intentScore}</span>
                    <span className="mb-1 tabular-nums text-sm text-ink-muted">/ 100</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-sm bg-muted px-2.5 py-1 text-xs font-medium ${heat.cls}`}>
                      {heat.hot
                        ? <Flame className="h-3 w-3" />
                        : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      {heat.label}
                    </span>
                    {intentTrend !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 tabular-nums text-xs ${ intentTrend > 0 ? 'text-positive' : intentTrend < 0 ? 'text-critical' : 'text-ink-muted' }`}
                        title="Change vs. the previous recorded signal"
                      >
                        {intentTrend > 0 ? <ArrowUpRight className="h-3 w-3" /> : intentTrend < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {intentTrend > 0 ? '+' : ''}{intentTrend}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-muted">
                    {realBuyingStage ? '6sense' : 'Inferred from intent band'}
                  </div>
                </div>
              </div>

              {/* Supporting facts — every value below is read from the same signal pack
                  the brief is generated from, so this strip and the judgement underneath
                  can never contradict each other. */}
              <div className="min-w-0 space-y-4">
                {/* Signal coverage: how much of this account we actually hold. Shown
                    before the facts, because it is how you read the facts. */}
                {coverage && (
                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-xs text-ink-muted">Signal coverage</span>
                      <span className="tabular-nums text-xs text-ink-muted">
                        {Math.round(coverage.completeness * 100)}% · {coverage.present.length} of{' '}
                        {coverage.present.length + coverage.missing.length} categories
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-300"
                        style={{ width: `${Math.round(coverage.completeness * 100)}%` }}
                      />
                    </div>
                    {coverage.missing.length > 0 && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-subtle">
                        No data for: {coverage.missing.join(', ')}. Nothing on this page infers them.
                      </p>
                    )}
                  </div>
                )}

                {/* Fact strip — hairline-separated, differentiated by value type */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-sm bg-muted">
                  <div className="bg-card p-3">
                    <div className="text-xs text-ink-muted">Profile fit</div>
                    <div className="mt-1 text-base font-medium text-foreground">{profileFit || 'Unknown'}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-ink-muted">Contacts</div>
                    <div className="mt-1 tabular-nums text-lg font-semibold text-accent">{people?.length || 0}</div>
                    {!!signals?.stakeholders.total && (
                      <div className="text-[11px] text-ink-muted">
                        <span className="tabular-nums">{signals.stakeholders.withEmail}</span> reachable
                      </div>
                    )}
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-ink-muted">Pipeline</div>
                    {pipelineValue > 0 ? (
                      <>
                        <div className="mt-1 tabular-nums text-lg font-semibold text-positive">
                          ${pipelineValue.toLocaleString()}
                        </div>
                        {/* The honest forecast number sits under the headline one. */}
                        <div className="text-[11px] text-ink-muted">
                          <span className="tabular-nums">${weightedPipeline.toLocaleString()}</span> weighted ·{' '}
                          <span className="tabular-nums">{openDeals}</span> open
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-base font-medium text-ink-muted">None</div>
                    )}
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-ink-muted">Last contact</div>
                    {signals?.conversations.daysSinceLastCall != null ? (
                      <>
                        <div className="mt-1 tabular-nums text-lg font-semibold text-foreground">
                          {signals.conversations.daysSinceLastCall}d
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          <span className="tabular-nums">{signals.conversations.total}</span> calls on file
                        </div>
                      </>
                    ) : (
                      <div className="mt-1 text-base font-medium text-ink-muted">Never</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Deals, Signals, Contacts, Security */}
          {/* min-w-0: a grid item defaults to min-width:auto, so a long opportunity
              name sets a floor the column can't shrink below and pushes the page
              sideways on a phone. */}
          <div className="min-w-0 md:col-span-1 space-y-4">
            {/* Active Deals */}
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex flex-wrap items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-positive" />
                    Active Deals
                  </span>
                  {openDeals > 0 && (
                    <span className="tabular-nums text-xs text-ink-muted">{openDeals}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {!accountOpportunities || accountOpportunities.length === 0 ? (
                  <p className="text-sm text-ink-muted">No open opportunities</p>
                ) : accountOpportunities.map((opp, i) => (
                  <div key={`${opp.name}-${i}`} className="p-3 rounded-sm bg-muted">
                    <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                      {/* truncate sets white-space:nowrap, so without min-w-0 this flex
                          item's min-content width is the whole untruncated name. */}
                      <span className="min-w-0 flex-1 text-sm font-medium truncate">{opp.name}</span>
                      <span className="shrink-0 rounded-sm bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                        {opp.stage}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <span className="tabular-nums text-sm font-semibold text-positive">
                        {opp.amount != null ? `$${Number(opp.amount).toLocaleString()}` : '—'}
                      </span>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {/* The CRM's own probability — distinct from the AI prediction beside it. */}
                        {opp.probability != null && (
                          <span className="tabular-nums text-[11px] text-ink-muted" title="Probability recorded in the CRM">
                            {opp.probability}% CRM
                          </span>
                        )}
                        {opp.aiSuccessScore != null && (
                          <div
                            className="flex flex-wrap items-center gap-1"
                            title="AI-predicted likelihood of winning — not the CRM probability"
                          >
                            <BrainCircuit className="h-3 w-3 text-accent" />
                            <span className="tabular-nums text-[11px] font-semibold text-accent">
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
              <Card className="border-border bg-card shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                    <Flame className="h-4 w-4 text-caution" />
                    Intent Signals
                    {intentSignals[0].source && (
                      <span className="text-xs font-normal text-ink-muted">{intentSignals[0].source}</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-1">
                  {intentSignals.slice(0, 4).map((s, i) => (
                    <div key={`${s.at}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
                      <span className="text-ink-muted truncate">
                        {s.at ? new Date(s.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Undated'}
                        {s.category ? ` · ${s.category}` : ''}
                      </span>
                      <span className={`tabular-nums font-semibold ${getIntentColor(s.score)}`}>{s.score}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Key Contacts */}
            <Card className="border-border bg-card shadow-none">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex flex-wrap items-center gap-2">
                    <Users className="h-4 w-4 text-accent" />
                    Key Contacts
                    <span className="tabular-nums text-xs font-normal text-ink-muted">{people?.length || 0}</span>
                  </span>
                  <Link href={`/contacts?account=${accountId}`} className="text-xs text-accent hover:text-accent">
                    View all
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-1">
                {!people || people.length === 0 ? (
                  <p className="text-sm text-ink-muted">No contacts found</p>
                ) : (
                  // The pack ranks people most-senior-first, so the top five are the five
                  // that matter rather than the five that happened to sync first.
                  people.slice(0, 5).map((person) => (
                    <Link key={person.id} href={`/contacts/${person.id}`}>
                      <div className="flex items-center justify-between p-2 rounded-sm hover:bg-muted cursor-pointer group transition-colors">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate group-hover:text-accent transition-colors">
                            {person.name}
                          </div>
                          <div className="text-xs text-ink-muted truncate">
                            {person.title || 'No title'}
                            {person.seniority !== 'Unknown' && person.title && (
                              <span className="text-ink-subtle"> · {person.seniority}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 flex-shrink-0">
                          {person.linkedinUrl && (
                            <button type="button" aria-label="Open LinkedIn profile"
                               onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(person.linkedinUrl!, '_blank', 'noopener,noreferrer'); }}
                               className="p-1 hover:bg-accent-subtle rounded">
                              <Linkedin className="h-3 w-3 text-accent" />
                            </button>
                          )}
                          {person.email && (
                            <button onClick={(e) => { e.preventDefault(); copyToClipboard(person.email!, `email-${person.id}`); }}
                                    aria-label="Copy email address"
                                    className="p-1 hover:bg-surface-raised rounded">
                              {copiedField === `email-${person.id}` ? <Check className="h-3 w-3 text-positive" /> : <Copy className="h-3 w-3 text-ink-muted" />}
                            </button>
                          )}
                          <ChevronRight className="h-4 w-4 text-ink-subtle" />
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* What they run. Both stacks live in the signal pack and were, until now,
                visible only inside a component nothing rendered. */}
            <TechStackDisplay
              techStack={signals?.technology.techStack ?? null}
              securityStack={signals?.technology.securityStack ?? null}
            />

            {/* Trigger events — the "something happened" signals. Also in the pack,
                also previously unshown. */}
            {!!signals?.triggers.length && (
              <Card className="border-border bg-card shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                    <Zap className="h-4 w-4 text-caution" />
                    Trigger Events
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="space-y-1.5">
                    {signals.triggers.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-caution" />
                        <span className="text-foreground">{t}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Security Intelligence */}
            {(ssoProvider || mfaSolution || securityIncidents || competitorIntent) && (
              <Card className="border-border bg-card shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                    <Shield className="h-4 w-4 text-accent" />
                    Security Intel
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {ssoProvider && (
                    <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
                      <span className="text-ink-muted">SSO</span>
                      <span className="font-medium">{ssoProvider}</span>
                    </div>
                  )}
                  {mfaSolution && (
                    <div className="flex flex-wrap justify-between items-center gap-2 text-sm">
                      <span className="text-ink-muted">MFA</span>
                      <span className="font-medium">{mfaSolution}</span>
                    </div>
                  )}
                  {competitorIntent && (
                    <div className="rounded-sm bg-caution-subtle border border-caution/30 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-caution mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Competitor Intent
                      </div>
                      <p className="text-xs text-foreground">{competitorIntent}</p>
                    </div>
                  )}
                  {securityIncidents && (
                    <div className="rounded-sm bg-critical-subtle border border-critical/30 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-critical mb-1">
                        <AlertTriangle className="h-3 w-3" />
                        Security Incidents
                      </div>
                      <p className="text-xs text-foreground">{String(securityIncidents).slice(0, 200)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column — the judgement: why this account matters and what to do */}
          <div className="min-w-0 md:col-span-2 space-y-4">
            <AccountJudgement accountId={accountId} />

            {/* Commitments already made on calls. These outrank anything a model can
                suggest, so they sit under the judgement rather than inside it. */}
            {!!signals?.conversations.openActionItems.length && (
              <Card className="border-border bg-card shadow-none">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex flex-wrap items-center gap-2">
                    <ListChecks className="h-4 w-4 text-caution" />
                    Open commitments
                    <span className="tabular-nums text-xs font-normal text-ink-muted">
                      {signals.conversations.openActionItems.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <ul className="space-y-1.5">
                    {signals.conversations.openActionItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-caution" />
                        <span className="text-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-ink-subtle">
                    Captured from call transcripts. Unresolved until closed in the CRM.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* The outside view, kept apart from the brief on purpose — the brief's
                value is that it only uses data you hold. */}
            <AccountResearch accountId={accountId} />

            {/* What moved between briefs. Every brief was already snapshotted with a
                diffable metrics row; nothing ever read them back. */}
            <AccountTrajectory accountId={accountId} />

            {/* What actually happened, in order. The timeline component and the
                procedure that feeds it were built to the same shape and never
                connected to each other. */}
            <ActivityTimeline
              activities={timeline ?? []}
              isLoading={timelineLoading}
              maxItems={8}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
