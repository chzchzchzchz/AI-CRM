import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { lazyLoad } from "./components/LazyRoute";

// Lazy load heavy pages to reduce initial bundle size
const Accounts = lazyLoad(() => import("./pages/Accounts"));
const AccountDetail = lazyLoad(() => import("./pages/AccountDetail"));
const Contacts = lazyLoad(() => import("./pages/Contacts"));
const ContactDetail = lazyLoad(() => import("./pages/ContactDetail"));
const Insights = lazyLoad(() => import("./pages/Insights"));
const Calls = lazyLoad(() => import("./pages/Calls"));
const Outreach = lazyLoad(() => import("./pages/Outreach"));
const Admin = lazyLoad(() => import("./pages/Admin"));
const SmartSearch = lazyLoad(() => import("./pages/SmartSearch"));
import { GlobalSearch } from "./components/GlobalSearch";
import { GlobalAIChat } from "./components/GlobalAIChat";
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/accounts/:id" component={AccountDetail} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/contacts/:id" component={ContactDetail} />
      <Route path="/calls" component={Calls} />
      <Route path="/insights" component={Insights} />
      <Route path="/outreach" component={Outreach} />
      <Route path="/admin" component={Admin} />
      <Route path="/search" component={SmartSearch} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
      >
        <TooltipProvider>
          <Toaster />
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
          <Router />
          <GlobalAIChat />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
