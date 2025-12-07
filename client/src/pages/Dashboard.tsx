import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, Users, Phone, FileText, TrendingUp, Flame, Calendar } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.accounts.getStats.useQuery();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  const { data: calls, isLoading: callsLoading } = trpc.calls.list.useQuery();

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const highIntentAccounts = accounts?.slice(0, 5) || [];
  const recentCalls = calls?.slice(0, 5) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with personalized greeting */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {getGreeting()}, {user?.name || 'there'} 👋
          </h1>
          <p className="text-muted-foreground mt-2">
            Here's your sales intelligence for today
          </p>
        </div>

        {/* Stats Cards with colored borders */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Accounts"
            value={statsLoading ? "..." : stats?.totalAccounts || 0}
            subtitle="Across all territories"
            icon={Building2}
            borderColor="blue"
          />
          <StatCard
            title="Hot Leads"
            value={statsLoading ? "..." : stats?.hotLeads || 0}
            subtitle="Intent score 70+"
            icon={Flame}
            borderColor="red"
          />
          <StatCard
            title="Warm Leads"
            value={statsLoading ? "..." : stats?.warmLeads || 0}
            subtitle="Intent score 40-69"
            icon={TrendingUp}
            borderColor="orange"
          />
          <StatCard
            title="This Week"
            value={statsLoading ? "..." : stats?.tasksThisWeek || 8}
            subtitle="Tasks to complete"
            icon={Calendar}
            borderColor="cyan"
          />
        </div>

        {/* Priority Actions Section - Placeholder */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Flame className="h-5 w-5 text-[#EF4444]" />
            <h2 className="text-xl font-bold">Priority Actions</h2>
            <span className="px-2 py-1 bg-[#8B5CF6] text-white text-xs font-medium rounded-full">
              3 urgent
            </span>
          </div>
          <div className="text-muted-foreground text-sm">
            Priority action cards coming soon...
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-red-500" />
                <CardTitle>High Intent Accounts</CardTitle>
              </div>
              <CardDescription>Accounts showing strong buying signals</CardDescription>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 skeleton rounded-lg" />
                  ))}
                </div>
              ) : highIntentAccounts.length > 0 ? (
                <div className="space-y-3">
                  {highIntentAccounts.map((account) => (
                    <Link key={account.id} href={`/accounts/${account.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                        <div>
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-muted-foreground">{account.industry || 'Unknown industry'}</p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No accounts yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-blue-500" />
                <CardTitle>Recent Calls</CardTitle>
              </div>
              <CardDescription>Latest sales conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 skeleton rounded-lg" />
                  ))}
                </div>
              ) : recentCalls.length > 0 ? (
                <div className="space-y-3">
                  {recentCalls.map((call) => (
                    <Link key={call.id} href={`/calls/${call.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors">
                        <div>
                          <p className="font-medium">{call.title || 'Untitled Call'}</p>
                          <p className="text-sm text-muted-foreground">
                            {call.callDate ? new Date(call.callDate).toLocaleDateString() : 'No date'}
                          </p>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {call.duration ? `${Math.floor(call.duration / 60)}m` : '-'}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No calls yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
