import { useState } from "react";
import { TechStackAnalysis } from "@/components/TechStackAnalysis";
import { IntelligenceTab } from "@/components/IntelligenceTab";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, ExternalLink, Users, 
  FileText, Phone, TrendingUp, MapPin, Building2, 
  Sparkles, Copy, Check, Zap, Flame, Target,
  Mail, Linkedin, Briefcase, Globe, Calendar,
  MessageSquare, BarChart3, Loader2
} from "lucide-react";
import { Link, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function AccountDetailEnhanced() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });
  const { data: people } = trpc.people.getByAccountId.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );
  

  

  const generateSummaryMutation = trpc.ai.generateAccountSummary.useMutation();
  const geminiResearchMutation = trpc.gemini.researchAccount.useMutation();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [geminiResearch, setGeminiResearch] = useState<string | null | undefined>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingGemini, setIsGeneratingGemini] = useState(false);

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const summary = await generateSummaryMutation.mutateAsync({ accountId });
      setAiSummary(summary);
      toast.success("AI summary generated!");
    } catch (error) {
      toast.error("Failed to generate summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleGeminiResearch = async () => {
    setIsGeneratingGemini(true);
    try {
      const result = await geminiResearchMutation.mutateAsync({ accountId });
      if (result.success) {
        setGeminiResearch(result.research);
        toast.success("Gemini research complete!");
      } else {
        toast.error(result.error || "Failed to generate research");
      }
    } catch (error) {
      toast.error("Failed to generate Gemini research");
    } finally {
      setIsGeneratingGemini(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const parseJSON = (data: string | null | undefined): Record<string, any> => {
    if (!data) return {};
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (typeof parsed !== 'object') return {};
      
      return Object.entries(parsed).reduce((acc, [key, value]) => {
        const strValue = String(value);
        if (value && 
            strValue !== 'null' && 
            strValue !== '' && 
            strValue !== 'No relevant text found' &&
            strValue !== '❌ No People Found.' &&
            !strValue.startsWith('❌')) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
    } catch (e) {
      return {};
    }
  };

  const stackData = parseJSON(account?.techStack);
  const researchData = null; // No research field in schema
  const triggerData = parseJSON(account?.triggerEvents);
  
  // Extract rawData fields
  const rawData = (account?.rawData as Record<string, any>) || {};
  const temperature = rawData.temperature;
  const daysSinceLastEngagement = rawData.daysSinceLastEngagement || rawData.lastSalesActivityDays;
  const accountOwner = rawData.accountOwner || rawData.owner;
  const opportunityStatus = rawData.opportunityStatus;
  const salesActivities = rawData.salesActivities || rawData.engagementActivities || 0;
  const lastSalesActivity = rawData.lastSalesActivity || rawData.latestEngagementActivity;
  const recentSecurityIncidents = rawData['Recent Security Incidents'];
  const ssoProvider = rawData['SSO Provider'];

  const formatFieldName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/summary /gi, '')
      .replace(/^find /, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getIntentBadge = (score: string | number) => {
    const numScore = typeof score === 'string' ? parseInt(score) : score;
    if (numScore >= 70) return { 
      color: 'badge-danger', 
      label: 'Hot Lead',
      icon: Flame,
      gradient: 'from-red-600 to-orange-600'
    };
    if (numScore >= 40) return { 
      color: 'badge-warning', 
      label: 'Warm Lead',
      icon: TrendingUp,
      gradient: 'from-orange-600 to-amber-600'
    };
    return { 
      color: 'badge-primary', 
      label: 'Cold Lead',
      icon: Target,
      gradient: 'from-blue-600 to-cyan-600'
    };
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navigation />
        <div className="container py-12 space-y-8 max-w-7xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 skeleton rounded-2xl" />
            <div className="space-y-2 flex-1">
              <div className="h-10 w-96 skeleton" />
              <div className="h-6 w-64 skeleton" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-xl" />
            ))}
          </div>
          <div className="h-96 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  // Not found state
  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <Navigation />
        <div className="container py-20 max-w-2xl">
          <Card className="card-elevated">
            <CardContent className="py-16 text-center">
              <Building2 className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Account not found</h3>
              <p className="text-muted-foreground mb-6">This account doesn't exist or has been removed</p>
              <Button asChild>
                <Link href="/accounts">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Accounts
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const intentBadge = getIntentBadge(account.intentScore || 0);
  const IntentIcon = intentBadge.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Navigation />
      <AIAssistant context={{ type: 'account', id: accountId, name: account.name }} />

      <div className="container py-12 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Button variant="outline" size="icon" asChild className="flex-shrink-0">
              <Link href="/accounts">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className={`p-4 bg-gradient-to-br ${intentBadge.gradient} rounded-2xl shadow-lg flex-shrink-0`}>
                <IntentIcon className="h-8 w-8 text-white" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-4xl font-bold tracking-tight line-clamp-1">{account.name}</h1>
                  <Badge className={intentBadge.color}>
                    {account.intentScore} {intentBadge.label}
                  </Badge>
                  {(account as any).buyingStage && (
                    <Badge variant="outline" className={`
                      ${(account as any).buyingStage === 'Purchase' ? 'border-green-500 text-green-500' : ''}
                      ${(account as any).buyingStage === 'Decision' ? 'border-cyan-500 text-cyan-500' : ''}
                      ${(account as any).buyingStage === 'Consideration' ? 'border-yellow-500 text-yellow-500' : ''}
                      ${(account as any).buyingStage === 'Awareness' ? 'border-orange-500 text-orange-500' : ''}
                      ${(account as any).buyingStage === 'Target' ? 'border-gray-500 text-gray-500' : ''}
                    `}>
                      {(account as any).buyingStage} Stage
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                  {account.domain && (
                    <a 
                      href={`https://${account.domain}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 hover:text-primary transition-colors"
                    >
                      <Globe className="h-4 w-4" />
                      <span>{account.domain}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {account.industry && (
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      <span>{account.industry}</span>
                    </div>
                  )}
                  {account.employeeCount && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{account.employeeCount} employees</span>
                    </div>
                  )}
                  {account.region && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{account.region}</span>
                    </div>
                  )}
                  {accountOwner && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Owner: {accountOwner}</span>
                    </div>
                  )}
                </div>
                
                {/* Temperature & Activity Badges */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {temperature && (
                    <Badge className={`text-xs ${
                      temperature === 'Hot' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      temperature === 'Warm' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                      'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}>
                      {temperature === 'Hot' ? '🔥' : temperature === 'Warm' ? '🌡️' : '❄️'} {temperature}
                    </Badge>
                  )}
                  {daysSinceLastEngagement !== null && daysSinceLastEngagement !== undefined && (
                    <Badge variant="outline" className={`text-xs ${
                      daysSinceLastEngagement <= 7 ? 'border-green-500 text-green-400' :
                      daysSinceLastEngagement <= 30 ? 'border-yellow-500 text-yellow-400' :
                      'border-red-500 text-red-400'
                    }`}>
                      {daysSinceLastEngagement}d since activity
                    </Badge>
                  )}
                  {salesActivities > 0 && (
                    <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                      {salesActivities} activities
                    </Badge>
                  )}
                  {opportunityStatus && (
                    <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
                      Opp: {opportunityStatus}
                    </Badge>
                  )}
                  {lastSalesActivity && (
                    <Badge variant="outline" className="text-xs border-gray-500/50 text-gray-400">
                      Last: {lastSalesActivity}
                    </Badge>
                  )}
                  {ssoProvider && (
                    <Badge variant="outline" className="text-xs border-indigo-500/50 text-indigo-400">
                      SSO: {ssoProvider}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <Button className="gradient-primary text-white" asChild>
              <Link href="/outreach">
                <Mail className="mr-2 h-4 w-4" />
                Generate Outreach
              </Link>
            </Button>
            {account.linkedinUrl && (
              <Button variant="outline" asChild>
                <a href={account.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" />
                  LinkedIn
                </a>
              </Button>
            )}
            {(account as any).sfdcAccountId && (
              <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" asChild>
                <a href={`https://company.lightning.force.com/lightning/r/Account/${(account as any).sfdcAccountId}/view`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Salesforce
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="card-elevated border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{people?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Key contacts</p>
            </CardContent>
          </Card>



          <Card className="card-elevated border-l-4 border-l-indigo-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-500" />
                Intent Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{account.intentScore || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{intentBadge.label}</p>
            </CardContent>
          </Card>

          <Card className="card-elevated border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-emerald-500" />
                Buying Stage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                // Infer buying stage from intent score if not set
                const intentNum = parseInt(String(account.intentScore || 0));
                const stage = (account as any).buyingStage || (
                  intentNum >= 86 ? 'Purchase' :
                  intentNum >= 70 ? 'Decision' :
                  intentNum >= 50 ? 'Consideration' :
                  intentNum >= 20 ? 'Awareness' :
                  'Target'
                );
                const stageColor = 
                  stage === 'Purchase' ? 'text-green-500' :
                  stage === 'Decision' ? 'text-cyan-500' :
                  stage === 'Consideration' ? 'text-yellow-500' :
                  stage === 'Awareness' ? 'text-orange-500' :
                  'text-gray-500';
                return (
                  <>
                    <div className={`text-2xl font-bold ${stageColor}`}>{stage}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(account as any).buyingStage ? '6sense' : 'Inferred from intent'}
                    </p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="intelligence" className="space-y-6">
          <TabsList className="bg-card border">
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({people?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Intelligence Tab */}
          <TabsContent value="intelligence" className="space-y-6">
            <IntelligenceTab accountId={accountId} account={account} />
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="space-y-6">
            {!people || people.length === 0 ? (
              <Card className="card-elevated">
                <CardContent className="py-16 text-center">
                  <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No contacts found</h3>
                  <p className="text-muted-foreground">No contacts have been added to this account yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {people.map((person) => (
                  <Link key={person.id} href={`/contacts/${person.id}`}>
                    <Card className="card-elevated hover:scale-[1.02] transition-all cursor-pointer group h-full">
                      <CardHeader>
                        <div className="flex items-start gap-3">
                          <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl shadow-lg flex-shrink-0">
                            <Users className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-1">
                              {person.name}
                            </CardTitle>
                            <CardDescription className="line-clamp-1">
                              {person.title || "No title"}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {person.email && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="h-4 w-4 flex-shrink-0" />
                            <span className="line-clamp-1">{person.email}</span>
                          </div>
                        )}
                        {person.linkedinUrl && (
                          <div className="flex items-center gap-2 text-sm">
                            <Linkedin className="h-4 w-4 flex-shrink-0 text-blue-500" />
                            <a 
                              href={person.linkedinUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-primary transition-colors line-clamp-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              LinkedIn Profile
                              <ExternalLink className="inline h-3 w-3 ml-1" />
                            </a>
                          </div>
                        )}
                        {person.location && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 flex-shrink-0" />
                            <span className="line-clamp-1">{person.location}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>




        </Tabs>
      </div>
    </div>
  );
}
