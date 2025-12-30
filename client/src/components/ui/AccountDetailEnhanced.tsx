import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/Navigation";
import { AIAssistant } from "@/components/AIAssistant";
import { trpc } from "@/lib/trpc";
import { 
  BarChart3, ArrowLeft, Loader2, ExternalLink, Users, Shield, 
  FileText, Phone, TrendingUp, MapPin, Calendar, Building2, 
  DollarSign, Newspaper, Briefcase, Sparkles, Copy, Check, Zap
} from "lucide-react";
import { Link, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function AccountDetailEnhanced() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState<Record<number, boolean>>({});

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });
  const { data: people } = trpc.people.getByCompany.useQuery(
    { company: account?.name || "" },
    { enabled: !!account?.name }
  );
  
  const { data: gongCalls } = trpc.gong.getByAccountId.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

  const generateSummaryMutation = trpc.ai.generateAccountSummary.useMutation();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

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

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Helper function to safely parse JSON and filter out empty/null values
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

  const stackData = parseJSON(account?.stack);
  const researchData = parseJSON(account?.research);
  const triggerData = parseJSON(account?.trigger);
  const rawData = {};

  // Helper to format field names
  const formatFieldName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/summary /gi, '')
      .replace(/^find /, '')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get intent score badge
  const getIntentBadge = (score: string | number) => {
    const numScore = typeof score === 'string' ? parseInt(score) : score;
    if (numScore >= 70) return { color: 'border-green-500/30 text-green-400 bg-green-500/10', label: 'Hot Lead' };
    if (numScore >= 40) return { color: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10', label: 'Warm Lead' };
    return { color: 'border-orange-500/30 text-orange-400 bg-orange-500/10', label: 'Cold Lead' };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navigation />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Navigation />
        <div className="container py-20">
          <Card className="bg-slate-900/50 border-slate-800 max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-16 w-16 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">Account not found</p>
              <Link href="/accounts">
                <Button className="bg-cyan-600 hover:bg-cyan-700">
                  Back to Accounts
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const intentBadge = account.intentScore ? getIntentBadge(account.intentScore) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      <AIAssistant context={{ type: "account", id: accountId, name: account.name }} />
      
      <div className="container py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/accounts" className="hover:text-cyan-400 transition-colors">
            Accounts
          </Link>
          <span>/</span>
          <span className="text-white">{account.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold text-white mb-2">{account.name}</h1>
            {account.domain && (
              <a 
                href={`https://${account.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2 mb-4"
              >
                {account.domain}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {account.industry && (
                <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">
                  <Briefcase className="h-3 w-3 mr-1" />
                  {account.industry}
                </Badge>
              )}
              {account.employeeCount && (
                <Badge variant="outline" className="border-purple-500/30 text-purple-400">
                  <Users className="h-3 w-3 mr-1" />
                  {account.employeeCount}
                </Badge>
              )}
              {account.region && (
                <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                  <MapPin className="h-3 w-3 mr-1" />
                  {account.region}
                </Badge>
              )}
              {intentBadge && (
                <Badge variant="outline" className={intentBadge.color}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {intentBadge.label} ({account.intentScore})
                </Badge>
              )}
            </div>
          </div>
          
          <Link href="/accounts">
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* AI Summary Section */}
        <Card className="bg-gradient-to-br from-cyan-950/20 to-blue-950/20 border-cyan-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                AI-Generated Account Intelligence
              </CardTitle>
              <Button
                onClick={handleGenerateSummary}
                disabled={isGeneratingSummary}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                {isGeneratingSummary ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Summary
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {aiSummary && (
            <CardContent>
              <Streamdown className="text-slate-300 leading-relaxed">{aiSummary}</Streamdown>
            </CardContent>
          )}
        </Card>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-8 w-8 text-cyan-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{people?.length || 0}</div>
              <div className="text-sm text-slate-400">Key Contacts</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Phone className="h-8 w-8 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{gongCalls?.length || 0}</div>
              <div className="text-sm text-slate-400">Gong Calls</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Shield className="h-8 w-8 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{Object.keys(stackData).length}</div>
              <div className="text-sm text-slate-400">Tech Stack Items</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <Zap className="h-8 w-8 text-yellow-500" />
              </div>
              <div className="text-3xl font-bold text-white mb-1">{Object.keys(triggerData).length}</div>
              <div className="text-sm text-slate-400">Buying Signals</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({people?.length || 0})</TabsTrigger>
            <TabsTrigger value="calls">Calls ({gongCalls?.length || 0})</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Company Info */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-cyan-500" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {account.description && (
                    <div>
                      <p className="text-sm font-semibold text-slate-400 mb-1">Description</p>
                      <p className="text-slate-300 leading-relaxed">{account.description}</p>
                    </div>
                  )}
                  {account.industry && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Industry</span>
                      <span className="text-slate-300">{account.industry}</span>
                    </div>
                  )}
                  {account.employeeCount && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Employees</span>
                      <span className="text-slate-300">{account.employeeCount}</span>
                    </div>
                  )}
                  {account.region && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">Region</span>
                      <span className="text-slate-300">{account.region}</span>
                    </div>
                  )}

                </CardContent>
              </Card>

              {/* Tech Stack */}
              {Object.keys(stackData).length > 0 && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-cyan-500" />
                      Technology Stack
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stackData).slice(0, 8).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-start gap-2">
                          <span className="text-sm font-medium text-slate-400">{formatFieldName(key)}</span>
                          <span className="text-sm text-slate-300 text-right">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Buying Signals */}
            {Object.keys(triggerData).length > 0 && (
              <Card className="bg-gradient-to-br from-yellow-950/20 to-orange-950/20 border-yellow-500/30">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Buying Signals & Triggers
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Recent events indicating purchase intent
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {Object.entries(triggerData).map(([key, value]) => (
                      <div key={key} className="p-4 bg-slate-950/30 rounded-lg border border-yellow-500/20">
                        <p className="text-sm font-semibold text-yellow-400 mb-2">{formatFieldName(key)}</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Research Data */}
            {Object.keys(researchData).length > 0 && (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Newspaper className="h-5 w-5 text-cyan-500" />
                    Research & Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(researchData).map(([key, value]) => (
                      <div key={key} className="border-b border-slate-800 pb-4 last:border-0 last:pb-0">
                        <p className="text-sm font-semibold text-slate-400 mb-2">{formatFieldName(key)}</p>
                        <p className="text-slate-300 leading-relaxed">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-cyan-500" />
                  Key Contacts ({people?.length || 0})
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Decision makers and stakeholders
                </CardDescription>
              </CardHeader>
              <CardContent>
                {people && people.length > 0 ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {people.map((person) => (
                      <Link key={person.id} href={`/contacts/${person.id}`}>
                        <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer group">
                          <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
                            {person.name}
                          </h4>
                          {person.title && (
                            <p className="text-sm text-slate-400 mb-3">{person.title}</p>
                          )}
                          <div className="space-y-2">
                            {person.email && (
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="truncate">{person.email}</span>
                              </div>
                            )}
                            {person.location && (
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <MapPin className="h-3 w-3" />
                                <span>{person.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500">No contacts found for this account</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Phone className="h-5 w-5 text-cyan-500" />
                  Gong Calls ({gongCalls?.length || 0})
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Sales conversations and call recordings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gongCalls && gongCalls.length > 0 ? (
                  <div className="space-y-4">
                    {gongCalls.map((call) => (
                      <div key={call.id} className="p-5 bg-slate-950/50 rounded-lg border border-slate-800 hover:border-cyan-500/30 transition-all">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <h4 className="text-white font-semibold mb-2 text-lg">{call.title || 'Untitled Call'}</h4>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                              {call.callDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {new Date(call.callDate).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </span>
                              )}
                              {call.duration && (
                                <Badge variant="outline" className="border-slate-700 text-slate-400">
                                  {Math.floor(parseInt(call.duration) / 60)}m {parseInt(call.duration) % 60}s
                                </Badge>
                              )}
                              {call.participants && (
                                <span className="text-xs">👥 {call.participants}</span>
                              )}
                            </div>
                          </div>
                          {call.recordingUrl && (
                            <a
                              href={call.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors shrink-0"
                            >
                              <ExternalLink className="h-5 w-5 text-cyan-400" />
                            </a>
                          )}
                        </div>
                        
                        {call.summary && (
                          <div className="mb-3 p-3 bg-slate-900/50 rounded border border-slate-800">
                            <p className="text-sm text-slate-300 leading-relaxed">{call.summary}</p>
                          </div>
                        )}
                        
                        {call.transcriptUrl && (
                          <div className="mt-3">
                            <button
                              onClick={() => setShowFullTranscript(prev => ({ ...prev, [call.id]: !prev[call.id] }))}
                              className="flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              <FileText className="h-4 w-4" />
                              {showFullTranscript[call.id] ? 'Hide' : 'View'} Full Transcript
                            </button>
                            {showFullTranscript[call.id] && (
                              <div className="mt-3 p-4 bg-slate-900 rounded border border-slate-800 max-h-96 overflow-y-auto">
                                <pre className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                                  {call.transcriptUrl}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Phone className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500">No Gong calls found for this account</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intelligence Tab */}
          <TabsContent value="intelligence">
            <div className="space-y-6">
              {/* All Data */}
              {Object.keys(rawData).length > 0 && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-cyan-500" />
                      Complete Data Profile
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      All available information about this account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      {Object.entries(rawData).map(([key, value]) => (
                        <div key={key} className="p-3 bg-slate-950/50 rounded border border-slate-800">
                          <p className="text-xs font-semibold text-slate-500 mb-1">{formatFieldName(key)}</p>
                          <p className="text-sm text-slate-300">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
