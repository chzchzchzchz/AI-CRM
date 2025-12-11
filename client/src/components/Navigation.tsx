import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { APP_LOGO } from "@/const";
import { Users, Phone, Search, BarChart3, Settings, Send, FileText, Home, UserCircle, Contact } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface NavigationProps {
  onSearchClick?: () => void;
}

export function Navigation({ onSearchClick }: NavigationProps) {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/accounts", label: "Accounts", icon: Users },
    { path: "/contacts", label: "Contacts", icon: Contact },
    { path: "/calls", label: "Calls", icon: Phone },
    { path: "/insights", label: "Insights", icon: BarChart3 },
    { path: "/outreach", label: "Outreach", icon: Send },
    // Admin-only pages
    { path: "/rfps", label: "RFPs", icon: FileText, adminOnly: true },
    { path: "/admin", label: "Admin", icon: Settings, adminOnly: true },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/">
            <span className="flex items-center hover:opacity-80 transition-opacity cursor-pointer">
              <img src={APP_LOGO} alt="the company" className="h-8" />
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.filter(item => {
              // Hide admin-only pages from non-admins
              if ((item as any).adminOnly && user?.role !== "admin") return false;
              return true;
            }).map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path || location.startsWith(item.path + "/");
              
              return (
                <Link key={item.path} href={item.path}>
                  <span
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-cyan-500/10 text-cyan-400"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={onSearchClick}
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Search</span>
            <span className="hidden sm:inline text-xs text-slate-500 ml-1">⌘K</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
