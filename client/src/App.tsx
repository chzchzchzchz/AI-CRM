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
const Calls = lazyLoad(() => import("./pages/Calls"));
const Insights = lazyLoad(() => import("./pages/Insights"));
const Outreach = lazyLoad(() => import("./pages/Outreach"));
const RFPs = lazyLoad(() => import("./pages/RFPs"));
const Admin = lazyLoad(() => import("./pages/Admin"));
const SmartSearch = lazyLoad(() => import("./pages/SmartSearch"));
const DataValidation = lazyLoad(() => import("./pages/DataValidation"));
const BulkInsights = lazyLoad(() => import("./pages/BulkInsights"));
const SixsenseSync = lazyLoad(() => import("./pages/SixsenseSync"));
const SixsenseAnalytics = lazyLoad(() => import("./pages/SixsenseAnalytics"));
const CsvProcessor = lazyLoad(() => import("./pages/CsvProcessor"));
const DataHub = lazyLoad(() => import("./pages/DataHub"));
const ContentStudio = lazyLoad(() => import("./pages/ContentStudio"));
import { GlobalSearch } from "./components/GlobalSearch";
import { GlobalAIChat } from "./components/GlobalAIChat";
import { SupportBot } from "./components/SupportBot";
import { RepProvider } from "./contexts/RepContext";
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
      <Route path="/rfps" component={RFPs} />
      <Route path="/admin" component={Admin} />
      <Route path="/search" component={SmartSearch} />
      <Route path="/validation" component={DataValidation} />
      <Route path="/bulk-insights" component={BulkInsights} />
      <Route path="/sixsense-sync" component={SixsenseSync} />
      <Route path="/sixsense-analytics" component={SixsenseAnalytics} />
      <Route path="/csv-processor" component={CsvProcessor} />
      <Route path="/data-hub" component={DataHub} />
      <Route path="/content-studio" component={ContentStudio} />
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
        <RepProvider>
          <TooltipProvider>
            <Toaster />
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
            <Router />
            <GlobalAIChat />
            <SupportBot />
          </TooltipProvider>
        </RepProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
