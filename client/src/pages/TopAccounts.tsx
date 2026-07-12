import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { 
  Target, MapPin, Users, TrendingUp, Flame, Building2, 
  ArrowRight, Calendar, Clock, UserCircle, ChevronDown
} from "lucide-react";
import { useRep, REP_TERRITORIES } from "@/contexts/RepContext";

// AE definitions derived from the single rep roster in RepContext
const AE_LIST = Object.entries(REP_TERRITORIES).map(([email, info]) => ({
  email,
  name: info.name,
  region: info.region,
  size: info.sizeFilter === "<2000" ? "<2K" : "2K+",
}));

const REGIONS = ["West", "Central", "East"];

export default function TopAccounts() {
  const [activeTab, setActiveTab] = useState("regions");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedAE, setSelectedAE] = useState("all");
  
  const { data: accounts, isLoading } = trpc.accounts.list.useQuery();
  const { data: repStats } = trpc.priorityActions.getRepStats.useQuery({ 
    userEmail: selectedAE !== "all" ? selectedAE : "" 
  });

  // Process accounts by region
  const accountsByRegion = REGIONS.reduce((acc, region) => {
    acc[region] = (accounts || [])
      .filter((a: any) => a.region === region)
      .map((a: any) => ({
        ...a,
        intentScoreNum: parseInt(String(a.intentScore || 0), 10)
      }))
      .sort((a: any, b: any) => b.intentScoreNum - a.intentScoreNum)
      .slice(0, 15);
    return acc;
  }, {} as Record<string, typeof accounts>);

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

  const renderAccountCard = (account: any, index: number) => {
    const intentScore = account.intentScoreNum;
    const intentLevel = intentScore >= 70 ? "hot" : intentScore >= 40 ? "warm" : "cold";
    const badgeClass = intentScore >= 70 ? "bg-red-500/20 text-red-400 border-red-500/30" : 
                       intentScore >= 40 ? "bg-orange-500/20 text-orange-400 border-orange-500/30" : 
                       "bg-blue-500/20 text-blue-400 border-blue-500/30";
    const iconColor = intentScore >= 70 ? "from-red-600 to-orange-600" : 
                      intentScore >= 40 ? "from-orange-600 to-yellow-600" : 
                      "from-blue-600 to-cyan-600";

    return (
      <Link key={account.id} href={`/accounts/${account.id}`}>
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-accent/50 transition-all cursor-pointer group">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br ${iconColor} text-white font-bold shadow-lg`}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-lg group-hover:text-primary transition-colors">{account.name}</h4>
            <p className="text-sm text-muted-foreground">
              {account.industry || "Unknown"} • {account.employeeCount?.toLocaleString() || "?"} employees
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={badgeClass}>
              {intentScore} {intentLevel}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </Link>
    );
  };

  if (isLoading) {
    return (
      <div className="container py-8 max-w-7xl">
        <div className="space-y-6">
          <div className="h-12 w-64 skeleton rounded-lg" />
          <div className="grid gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl shadow-lg">
            <Target className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Top Accounts</h1>
            <p className="text-muted-foreground text-lg">Prioritized accounts by region and AE territory</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="regions" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            By Region
          </TabsTrigger>
          <TabsTrigger value="ae" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            By AE
          </TabsTrigger>
        </TabsList>

        {/* By Region Tab */}
        <TabsContent value="regions" className="space-y-6">
          {/* Region Filter */}
          <div className="flex items-center gap-4">
            <Select value={selectedRegion} onValueChange={setSelectedRegion}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {REGIONS.map(region => (
                  <SelectItem key={region} value={region}>{region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Showing top 15 accounts per region by intent score
            </p>
          </div>

          {/* Region Cards */}
          {selectedRegion === "all" ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {REGIONS.map(region => (
                <Card key={region} className="card-elevated">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        {region}
                      </CardTitle>
                      <Badge variant="outline">{accountsByRegion[region]?.length || 0} accounts</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {accountsByRegion[region]?.slice(0, 5).map((account: any, index: number) => (
                      <Link key={account.id} href={`/accounts/${account.id}`}>
                        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
                          <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{account.name}</p>
                            <p className="text-xs text-muted-foreground">{account.industry || "Unknown"}</p>
                          </div>
                          <Badge className={`text-xs ${
                            account.intentScoreNum >= 70 ? "bg-red-500/20 text-red-400" :
                            account.intentScoreNum >= 40 ? "bg-orange-500/20 text-orange-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {account.intentScoreNum}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                    <Button asChild variant="ghost" size="sm" className="w-full mt-2">
                      <Link href={`/accounts?region=${region}`}>
                        View all {region} accounts
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="card-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    {selectedRegion} Region - Top 15
                  </CardTitle>
                  <Badge variant="outline">{accountsByRegion[selectedRegion]?.length || 0} accounts</Badge>
                </div>
                <CardDescription>Ranked by intent score</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {accountsByRegion[selectedRegion]?.map((account: any, index: number) => 
                  renderAccountCard(account, index)
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* By AE Tab */}
        <TabsContent value="ae" className="space-y-6">
          {/* AE Filter */}
          <div className="flex items-center gap-4">
            <Select value={selectedAE} onValueChange={setSelectedAE}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select AE" />
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
            <p className="text-sm text-muted-foreground">
              Weekly prioritized accounts for each AE
            </p>
          </div>

          {/* AE Cards */}
          {selectedAE === "all" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {AE_LIST.map(ae => {
                const aeAccounts = getAEAccounts(ae.email);
                return (
                  <Card key={ae.email} className="card-elevated">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <UserCircle className="h-5 w-5 text-primary" />
                            {ae.name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <MapPin className="h-3 w-3" />
                            {ae.region} • {ae.size} employees
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{aeAccounts.length} accounts</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {aeAccounts.slice(0, 5).map((account: any, index: number) => (
                        <Link key={account.id} href={`/accounts/${account.id}`}>
                          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group">
                            <span className="w-6 h-6 flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{account.name}</p>
                              <p className="text-xs text-muted-foreground">{account.industry || "Unknown"}</p>
                            </div>
                            <Badge className={`text-xs ${
                              account.intentScoreNum >= 70 ? "bg-red-500/20 text-red-400" :
                              account.intentScoreNum >= 40 ? "bg-orange-500/20 text-orange-400" :
                              "bg-blue-500/20 text-blue-400"
                            }`}>
                              {account.intentScoreNum}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => setSelectedAE(ae.email)}
                      >
                        View all {ae.name.split(' ')[0]}'s accounts
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="card-elevated">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserCircle className="h-5 w-5 text-primary" />
                      {AE_LIST.find(ae => ae.email === selectedAE)?.name}'s Weekly Priority Accounts
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <MapPin className="h-3 w-3" />
                      {AE_LIST.find(ae => ae.email === selectedAE)?.region} • 
                      {AE_LIST.find(ae => ae.email === selectedAE)?.size} employees
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      {getAEAccounts(selectedAE).length} accounts
                    </Badge>
                    {repStats && (
                      <div className="flex gap-2 mt-2">
                        <Badge className="bg-red-500/20 text-red-400 text-xs">
                          {repStats.hotLeads} hot
                        </Badge>
                        <Badge className="bg-orange-500/20 text-orange-400 text-xs">
                          {repStats.warmLeads} warm
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {getAEAccounts(selectedAE).map((account: any, index: number) => 
                  renderAccountCard(account, index)
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
