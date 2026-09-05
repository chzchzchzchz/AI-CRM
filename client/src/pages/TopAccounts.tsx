import { useState, useMemo } from "react";
import { heatMeta } from "@/lib/signal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Target, MapPin, ArrowRight, UserCircle } from "lucide-react";
import { useRep, REP_TERRITORIES } from "@/contexts/RepContext";
import { DataErrorBanner } from "@/components/ui/data-error-banner";

// AE definitions derived from the single rep roster in RepContext
const AE_LIST = Object.entries(REP_TERRITORIES).map(([email, info]) => ({
  email,
  name: info.name,
  region: info.region,
  size: info.sizeFilter === "<2000" ? "<2K" : "2K+",
}));

// Regions configured for the rep roster — a starting set, unioned below with whatever
// regions actually appear in the data so no account is dropped by a hardcoded list.
const CONFIGURED_REGIONS = Array.from(new Set(AE_LIST.map((ae) => ae.region))).filter(Boolean);

const CARD = "bg-card border-border shadow-none";

// Compact ranked row used inside a card — no border/fill at rest so it never reads as a card-in-card.
function AccountRow({ account, index }: { account: any; index: number }) {
  const meta = heatMeta(account.intentScoreNum);
  return (
    <Link href={`/accounts/${account.id}`}>
      <div className="flex flex-wrap items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-muted cursor-pointer group">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted border border-border-strong tabular-nums text-xs text-ink-muted">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground truncate group-hover:text-accent transition-colors">{account.name}</p>
          <p className="text-xs text-ink-muted truncate">{account.industry || "Unknown"}</p>
        </div>
        <span className={`inline-flex items-center gap-1 tabular-nums text-sm shrink-0 ${meta.text}`}>
          <span aria-hidden>{meta.glyph}</span>{account.intentScoreNum}
        </span>
      </div>
    </Link>
  );
}

export default function TopAccounts() {
  const [activeTab, setActiveTab] = useState("regions");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedAE, setSelectedAE] = useState("all");

  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: repStats, error: repStatsError } = trpc.priorityActions.getRepStats.useQuery({
    userEmail: selectedAE !== "all" ? selectedAE : ""
  });

  /**
   * Accounts with no region at all.
   *
   * Deriving regions from the data fixed accounts whose region was an unexpected VALUE.
   * It did nothing for accounts with no value: `filter(Boolean)` drops them, so they
   * match no group and disappear from this page entirely, with nothing saying they
   * exist. That is every account a customer imports — the import cannot know a region,
   * and asking for one before showing someone their own data would be worse.
   *
   * A page that silently omits records is worse than one that admits it cannot group
   * them: the customer had just watched the import say "2 accounts in your workspace"
   * and then found five empty regions.
   */
  const UNASSIGNED = "No region set";

  const REGIONS = useMemo(() => {
    const fromData = (accounts || []).map((a: any) => a.region).filter(Boolean);
    const named = Array.from(new Set([...CONFIGURED_REGIONS, ...fromData]));
    const anyUnassigned = (accounts || []).some((a: any) => !a.region);
    return anyUnassigned ? [...named, UNASSIGNED] : named;
  }, [accounts]);

  /** One place deciding which group an account is in, so counts and rows cannot disagree. */
  const inRegion = (a: any, region: string) =>
    region === UNASSIGNED ? !a.region : a.region === region;

  // Process accounts by region
  const accountsByRegion = REGIONS.reduce((acc: Record<string, any[]>, region: string) => {
    acc[region] = (accounts || [])
      .filter((a: any) => inRegion(a, region))
      .map((a: any) => ({
        ...a,
        intentScoreNum: parseInt(String(a.intentScore || 0), 10)
      }))
      .sort((a: any, b: any) => b.intentScoreNum - a.intentScoreNum)
      .slice(0, 15);
    return acc;
  }, {} as Record<string, typeof accounts>);

  // The true count per region, independent of the 15-row cap above — the badge
  // next to each region's name used to read `accountsByRegion[region].length`,
  // which can never exceed 15 because that array is already sliced. Confirmed
  // live: Central shows a badge of "15" for 188 real accounts, West "15" for 207.
  // Every region/AE with more than 15 accounts (nearly all of them) showed a
  // number that looked like a total but was actually just the display cap.
  const regionCounts: Record<string, number> = REGIONS.reduce((acc: Record<string, number>, region: string) => {
    acc[region] = (accounts || []).filter((a: any) => inRegion(a, region)).length;
    return acc;
  }, {});

  // Get accounts for selected AE
  const getAEAccounts = (aeEmail: string) => {
    const ae = AE_LIST.find(a => a.email === aeEmail);
    if (!ae) return [];

    const isSmall = ae.size === "<2K";
    return (accounts || [])
      .filter((a: any) => {
        const matchesRegion = a.region === ae.region;
        const empCount = a.employeeCount || 0;
        const matchesSize = isSmall ? empCount < 2000 : empCount >= 2000;
        return matchesRegion && matchesSize;
      })
      .map((a: any) => ({
        ...a,
        intentScoreNum: parseInt(String(a.intentScore || 0), 10)
      }))
      .sort((a: any, b: any) => b.intentScoreNum - a.intentScoreNum)
      .slice(0, 15);
  };

  // Same problem as regionCounts above, for the AE cards' badges.
  const getAECount = (aeEmail: string) => {
    const ae = AE_LIST.find(a => a.email === aeEmail);
    if (!ae) return 0;
    const isSmall = ae.size === "<2K";
    return (accounts || []).filter((a: any) => {
      const matchesRegion = a.region === ae.region;
      const empCount = a.employeeCount || 0;
      const matchesSize = isSmall ? empCount < 2000 : empCount >= 2000;
      return matchesRegion && matchesSize;
    }).length;
  };

  // Detailed ranked row for the single-region / single-AE views.
  const renderAccountCard = (account: any, index: number) => {
    const meta = heatMeta(account.intentScoreNum);
    return (
      <Link key={account.id} href={`/accounts/${account.id}`}>
        <div className="flex flex-wrap items-center gap-4 rounded-sm px-3 py-3 transition-colors hover:bg-muted cursor-pointer group">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted border border-border-strong tabular-nums text-sm text-ink-muted">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">{account.name}</h4>
            <p className="text-sm text-ink-muted truncate">
              {account.industry || "Unknown"} · <span className="tabular-nums">{account.employeeCount?.toLocaleString() || "?"}</span> employees
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 tabular-nums text-sm shrink-0 ${meta.text}`}>
            <span aria-hidden>{meta.glyph}</span>{account.intentScoreNum}
            <span className="text-xs font-sans font-medium">{meta.label}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted group-hover:text-accent transition-colors" />
        </div>
      </Link>
    );
  };

  if (isLoading) {
    return (
      <div>
        <div className="container py-1 max-w-7xl space-y-6">
          <div className="h-12 w-64 rounded-sm bg-muted animate-pulse" />
          <div className="grid gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-20 rounded-sm bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="container py-1 max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-muted border border-border-strong">
            <Target className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Top Accounts</h1>
            <p className="mt-1 text-sm text-ink-muted">Prioritized by intent score, grouped by region and AE territory.</p>
          </div>
        </div>

        <DataErrorBanner
          errors={[repStatsError]}
          message="Rep stats couldn't be loaded — hot/warm/cold counts below may be incomplete."
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="regions" className="gap-2 data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <MapPin className="h-4 w-4" />
              By region
            </TabsTrigger>
            <TabsTrigger value="ae" className="gap-2 data-[state=active]:bg-accent-subtle data-[state=active]:text-accent">
              <UserCircle className="h-4 w-4" />
              By AE
            </TabsTrigger>
          </TabsList>

          {/* By Region Tab */}
          <TabsContent value="regions" className="space-y-6">
            <div className="flex items-center gap-4">
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-48 bg-muted border-border-strong text-foreground" aria-label="Select region"><SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {REGIONS.map(region => (
                    <SelectItem key={region} value={region}>{region}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-ink-muted">Top 15 accounts per region by intent score</p>
            </div>

            {selectedRegion === "all" ? (
              <div className="grid gap-6 lg:grid-cols-3">
                {REGIONS.map(region => (
                  <Card key={region} className={CARD}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                          <MapPin className="h-4 w-4 text-accent" />
                          {region}
                        </CardTitle>
                        <Badge variant="outline" className="border-border-strong text-ink-muted tabular-nums">
                          {regionCounts[region] || 0}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      {accountsByRegion[region]?.slice(0, 5).map((account: any, index: number) => (
                        <AccountRow key={account.id} account={account} index={index} />
                      ))}
                      {(accountsByRegion[region]?.length || 0) === 0 && (
                        <p className="px-2 py-4 text-xs text-ink-muted">No accounts in this region</p>
                      )}
                      <Button asChild variant="ghost" size="sm" className="w-full mt-2 text-accent hover:text-accent hover:bg-muted">
                        {/* The unassigned group is the absence of a region, so there is
                            no region filter that selects it — link to the full list
                            rather than to a filter that would come back empty. */}
                        <Link
                          href={
                            region === UNASSIGNED
                              ? "/accounts"
                              : `/accounts?region=${encodeURIComponent(region)}`
                          }
                        >
                          {region === UNASSIGNED ? "View all accounts" : `View all ${region} accounts`}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className={CARD}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                      <MapPin className="h-4 w-4 text-accent" />
                      {selectedRegion} region · top 15
                    </CardTitle>
                    <Badge variant="outline" className="border-border-strong text-ink-muted tabular-nums">
                      {accountsByRegion[selectedRegion]?.length || 0}
                    </Badge>
                  </div>
                  <CardDescription className="text-ink-muted">Ranked by intent score</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {accountsByRegion[selectedRegion]?.map((account: any, index: number) =>
                    renderAccountCard(account, index)
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* By AE Tab */}
          <TabsContent value="ae" className="space-y-6">
            <div className="flex items-center gap-4">
              <Select value={selectedAE} onValueChange={setSelectedAE}>
                <SelectTrigger className="w-64 bg-muted border-border-strong text-foreground" aria-label="Select AE"><SelectValue placeholder="Select AE" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All AEs</SelectItem>
                  {AE_LIST.map(ae => (
                    <SelectItem key={ae.email} value={ae.email}>
                      {ae.name} ({ae.region}, {ae.size})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-ink-muted">Weekly prioritized accounts for each AE</p>
            </div>

            {selectedAE === "all" ? (
              <div className="grid gap-6 lg:grid-cols-2">
                {AE_LIST.map(ae => {
                  const aeAccounts = getAEAccounts(ae.email);
                  return (
                    <Card key={ae.email} className={CARD}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                              <UserCircle className="h-4 w-4 text-accent" />
                              {ae.name}
                            </CardTitle>
                            <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-muted">
                              <MapPin className="h-3 w-3" />
                              {ae.region} · {ae.size} employees
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="border-border-strong text-ink-muted tabular-nums">
                            {getAECount(ae.email)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        {aeAccounts.slice(0, 5).map((account: any, index: number) => (
                          <AccountRow key={account.id} account={account} index={index} />
                        ))}
                        {aeAccounts.length === 0 && (
                          <p className="px-2 py-4 text-xs text-ink-muted">No accounts in this territory</p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-accent hover:text-accent hover:bg-muted"
                          onClick={() => setSelectedAE(ae.email)}
                        >
                          View all {ae.name.split(" ")[0]}'s accounts
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className={CARD}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base flex flex-wrap items-center gap-2 text-foreground">
                        <UserCircle className="h-4 w-4 text-accent" />
                        {AE_LIST.find(ae => ae.email === selectedAE)?.name}'s weekly priority accounts
                      </CardTitle>
                      <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-muted">
                        <MapPin className="h-3 w-3" />
                        {AE_LIST.find(ae => ae.email === selectedAE)?.region} ·{" "}
                        {AE_LIST.find(ae => ae.email === selectedAE)?.size} employees
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className="border-border-strong text-ink-muted tabular-nums">
                        {getAECount(selectedAE)} accounts
                      </Badge>
                      {repStats && (
                        <div className="flex flex-wrap gap-3 text-xs">
                          <span className="inline-flex items-center gap-1 font-medium text-positive">
                            <span aria-hidden>▲</span>
                            <span className="tabular-nums">{repStats.hotLeads}</span> hot
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-caution">
                            <span aria-hidden>●</span>
                            <span className="tabular-nums">{repStats.warmLeads}</span> warm
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1">
                  {getAEAccounts(selectedAE).map((account: any, index: number) =>
                    renderAccountCard(account, index)
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
