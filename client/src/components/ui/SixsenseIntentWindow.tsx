import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { 
  TrendingUp, TrendingDown, Minus, Loader2, RefreshCw, 
  Target, Search, Megaphone, Activity, Zap, Eye
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SixsenseIntentWindowProps {
  domain: string;
  accountName: string;
}

export function SixsenseIntentWindow({ domain, accountName }: SixsenseIntentWindowProps) {
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: sixsenseData, isLoading, refetch } = trpc.sixsense.enrich.useQuery(
    { domain },
    { 
      enabled: !!domain,
      refetchInterval: 5 * 60 * 1000 // Refresh every 5 minutes
    }
  );

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  const getTrendIcon = (trend: string) => {
    if (trend === "increasing") return <TrendingUp className="h-3 w-3 text-green-400" />;
    if (trend === "decreasing") return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Minus className="h-3 w-3 text-slate-500" />;
  };

  const getIntentLevelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "very high":
        return "border-red-500/50 bg-red-500/10 text-red-400";
      case "high":
        return "border-orange-500/50 bg-orange-500/10 text-orange-400";
      case "medium":
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-400";
      default:
        return "border-slate-500/50 bg-slate-500/10 text-slate-400";
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-purple-950/20 to-pink-950/20 border-purple-500/30">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </CardContent>
      </Card>
    );
  }

  if (!sixsenseData) {
    return (
      <Card className="bg-gradient-to-br from-purple-950/20 to-pink-950/20 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-400" />
            6sense Intent Intelligence
          </CardTitle>
          <CardDescription className="text-slate-400">
            No 6sense data available for this account
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Temporarily disabled - 6sense API structure changed
  const profile = null;
  const keywords = [];
  const campaigns = [];
  const intentData = null;

  return (
    <Card className="bg-gradient-to-br from-purple-950/20 to-pink-950/20 border-purple-500/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-400" />
              6sense Intent Intelligence
            </CardTitle>
            <CardDescription className="text-slate-400 mt-1">
              Live buying signals and keyword research for {accountName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Intent Overview */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-purple-400" />
              <span className="text-sm font-semibold text-slate-400">Intent Level</span>
            </div>
            <Badge variant="outline" className={`${getIntentLevelColor(profile?.intentLevel)} text-lg px-3 py-1`}>
              {profile?.intentLevel || "Unknown"}
            </Badge>
          </div>

          <div className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              <span className="text-sm font-semibold text-slate-400">Intent Score</span>
            </div>
            <div className="text-2xl font-bold text-white">{profile?.intentScore || 0}</div>
          </div>

          <div className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-semibold text-slate-400">Buying Stage</span>
            </div>
            <div className="text-sm font-medium text-white">{profile?.buyingStage || "Unknown"}</div>
          </div>

          <div className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-green-400" />
              <span className="text-sm font-semibold text-slate-400">Profile Fit</span>
            </div>
            <div className="text-sm font-medium text-white">{profile?.profileFit || "Unknown"}</div>
          </div>
        </div>

        {/* Tabs for detailed data */}
        <Tabs defaultValue="keywords" className="space-y-4">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="keywords">
              <Search className="h-4 w-4 mr-2" />
              Keywords ({keywords?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Megaphone className="h-4 w-4 mr-2" />
              Campaigns ({campaigns?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-4 w-4 mr-2" />
              Recent Activity
            </TabsTrigger>
          </TabsList>

          {/* Keywords Tab */}
          <TabsContent value="keywords">
            {keywords && keywords.length > 0 ? (
              <div className="space-y-3">
                {keywords.slice(0, 10).map((kw: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        {getTrendIcon(kw.trend)}
                        <span className="font-semibold text-white">{kw.keyword}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                          {kw.category}
                        </Badge>
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                          Score: {kw.score}
                        </Badge>
                      </div>
                    </div>
                    {kw.lastSeen && (
                      <div className="text-xs text-slate-500">
                        Last seen: {new Date(kw.lastSeen).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500">No keyword data available</p>
              </div>
            )}
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            {campaigns && campaigns.length > 0 ? (
              <div className="space-y-3">
                {campaigns.map((campaign: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-white">{campaign.campaignName || campaign.name}</h4>
                      <Badge variant="outline" className="border-green-500/30 text-green-400">
                        Engagement: {campaign.engagementScore}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {campaign.impressions && (
                        <div>
                          <span className="text-slate-500">Impressions</span>
                          <div className="text-white font-medium">{campaign.impressions.toLocaleString()}</div>
                        </div>
                      )}
                      {campaign.clicks && (
                        <div>
                          <span className="text-slate-500">Clicks</span>
                          <div className="text-white font-medium">{campaign.clicks.toLocaleString()}</div>
                        </div>
                      )}
                      {campaign.lastActivity && (
                        <div>
                          <span className="text-slate-500">Last Activity</span>
                          <div className="text-white font-medium">
                            {new Date(campaign.lastActivity).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Megaphone className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500">No campaign data available</p>
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            {intentData?.recentActivity && intentData.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {intentData.recentActivity.map((activity: any, idx: number) => (
                  <div key={idx} className="p-4 bg-slate-950/50 rounded-lg border border-purple-500/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="border-purple-500/30 text-purple-400 mb-2">
                          {activity.type}
                        </Badge>
                        <p className="text-sm text-slate-300">{activity.description}</p>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500">No recent activity data available</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
