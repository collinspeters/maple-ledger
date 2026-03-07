import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Invoices from "@/pages/invoices";
import Estimates from "@/pages/estimates";
import Transactions from "@/pages/transactions";
import Receipts from "@/pages/receipts";
import Review from "@/pages/review";
import Reports from "@/pages/reports";
import Banking from "@/pages/banking";
import Settings from "@/pages/settings";
import OnboardingPage from "@/pages/onboarding";
import ChartOfAccountsPage from "@/pages/chart-of-accounts";
import AIAssistant from "@/pages/ai-assistant";
import AccessPage from "@/pages/access";
import ReconciliationPage from "@/pages/reconciliation";

import Subscribe from "@/pages/subscribe";
import NotFound from "@/pages/not-found";

// Layout
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

function needsOnboarding(user: any): boolean {
  return !user?.businessName || !user?.province || !user?.fiscalYearStart;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (needsOnboarding(user) && location !== "/onboarding") {
    return <OnboardingPage />;
  }

  return (
    <div className="flex h-screen bg-background-alt">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Component />
        </main>
      </div>
    </div>
  );
}

function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (user) {
    if (needsOnboarding(user)) return <OnboardingPage />;
    return <Dashboard />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={() => <AuthRoute component={Login} />} />
      <Route path="/register" component={() => <AuthRoute component={Register} />} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/estimates" component={() => <ProtectedRoute component={Estimates} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/receipts" component={() => <ProtectedRoute component={Receipts} />} />
      <Route path="/review" component={() => <ProtectedRoute component={Review} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/banking" component={() => <ProtectedRoute component={Banking} />} />
      <Route path="/chart-of-accounts" component={() => <ProtectedRoute component={ChartOfAccountsPage} />} />
      <Route path="/ai-assistant" component={() => <ProtectedRoute component={AIAssistant} />} />
      <Route path="/access" component={() => <ProtectedRoute component={AccessPage} />} />
      <Route path="/reconciliation" component={() => <ProtectedRoute component={ReconciliationPage} />} />

      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/subscribe" component={Subscribe} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
