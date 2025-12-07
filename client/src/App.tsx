import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Accounts from "./pages/Accounts";
import AccountDetail from "./pages/AccountDetail";
import Contacts from "./pages/Contacts";
import ContactDetail from "./pages/ContactDetail";
import Calls from "./pages/Calls";
import RFPs from "./pages/RFPs";
import Insights from "./pages/Insights";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/accounts"} component={Accounts} />
      <Route path={"/accounts/:id"} component={AccountDetail} />
      <Route path={"/contacts"} component={Contacts} />
      <Route path={"/contacts/:id"} component={ContactDetail} />
      <Route path={"/calls"} component={Calls} />
      <Route path={"/rfps"} component={RFPs} />
      <Route path={"/insights"} component={Insights} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
