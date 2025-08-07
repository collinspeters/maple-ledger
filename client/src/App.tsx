import React, { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { checkSubscriptionAccess } from "@/lib/auth";
import { Loader2 } from "lucide-react";

// Critical pages loaded immediately
import Login from "@/pages/login";
import Register from "@/pages/register";
import Subscribe from "@/pages/subscribe";
import NotFound from "@/pages/not-found";

// Lazy load heavy pages for better performance
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Clients = lazy(() => import("@/pages/clients"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Estimates = lazy(() => import("@/pages/estimates"));
const Transactions = lazy(() => import("@/pages/transactions"));
const Receipts = lazy(() => import("@/pages/receipts"));
const Reports = lazy(() => import("@/pages/reports"));
const Banking = lazy(() => import("@/pages/banking"));
const Settings = lazy(() => import("@/pages/settings"));
const ChartOfAccountsPage = lazy(() => import("@/pages/chart-of-accounts"));
const AIAssistant = lazy(() => import("@/pages/ai-assistant"));

// Layout
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

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

  if (!checkSubscriptionAccess(user)) {
    return <Subscribe />;
  }

  return (
    <div className="flex h-screen bg-background-alt">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-gray-600">Loading...</span>
              </div>
            </div>
          }>
            <Component />
          </Suspense>
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
    if (!checkSubscriptionAccess(user)) {
      return <Subscribe />;
    }
    return <Dashboard />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={() => <AuthRoute component={Login} />} />
      <Route path="/register" component={() => <AuthRoute component={Register} />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/estimates" component={() => <ProtectedRoute component={Estimates} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/receipts" component={() => <ProtectedRoute component={Receipts} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/banking" component={() => <ProtectedRoute component={Banking} />} />
      <Route path="/chart-of-accounts" component={() => <ProtectedRoute component={ChartOfAccountsPage} />} />
      <Route path="/ai-assistant" component={() => <ProtectedRoute component={AIAssistant} />} />

      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
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
