import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsLeft, LogOut, Monitor, Moon, ShieldCheck, Sun } from "lucide-react";
import { Link, useLocation } from "wouter";
import { APP_TITLE } from "@/const";
import { isItemActive, visibleSections } from "./nav-model";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Mobile drawer dismisses itself after navigation. */
  onNavigate?: () => void;
};

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: SidebarProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const sections = visibleSections(user?.role);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <SidebarBrand collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-2"
        aria-label="Main"
      >
        {sections.map(section => (
          <div key={section.id} className="mb-4 last:mb-0">
            {/* The rule stands in for the group label when collapsed, so the
                rail keeps its grouping without a cramped abbreviation. */}
            {collapsed ? (
              <div className="mx-2 mb-2 h-px bg-sidebar-border first:hidden" />
            ) : (
              <div className="px-2 pt-1 pb-1.5 text-2xs font-medium tracking-wider text-ink-faint uppercase">
                {section.label}
              </div>
            )}

            <ul className="space-y-px">
              {section.items.map(item => {
                const active = isItemActive(item, location);
                const link = (
                  <Link
                    href={item.path}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md text-sm transition-colors duration-100",
                      collapsed ? "justify-center px-0 py-2" : "px-2 py-1.5",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-ink-muted hover:bg-sidebar-accent/60 hover:text-foreground"
                    )}
                  >
                    {/* Active marker rides the sidebar's outer edge. */}
                    <span
                      className={cn(
                        "absolute left-0 h-4 w-0.5 rounded-r-full bg-accent transition-opacity",
                        active ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        active ? "text-accent" : "text-ink-subtle group-hover:text-ink-muted"
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                return (
                  <li key={item.path}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <SidebarAccount collapsed={collapsed} />
    </div>
  );
}

function SidebarBrand({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 px-3",
        collapsed && "justify-center px-0"
      )}
    >
      <Link
        href="/"
        className="flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Wordmark />
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight">
            {APP_TITLE}
          </span>
        )}
      </Link>

      {!collapsed && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleCollapsed}
          className="ml-auto hidden lg:inline-flex"
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft className="size-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * A drawn mark rather than an <img>: it inherits the accent token, stays crisp
 * at any density, and costs no network request.
 */
function Wordmark() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground shadow-xs">
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 17.5 9 11l4 4 7.5-8" />
        <path d="M15.5 7H21v5.5" />
      </svg>
    </span>
  );
}

function SidebarAccount({ collapsed }: { collapsed: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries();
      window.location.href = "/login";
    },
  });

  const initials =
    user?.name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.trim()?.charAt(0)?.toUpperCase() ||
    "?";

  return (
    <div className="shrink-0 border-t border-sidebar-border p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors",
              "hover:bg-sidebar-accent outline-none focus-visible:ring-2 focus-visible:ring-ring",
              collapsed && "justify-center"
            )}
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-muted text-2xs font-semibold text-ink-muted ring-1 ring-border">
              {initials}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {user?.name || user?.email?.split("@")[0] || "Signed out"}
                </span>
                <span className="block truncate text-2xs text-ink-faint">
                  {user?.email || "—"}
                </span>
              </span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="top" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-xs font-medium">
              {user?.name || "Account"}
            </span>
            <span className="block truncate text-2xs text-ink-muted">
              {user?.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {toggleTheme && (
            <DropdownMenuItem onSelect={toggleTheme}>
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
              Switch to {theme === "dark" ? "light" : "dark"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/integrations">
              <Monitor className="size-4" />
              Integrations
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/security">
              <ShieldCheck className="size-4" />
              Security
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { Wordmark };
