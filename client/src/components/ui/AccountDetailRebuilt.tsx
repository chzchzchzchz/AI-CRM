import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navigation } from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { BarChart3, ArrowLeft, Loader2, ExternalLink, Users, Shield, FileText, Phone, TrendingUp, MapPin, Calendar, Building2, DollarSign, Newspaper, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams } from "wouter";

export default function AccountDetail() {
  const { id } = useParams<{ id: string }>();
  const accountId = parseInt(id || "0");

  const { data: account, isLoading } = trpc.accounts.getById.useQuery({ id: accountId });
  const { data: people } = trpc.people.getByCompany.useQuery(
    { company: account?.name || "" },
    { enabled: !!account?.name }
  );
  
  const { data: gongCalls } = trpc.gong.getByAccountId.useQuery(
    { accountId },
    { enabled: accountId > 0 }
  );

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

  // Helper function to safely parse JSON and filter out empty/null values
  const parseJSON = (data: string | null | undefined): Record<string, any> => {
    if (!data) return {};
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (typeof parsed !== 'object') return {};
      
      // Filter out null, empty, and "No relevant text found" values
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

  const stackData = parseJSON(account.techStack);
  const researchData = parseJSON(account.rawData);
  const triggerData = parseJSON(account.triggerEvents);
  const rawData = parseJSON(account.rawData);

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
    if (numScore >= 70) return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Strong Fit</Badge>;
    if (numScore >= 40) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">Moderate Fit</Badge>;
    if (numScore > 0) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/50">Weak Fit</Badge>;
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navigation />
      
      <div className="container py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/accounts">
            <Button variant="outline" className="border-slate-700 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Accounts
            </Button>
          </Link>
        </div>

        {/* Account Header */}
        <div className="bg-gradient-to-r from-slate-900/80 to-slate-800/50 border border-slate-700 rounded-lg p-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-8 w-8 text-cyan-500" />
                <h1 className="text-4xl font-bold text-white">{account.name}</h1>
              </div>
              {account.domain && (
                <a 
                  href={`https://${account.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-2 text-lg mb-4"
                >
                  {account.domain}
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              <div className="flex flex-wrap gap-2">
                {account.intentScore && getIntentBadge(account.intentScore)}
                {account.industry && (
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    {account.industry}
                  </Badge>
                )}
                {account.region && (
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    <MapPin className="h-3 w-3 mr-1" />
                    {account.region}
                  </Badge>
                )}
                {account.employeeCount && (
                  <Badge variant="outline" className="border-slate-600 text-slate-300">
                    <Users className="h-3 w-3 mr-1" />
                    {account.employeeCount} employees
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-4">
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 text-cyan-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white">{people?.length || 0}</div>
                  <div className="text-xs text-slate-400">Contacts</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-700">
                <CardContent className="p-4 text-center">
                  <Phone className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-white">{gongCalls?.length || 0}</div>
                  <div className="text-xs text-slate-400">Calls</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Description */}
          {account.description && (
            <div className="mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
              <p className="text-slate-300 leading-relaxed">{account.description}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="intelligence">Intelligence & Research</TabsTrigger>
            <TabsTrigger value="tech">Tech Stack</TabsTrigger>
            <TabsTrigger value="signals">Buying Signals</TabsTrigger>
            <TabsTrigger value="people">People ({people?.length || 0})</TabsTrigger>
            <TabsTrigger value="calls">Calls ({gongCalls?.length || 0})</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-cyan-500" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {account.industry && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Industry</span>
                      <span className="text-white font-medium">{account.industry}</span>
                    </div>
                  )}
                  {account.employeeCount && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Employees</span>
                      <span className="text-white font-medium">{account.employeeCount}</span>
                    </div>
                  )}
                  {account.region && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Region</span>
                      <span className="text-white font-medium">{account.region}</span>
                    </div>
                  )}
                  {rawData.founded && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Founded</span>
                      <span className="text-white font-medium">{rawData.founded}</span>
                    </div>
                  )}
                  {rawData.type && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Type</span>
                      <span className="text-white font-medium">{rawData.type}</span>
                    </div>
                  )}
                  {(rawData.billing_city || rawData.billing_state) && (
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Location</span>
                      <span className="text-white font-medium">
                        {[rawData.billing_city, rawData.billing_state].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Intent & Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {account.intentScore && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Intent Score</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-lg">{account.intentScore}</span>
                        {getIntentBadge(account.intentScore)}
                      </div>
                    </div>
                  )}
                  {rawData.buying_stage && (
                    <div className="flex justify-between py-2 border-b border-slate-800">
                      <span className="text-slate-400">Buying Stage</span>
                      <span className="text-white font-medium">{rawData.buying_stage}</span>
                    </div>
                  )}
                  {rawData.profile_fit && (
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Profile Fit</span>
                      <span className="text-white font-medium">{rawData.profile_fit}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Intelligence & Research Tab */}
          <TabsContent value="intelligence" className="space-y-4">
            {Object.keys(researchData).length > 0 ? (
              Object.entries(researchData).map(([key, value]) => (
                <Card key={key} className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-cyan-500" />
                      {formatFieldName(key)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {String(value)}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No intelligence data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tech Stack Tab */}
          <TabsContent value="tech" className="space-y-4">
            {Object.keys(stackData).length > 0 ? (
              Object.entries(stackData).map(([key, value]) => (
                <Card key={key} className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-cyan-500" />
                      {formatFieldName(key)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {String(value)}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No tech stack data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Buying Signals Tab */}
          <TabsContent value="signals" className="space-y-4">
            {Object.keys(triggerData).length > 0 ? (
              <div className="grid gap-4">
                {/* Funding Section */}
                {(triggerData.summary_fundraising || triggerData.latest_funding_growth) && (
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        Funding & Growth
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {triggerData.latest_funding_growth && (
                        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <div className="text-sm text-green-400 mb-1">Latest Funding</div>
                          <div className="text-2xl font-bold text-white">
                            ${parseInt(triggerData.latest_funding_growth).toLocaleString()}
                          </div>
                        </div>
                      )}
                      {triggerData.summary_fundraising && (
                        <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                          {triggerData.summary_fundraising}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* News Section */}
                {(triggerData.summary_recent_news || triggerData.company_news_press) && (
                  <Card className="bg-slate-900/50 border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <Newspaper className="h-5 w-5 text-blue-500" />
                        Recent News & Events
                        {triggerData.company_news_press && (
                          <Badge variant="outline" className="ml-auto">
                            {triggerData.company_news_press} events
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {triggerData.summary_recent_news && (
                        <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                          {triggerData.summary_recent_news}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Other Trigger Data */}
                {Object.entries(triggerData)
                  .filter(([key]) => !key.includes('fundraising') && !key.includes('news') && !key.includes('funding'))
                  .map(([key, value]) => (
                    <Card key={key} className="bg-slate-900/50 border-slate-800">
                      <CardHeader>
                        <CardTitle className="text-white text-base flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-cyan-500" />
                          {formatFieldName(key)}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-slate-300 whitespace-pre-wrap text-sm">
                          {String(value)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            ) : (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-500">No buying signals available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* People Tab */}
          <TabsContent value="people">
            <div className="grid gap-4">
              {people && people.length > 0 ? (
                people.map((person) => (
                  <Link key={person.id} href={`/contacts/${person.id}`}>
                    <Card className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white mb-1">{person.name}</h3>
                            {person.title && (
                              <p className="text-cyan-400 text-sm mb-2">{person.title}</p>
                            )}
                            <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                              {person.email && <span>📧 {person.email}</span>}
                              {person.location && <span>📍 {person.location}</span>}
                            </div>
                          </div>
                          {person.linkedinUrl && (
                            <a
                              href={person.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-cyan-400 hover:text-cyan-300"
                            >
                              <ExternalLink className="h-5 w-5" />
                            </a>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="py-12 text-center">
                    <Users className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No contacts found</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls">
            <div className="grid gap-4">
              {gongCalls && gongCalls.length > 0 ? (
                gongCalls.map((call: any) => (
                  <Card key={call.id} className="bg-slate-900/50 border-slate-800">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white mb-1">{call.title || 'Untitled Call'}</h3>
                          {call.callDate && (
                            <p className="text-sm text-slate-400">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {new Date(call.callDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        {call.duration && (
                          <Badge variant="outline" className="border-slate-600">
                            {call.duration} min
                          </Badge>
                        )}
                      </div>
                      {call.summary && (
                        <div className="mb-3 p-3 bg-slate-950/50 rounded border border-slate-800">
                          <p className="text-sm text-slate-300">{call.summary}</p>
                        </div>
                      )}
                      {call.transcriptUrl && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-cyan-400 hover:text-cyan-300 mb-2">
                            View Transcript
                          </summary>
                          <div className="p-3 bg-slate-950/50 rounded border border-slate-800 text-slate-400 max-h-60 overflow-y-auto">
                            {call.transcriptUrl}
                          </div>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="py-12 text-center">
                    <Phone className="h-12 w-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500">No calls found</p>
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
