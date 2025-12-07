import { useAuth } from "@/_core/hooks/useAuth";
import { StatCard } from "@/components/StatCard";
import { Building2, Flame, TrendingUp, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user } = useAuth();
  const { data: stats, isLoading } = trpc.accounts.getStats.useQuery();

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {getGreeting()}, {user?.name || "there"} 👋
        </h1>
        <p className="text-muted-foreground">
          Here's your sales intelligence for today
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Accounts"
          value={isLoading ? "..." : stats?.totalAccounts || 0}
          subtitle="Across all territories"
          icon={Building2}
          borderColor="blue"
        />
        <StatCard
          title="Hot Leads"
          value={isLoading ? "..." : stats?.hotLeads || 0}
          subtitle="Intent score 70+"
          icon={Flame}
          borderColor="red"
        />
        <StatCard
          title="Warm Leads"
          value={isLoading ? "..." : stats?.warmLeads || 0}
          subtitle="Intent score 40-69"
          icon={TrendingUp}
          borderColor="orange"
        />
        <StatCard
          title="This Week"
          value={isLoading ? "..." : stats?.tasksThisWeek || 8}
          subtitle="Tasks to complete"
          icon={Calendar}
          borderColor="cyan"
        />
      </div>

      {/* Priority Actions Section - Coming Soon */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Flame className="h-5 w-5 text-[#EF4444]" />
          <h2 className="text-xl font-bold">Priority Actions</h2>
          <span className="px-2 py-1 bg-[#8B5CF6] text-white text-xs font-medium rounded-full">
            3 urgent
          </span>
        </div>
        <div className="text-muted-foreground">
          Priority action cards coming soon...
        </div>
      </div>

      {/* This Week's Focus Section - Coming Soon */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">This Week's Focus</h2>
        <div className="text-muted-foreground">
          Task checklist coming soon...
        </div>
      </div>

      {/* Quick Actions Section - Coming Soon */}
      <div>
        <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
        <div className="text-muted-foreground">
          Quick action buttons coming soon...
        </div>
      </div>
    </div>
  );
}
