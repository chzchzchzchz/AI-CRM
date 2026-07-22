import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { heatMeta } from "@/lib/signal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, Phone, TrendingUp, Flame, Activity } from "lucide-react";
import { Link } from "wouter";

const CARD = "bg-slate-900 border-slate-800 shadow-none";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.accounts.getStats.useQuery();
  const { data: accounts, isLoading: accountsLoading } = trpc.accounts.list.useQuery();
  const { data: calls, isLoading: callsLoading } = trpc.calls.list.useQuery();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // Rank by intent so the "high intent" label is true, not just the first five rows.
  const highIntentAccounts = [...(accounts || [])]
    .sort((a: any, b: any) => (Number(b.intentScore) || 0) - (Number(a.intentScore) || 0))
    .slice(0, 5);
  const recentCalls = calls?.slice(0, 5) || [];

  const num = (v: number | undefined) => (statsLoading ? "—" : (v ?? 0).toLocaleString());

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-50">
            {getGreeting()}, {user?.name || "there"}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Your sales intelligence for today — every figure computed from live account data.
          </p>
        </div>

        {/* Portfolio pulse — one lead read (hot leads) with supporting stats, not a grid of identical cards */}
        <Card className={CARD}>
          <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
            <div className="lg:w-72 lg:pr-6 lg:border-r lg:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-400">
                <Flame className="h-4 w-4 text-emerald-400" />
                Hot leads right now
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono tabular-nums text-5xl font-semibold text-cyan-400 leading-none">
                  {num(stats?.hotLeads)}
                </span>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400">
                  <span aria-hidden>▲</span> Hot
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Accounts at intent <span className="font-mono">70+</span> — work these before a competitor does.
              </p>
            </div>

            <div className="flex-1 grid grid-cols-3 divide-x divide-slate-800">
              <div className="pr-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                  <Building2 className="h-3.5 w-3.5" /> Accounts
                </div>
                <div className="mt-2 font-mono tabular-nums text-2xl text-slate-100">
                  {num(stats?.totalAccounts)}
                </div>
                <div className="mt-1 text-xs text-slate-400">across all territories</div>
              </div>
              <div className="px-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                  <TrendingUp className="h-3.5 w-3.5" /> Warm leads
                </div>
                <div className="mt-2 font-mono tabular-nums text-2xl text-amber-400">
                  {num(stats?.warmLeads)}
                </div>
                <div className="mt-1 text-xs text-slate-400">intent 40–69</div>
              </div>
              <div className="pl-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-400">
                  <Phone className="h-3.5 w-3.5" /> Calls logged
                </div>
                <div className="mt-2 font-mono tabular-nums text-2xl text-slate-100">
                  {num(stats?.totalCalls)}
                </div>
                <div className="mt-1 text-xs text-slate-400">Gong recordings</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priority Actions — state the gap plainly instead of faking an urgent count */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Flame className="h-4 w-4 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-100">Priority actions</h2>
          </div>
          <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
            Grounded next-actions aren't wired up yet — this surface will list them once the
            recommendation engine is connected.
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* High Intent Accounts */}
          <Card className={CARD}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-100">
                <Activity className="h-4 w-4 text-cyan-400" />
                High-intent accounts
              </CardTitle>
              <CardDescription className="text-slate-400">Top accounts by intent score</CardDescription>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-slate-800/60 animate-pulse" />
                  ))}
                </div>
              ) : highIntentAccounts.length > 0 ? (
                <div className="space-y-2">
                  {highIntentAccounts.map((account: any) => {
                    const score = Number(account.intentScore) || 0;
                    const meta = heatMeta(score);
                    return (
                      <Link key={account.id} href={`/accounts/${account.id}`}>
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5 transition-colors hover:bg-slate-800/40 hover:border-cyan-500/40 cursor-pointer">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-100 truncate">{account.name}</p>
                            <p className="text-xs text-slate-400 truncate">{account.industry || "Unknown industry"}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 font-mono tabular-nums text-sm shrink-0 ${meta.text}`}>
                            <span aria-hidden>{meta.glyph}</span>
                            {score}
                            <span className="text-xs font-sans font-medium">{meta.label}</span>
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No accounts yet</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Calls */}
          <Card className={CARD}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-slate-100">
                <Phone className="h-4 w-4 text-cyan-400" />
                Recent calls
              </CardTitle>
              <CardDescription className="text-slate-400">Latest sales conversations</CardDescription>
            </CardHeader>
            <CardContent>
              {callsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-slate-800/60 animate-pulse" />
                  ))}
                </div>
              ) : recentCalls.length > 0 ? (
                <div className="space-y-2">
                  {recentCalls.map((call: any) => (
                    <Link key={call.id} href={`/calls/${call.id}`}>
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5 transition-colors hover:bg-slate-800/40 hover:border-cyan-500/40 cursor-pointer">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-100 truncate">{call.title || "Untitled call"}</p>
                          <p className="text-xs text-slate-400">
                            {call.callDate ? new Date(call.callDate).toLocaleDateString() : "No date"}
                          </p>
                        </div>
                        <span className="font-mono tabular-nums text-sm text-slate-300 shrink-0">
                          {call.duration ? `${Math.floor(call.duration / 60)}m` : "—"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No calls yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
