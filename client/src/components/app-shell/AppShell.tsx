import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ChevronsRight, Menu, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { findActiveItem } from "./nav-model";

const COLLAPSE_KEY = "shell:sidebar-collapsed";

/** Routes that render their own full-bleed layout and must not get the shell. */
const BARE_ROUTES = [
  "/login",
  "/signup",
  "/request-access",
  "/forgot-password",
];

export function isBareRoute(location: string) {
  return BARE_ROUTES.some(r => location === r || location.startsWith(r + "/"));
}

export function AppShell({
  children,
  onOpenSearch,
}: {
  children: React.ReactNode;
  onOpenSearch: () => void;
}) {
  const [location] = useLocation();
  const { user, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === "1"
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), []);

  // Auth screens and signed-out visitors get the page unchrome'd; the pages
  // themselves render the marketing/sign-in treatment.
  if (isBareRoute(location) || (!loading && !user)) {
    return <>{children}</>;
  }

  const active = findActiveItem(location);

  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border lg:block",
          "transition-[width] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          collapsed ? "w-14" : "w-60"
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            collapsed={false}
            onToggleCollapsed={toggleCollapsed}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle bg-background/80 px-3 backdrop-blur-md md:px-5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>

          {collapsed && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label="Expand sidebar"
            >
              <ChevronsRight className="size-4" />
            </Button>
          )}

          <h1 className="truncate text-sm font-semibold tracking-tight">
            {active?.label ?? "Dashboard"}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <SearchTrigger onClick={onOpenSearch} />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-3 py-5 md:px-5 lg:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Reads as a search field but behaves as a button — the palette owns the real
 * input, so a focusable text box here would be a keyboard trap.
 */
function SearchTrigger({ onClick }: { onClick: () => void }) {
  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex h-8 items-center gap-2 rounded-md border border-border bg-surface pl-2.5 pr-1.5 text-sm shadow-xs",
        "text-ink-faint transition-colors hover:border-border-strong hover:text-ink-muted",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "w-8 justify-center sm:w-56 sm:justify-start"
      )}
      aria-label="Search"
    >
      <Search className="size-4 shrink-0" />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-2xs text-ink-faint sm:inline-flex">
        {isMac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}
