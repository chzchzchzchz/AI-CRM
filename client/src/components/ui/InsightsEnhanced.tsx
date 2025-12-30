import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  TrendingUp, Users, Phone, Building2, Target, Zap,
  BarChart3, PieChart, Activity, Loader2, ArrowRight,
  Sparkles, Eye, MapPin, Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InsightsEnhanced() {
  const { data: stats, isLoading } = trpc.analytics.overview.useQuery();
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: calls } = trpc.gong.list.useQuery();

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  // Calculate additional insights
  const hotAccounts = accounts?.filter(a => parseInt(a.intentScore || "0") >= 70).length || 0;
  const warmAccounts = accounts?.filter(a => {
    const score = parseInt(a.intentScore || "0");
    return score >= 40 && score < 70;
  }).length || 0;
  const coldAccounts = accounts?.filter(a => parseInt(a.intentScore || "0") < 40).length || 0;

  const recentCalls = calls?.filter((c: any) => {
    if (!c.callDate) return false;
    const callDate = new Date(c.callDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return callDate >= thirtyDaysAgo;
  }).length || 0;

  // Top industries
  const industryData = Object.entries(stats.industries || {})
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  // Top regions - calculate from accounts
  const regionData = accounts ? Object.entries(
    accounts.reduce((acc, account) => {
      const region = account.region || 'Unknown';
      acc[region] = (acc[region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 5) : [];

  // Buying stage distribution
  const buyingStageData = Object.entries(stats.buyingStages || {})
    .sort(([, a], [, b]) => (b as number) - (a as number));

  const getIntentColor = (score: number) => {
    if (score >= 70) return "text-green-400 bg-green-500/10 border-green-500/30";
    if (score >= 40) return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-orange-400 bg-orange-500/10 border-orange-500/30";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <AIAssistant context={{ type: "general" }} />

      <div className="container py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Sales Insights & Analytics</h1>
          <p className="text-slate-400">Data-driven intelligence across your target accounts</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-950/20 to-cyan-900/20 border-cyan-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="h-8 w-8 text-cyan-400" />
                <TrendingUp className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalAccounts}</div>
              <div className="text-sm text-cyan-400">Total Accounts</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-950/20 to-green-900/20 border-green-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-8 w-8 text-green-400" />
                <TrendingUp className="h-5 w-5 text-green-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalContacts}</div>
              <div className="text-sm text-green-400">Key Contacts</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-950/20 to-purple-900/20 border-purple-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Phone className="h-8 w-8 text-purple-400" />
                <Activity className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.totalCalls}</div>
              <div className="text-sm text-purple-400">Total Calls</div>
              <div className="text-xs text-purple-400/70 mt-1">{recentCalls} in last 30 days</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-950/20 to-yellow-900/20 border-yellow-500/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-8 w-8 text-yellow-400" />
                <Sparkles className="h-5 w-5 text-yellow-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.avgIntentScore}</div>
              <div className="text-sm text-yellow-400">Avg Intent Score</div>
            </CardContent>
          </Card>
        </div>

        {/* Intent Distribution */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Intent Score Distribution
            </CardTitle>
            <CardDescription className="text-slate-400">
              Account breakdown by buying intent level
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/accounts">
                <Card className="bg-gradient-to-br from-green-950/20 to-green-900/20 border-green-500/30 hover:border-green-500/60 transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-6 w-6 text-green-400" />
                        <span className="text-lg font-semibold text-white">Hot Leads</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-green-400 transition-colors" />
                    </div>
                    <div className="text-4xl font-bold text-green-400 mb-2">{hotAccounts}</div>
                    <div className="text-sm text-green-400/70">Intent Score 70+</div>
                    <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-green-500 to-green-400"
                        style={{ width: `${(hotAccounts / (stats.totalAccounts || 1)) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/accounts">
                <Card className="bg-gradient-to-br from-yellow-950/20 to-yellow-900/20 border-yellow-500/30 hover:border-yellow-500/60 transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-yellow-400" />
                        <span className="text-lg font-semibold text-white">Warm Leads</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-yellow-400 transition-colors" />
                    </div>
                    <div className="text-4xl font-bold text-yellow-400 mb-2">{warmAccounts}</div>
                    <div className="text-sm text-yellow-400/70">Intent Score 40-69</div>
                    <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                        style={{ width: `${(warmAccounts / (stats.totalAccounts || 1)) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/accounts">
                <Card className="bg-gradient-to-br from-orange-950/20 to-orange-900/20 border-orange-500/30 hover:border-orange-500/60 transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Target className="h-6 w-6 text-orange-400" />
                        <span className="text-lg font-semibold text-white">Cold Leads</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-orange-400 transition-colors" />
                    </div>
                    <div className="text-4xl font-bold text-orange-400 mb-2">{coldAccounts}</div>
                    <div className="text-sm text-orange-400/70">Intent Score &lt;40</div>
                    <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400"
                        style={{ width: `${(coldAccounts / (stats.totalAccounts || 1)) * 100}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Industry & Region Breakdown */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Top Industries */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-cyan-400" />
                Top Industries
              </CardTitle>
              <CardDescription className="text-slate-400">
                Account distribution by industry
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {industryData.map(([industry, count], idx) => {
                const percentage = ((count as number) / (stats.totalAccounts || 1)) * 100;
                return (
                  <div key={industry} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{industry}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{String(count)} accounts</span>
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 text-xs">
                          {percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Top Regions */}
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-400" />
                Top Regions
              </CardTitle>
              <CardDescription className="text-slate-400">
                Geographic distribution of accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {regionData.map(([region, count]) => {
                const percentage = ((count as number) / (stats.totalAccounts || 1)) * 100;
                return (
                  <div key={region} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{region}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">{String(count)} accounts</span>
                        <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
                          {percentage.toFixed(0)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-400 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Buying Stage Distribution */}
        {buyingStageData.length > 0 && (
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-400" />
                Buying Stage Distribution
              </CardTitle>
              <CardDescription className="text-slate-400">
                Where accounts are in their buying journey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {buyingStageData.map(([stage, count]) => {
                  const percentage = ((count as number) / (stats.totalAccounts || 1)) * 100;
                  return (
                    <Card key={stage} className="bg-slate-950/50 border-slate-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-white">{stage}</span>
                          <Badge variant="outline" className="border-green-500/30 text-green-400">
                            {count}
                          </Badge>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{percentage.toFixed(1)}%</div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Recommendations */}
        <Card className="bg-gradient-to-br from-purple-950/20 to-pink-950/20 border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              AI-Powered Recommendations
            </CardTitle>
            <CardDescription className="text-slate-400">
              Next best actions based on your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-950/30 rounded-lg border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Zap className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white mb-1">Focus on {hotAccounts} Hot Accounts</h4>
                  <p className="text-sm text-slate-400">
                    These accounts show strong buying intent (70+ score). Prioritize outreach and schedule discovery calls.
                  </p>
                  <Link href="/accounts">
                    <Button size="sm" className="mt-3 bg-yellow-600 hover:bg-yellow-700">
                      View Hot Accounts
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 rounded-lg border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white mb-1">Review {recentCalls} Recent Calls</h4>
                  <p className="text-sm text-slate-400">
                    Analyze recent Gong calls for buying signals, objections, and follow-up opportunities.
                  </p>
                  <Link href="/calls">
                    <Button size="sm" className="mt-3 bg-purple-600 hover:bg-purple-700">
                      Analyze Calls
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 rounded-lg border border-purple-500/20">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white mb-1">Engage {stats.totalContacts} Decision Makers</h4>
                  <p className="text-sm text-slate-400">
                    Use AI-powered email generation to craft personalized outreach based on account intelligence.
                  </p>
                  <Link href="/email-generator">
                    <Button size="sm" className="mt-3 bg-green-600 hover:bg-green-700">
                      Generate Emails
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
