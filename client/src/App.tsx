import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { checkSubscriptionAccess } from "@/lib/auth";

// Pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Invoices from "@/pages/invoices";
import Estimates from "@/pages/estimates";
import Transactions from "@/pages/transactions";
import Receipts from "@/pages/receipts";
import Reports from "@/pages/reports";
import BankConnections from "@/pages/bank-connections";
import Settings from "@/pages/settings";
import Subscribe from "@/pages/subscribe";
import NotFound from "@/pages/not-found";

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
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
      <Route path="/estimates" component={() => <ProtectedRoute component={Estimates} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/receipts" component={() => <ProtectedRoute component={Receipts} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={Reports} />} />
      <Route path="/bank-connections" component={() => <ProtectedRoute component={BankConnections} />} />
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
