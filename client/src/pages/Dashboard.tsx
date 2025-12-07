import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, Users, Phone, FileText, TrendingUp, Flame } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  const { data: contacts, isLoading: contactsLoading } = trpc.contacts.list.useQuery();
  const { data: calls, isLoading: callsLoading } = trpc.calls.list.useQuery();
  const { data: rfps, isLoading: rfpsLoading } = trpc.rfps.list.useQuery();

  const stats = [
    {
      title: "Total Accounts",
      value: accounts?.length || 0,
      icon: Building2,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      href: "/accounts",
    },
    {
      title: "Total Contacts",
      value: contacts?.length || 0,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-50",
      href: "/contacts",
    },
    {
      title: "Recent Calls",
      value: calls?.length || 0,
      icon: Phone,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      href: "/calls",
    },
    {
      title: "Active RFPs",
      value: rfps?.filter(r => r.status === 'active').length || 0,
      icon: FileText,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      href: "/rfps",
    },
  ];

  const highIntentAccounts = accounts?.slice(0, 5) || [];
  const recentCalls = calls?.slice(0, 5) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name || 'User'}</h1>
          <p className="text-muted-foreground mt-2">
            Your AI-powered sales intelligence command center
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.title} href={stat.href}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
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
