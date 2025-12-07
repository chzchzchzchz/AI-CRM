import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Sparkles, TrendingUp, Users, Building2, Phone } from "lucide-react";

export default function Insights() {
  const { data: accounts } = trpc.accounts.list.useQuery();
  const { data: contacts } = trpc.contacts.list.useQuery();
  const { data: calls } = trpc.calls.list.useQuery();

  const enrichedAccounts = accounts?.filter(a => a.lastEnrichedAt) || [];
  const highEngagementContacts = contacts?.filter(c => (c.engagementScore || 0) > 70) || [];
  const recentCalls = calls?.slice(0, 10) || [];

  const avgEngagement = contacts?.length 
    ? contacts.reduce((sum, c) => sum + (c.engagementScore || 0), 0) / contacts.length 
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Insights</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered intelligence and analytics
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enriched Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{enrichedAccounts.length}</div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {accounts?.length ? Math.round((enrichedAccounts.length / accounts.length) * 100) : 0}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                High Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{highEngagementContacts.length}</div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Contacts with 70+ score
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{Math.round(avgEngagement)}</div>
                <Sparkles className="h-8 w-8 text-purple-600" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Across all contacts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Recent Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{recentCalls.length}</div>
                <Phone className="h-8 w-8 text-orange-600" />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Last 10 conversations
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <CardTitle>Top Enriched Accounts</CardTitle>
              </div>
              <CardDescription>Accounts with complete enrichment data</CardDescription>
            </CardHeader>
            <CardContent>
              {enrichedAccounts.length > 0 ? (
                <div className="space-y-3">
                  {enrichedAccounts.slice(0, 5).map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{account.name}</p>
                        <p className="text-sm text-muted-foreground">{account.industry || 'Unknown'}</p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {account.lastEnrichedAt 
                          ? new Date(account.lastEnrichedAt).toLocaleDateString()
                          : 'N/A'
                        }
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No enriched accounts yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                <CardTitle>High Engagement Contacts</CardTitle>
              </div>
              <CardDescription>Contacts showing strong engagement signals</CardDescription>
            </CardHeader>
            <CardContent>
              {highEngagementContacts.length > 0 ? (
                <div className="space-y-3">
                  {highEngagementContacts.slice(0, 5).map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                        <p className="text-sm text-muted-foreground">{contact.title || 'No title'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-600 rounded-full" 
                            style={{ width: `${contact.engagementScore}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{contact.engagementScore}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No high engagement contacts yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <CardTitle>AI-Powered Recommendations</CardTitle>
            </div>
            <CardDescription>Actionable insights from your data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm font-medium text-blue-900 mb-1">Focus on High Intent Accounts</p>
                <p className="text-sm text-blue-700">
                  {enrichedAccounts.length} accounts have been enriched with intelligence data. 
                  Prioritize outreach to these accounts for better conversion rates.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm font-medium text-green-900 mb-1">Engage Active Contacts</p>
                <p className="text-sm text-green-700">
                  {highEngagementContacts.length} contacts show high engagement scores. 
                  These are warm leads ready for personalized outreach.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-sm font-medium text-purple-900 mb-1">Leverage Call Intelligence</p>
                <p className="text-sm text-purple-700">
                  {recentCalls.length} recent calls contain valuable conversation insights. 
                  Review call summaries to identify common objections and opportunities.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
