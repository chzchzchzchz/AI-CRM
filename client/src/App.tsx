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
const Opportunities = lazyLoad(() => import("./pages/Opportunities"));
const Calls = lazyLoad(() => import("./pages/Calls"));
const Insights = lazyLoad(() => import("./pages/Insights"));
const Outreach = lazyLoad(() => import("./pages/Outreach"));
const Sequences = lazyLoad(() => import("./pages/Sequences"));
const RFPs = lazyLoad(() => import("./pages/RFPs"));
const Integrations = lazyLoad(() => import("./pages/Integrations"));
const Admin = lazyLoad(() => import("./pages/Admin"));
const AdminApproval = lazyLoad(() => import("./pages/AdminApproval"));
const SmartSearch = lazyLoad(() => import("./pages/SmartSearch"));
const DataValidation = lazyLoad(() => import("./pages/DataValidation"));
const BulkInsights = lazyLoad(() => import("./pages/BulkInsights"));
const SixsenseSync = lazyLoad(() => import("./pages/SixsenseSync"));
const SalesforceSync = lazyLoad(() => import("./pages/SalesforceSync"));
const SixsenseAnalytics = lazyLoad(() => import("./pages/SixsenseAnalytics"));
const CsvProcessor = lazyLoad(() => import("./pages/CsvProcessor"));
const DataHub = lazyLoad(() => import("./pages/DataHub"));
const ContentStudio = lazyLoad(() => import("./pages/ContentStudio"));
const TranscriptAnalyzer = lazyLoad(() => import("./pages/TranscriptAnalyzer"));
const AITools = lazyLoad(() => import("./pages/AITools"));
const TopAccounts = lazyLoad(() => import("./pages/TopAccounts"));
const Login = lazyLoad(() => import("./pages/Login"));
const SignUp = lazyLoad(() => import("./pages/SignUp"));
const RequestAccess = lazyLoad(() => import("./pages/RequestAccess"));
const ForgotPassword = lazyLoad(() => import("./pages/ForgotPassword"));
const LeadProcessor = lazyLoad(() => import("./pages/LeadProcessor"));
const WebinarGenerator = lazyLoad(() => import("./pages/WebinarGenerator"));
const Security = lazyLoad(() => import("./pages/Security"));
import { GlobalSearch } from "./components/GlobalSearch";
import { GlobalAIChat } from "./components/GlobalAIChat";
import { SupportBot } from "./components/SupportBot";
import { AppShell } from "./components/app-shell/AppShell";
import { RepProvider } from "./contexts/RepContext";
import { useState, useEffect } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route path="/request-access" component={RequestAccess} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path={"/"} component={Home} />
      <Route path="/accounts" component={Accounts} />
      <Route path="/accounts/:id" component={AccountDetail} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/contacts/:id" component={ContactDetail} />
      <Route path="/opportunities" component={Opportunities} />
      <Route path="/calls" component={Calls} />
      <Route path="/insights" component={Insights} />
      <Route path="/outreach" component={Outreach} />
      <Route path="/sequences" component={Sequences} />
      <Route path="/rfps" component={RFPs} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/admin" component={Admin} />
      <Route path="/admin/approval" component={AdminApproval} />
      <Route path="/search" component={SmartSearch} />
      <Route path="/validation" component={DataValidation} />
      <Route path="/bulk-insights" component={BulkInsights} />
      <Route path="/sixsense-sync" component={SixsenseSync} />
      <Route path="/salesforce-sync" component={SalesforceSync} />
      <Route path="/sixsense-analytics" component={SixsenseAnalytics} />
      <Route path="/csv-processor" component={CsvProcessor} />
      <Route path="/data-hub" component={DataHub} />
      <Route path="/content-studio" component={ContentStudio} />
      <Route path="/transcript-analyzer" component={TranscriptAnalyzer} />
      <Route path="/tools" component={AITools} />
      <Route path="/top-accounts" component={TopAccounts} />
      <Route path="/lead-processor" component={LeadProcessor} />
      <Route path="/webinar-generator" component={WebinarGenerator} />
      <Route path="/security" component={Security} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(open => !open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ErrorBoundary>
      {/* `switchable` persists the choice and exposes useTheme().toggleTheme,
          which the sidebar account menu drives. */}
      <ThemeProvider defaultTheme="dark" switchable>
        <RepProvider>
          <TooltipProvider delayDuration={300}>
            <Toaster />
            <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
            <AppShell onOpenSearch={() => setSearchOpen(true)}>
              <Router />
            </AppShell>
            <GlobalAIChat />
            <SupportBot />
          </TooltipProvider>
        </RepProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
