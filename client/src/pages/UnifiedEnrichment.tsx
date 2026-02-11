import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Navigation } from '@/components/Navigation';
import { SafeStreamdown } from '@/components/SafeStreamdown';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function UnifiedEnrichment() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [collatedData, setCollatedData] = useState<Record<string, any> | null>(null);

  const enrichMutation = trpc.unifiedEnrichment.enrich.useMutation();

  const handleEnrich = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email && !name && !domain && !linkedinUrl) {
      toast.error('Please provide at least one identifier (email, name, domain, or LinkedIn URL)');
      return;
    }

    try {
      setIsLoading(true);
      const result = await enrichMutation.mutateAsync({
        email: email || undefined,
        name: name || undefined,
        domain: domain || undefined,
        linkedinUrl: linkedinUrl || undefined,
      });

      if (result.success) {
        setInsights(result.insights || null);
        setCollatedData(result.collatedData || null);
        toast.success('Enrichment complete!');
      } else {
        toast.error(result.error || 'Enrichment failed');
      }
    } catch (error) {
      toast.error('Error during enrichment');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container max-w-4xl py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8 text-purple-500" />
            <h1 className="text-4xl font-bold">Unified Enrichment</h1>
          </div>
          <p className="text-muted-foreground">
            Search across all your data sources (Salesforce, 6sense, LinkedIn, Gong) and get AI-powered insights
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Enrich
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEnrich} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Name</label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Domain</label>
                  <Input
                    type="text"
                    placeholder="company.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">LinkedIn URL</label>
                  <Input
                    type="text"
                    placeholder="https://linkedin.com/in/johndoe"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-primary text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enriching...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Enrich with AI
                    </>
                  )}
                </Button>
              </form>

              {/* Data Sources */}
              <div className="mt-6 pt-6 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-3">DATA SOURCES</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Salesforce</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>6sense Intelligence</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span>LinkedIn Profiles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span>Gong Calls</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            {insights && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">AI Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <SafeStreamdown>{insights}</SafeStreamdown>
                </CardContent>
              </Card>
            )}

            {collatedData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Collated Data</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {collatedData.salesforce?.contact && (
                      <div className="p-3 bg-blue-500/10 rounded border border-blue-500/20">
                        <p className="font-semibold text-sm mb-1">Salesforce Contact</p>
                        <p className="text-xs text-muted-foreground">
                          {collatedData.salesforce.contact.FirstName} {collatedData.salesforce.contact.LastName}
                        </p>
                      </div>
                    )}

                    {collatedData.salesforce?.account && (
                      <div className="p-3 bg-blue-500/10 rounded border border-blue-500/20">
                        <p className="font-semibold text-sm mb-1">Salesforce Account</p>
                        <p className="text-xs text-muted-foreground">
                          {collatedData.salesforce.account.Name}
                        </p>
                      </div>
                    )}

                    {collatedData.sixsense?.company && (
                      <div className="p-3 bg-purple-500/10 rounded border border-purple-500/20">
                        <p className="font-semibold text-sm mb-1">6sense Company</p>
                        <p className="text-xs text-muted-foreground">
                          Intent: {collatedData.sixsense.company.intent_score || 'N/A'}
                        </p>
                      </div>
                    )}

                    {collatedData.linkedin?.profile && (
                      <div className="p-3 bg-cyan-500/10 rounded border border-cyan-500/20">
                        <p className="font-semibold text-sm mb-1">LinkedIn Profile</p>
                        <p className="text-xs text-muted-foreground">
                          {collatedData.linkedin.profile.headline || 'Profile found'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!insights && !collatedData && (
              <Card className="h-full flex items-center justify-center min-h-96">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">Enter search criteria and click "Enrich with AI" to get started</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
