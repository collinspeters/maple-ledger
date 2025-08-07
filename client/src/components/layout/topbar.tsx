import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import TransactionModal from "@/components/transaction-modal";

const pageNames: Record<string, { title: string; description: string }> = {
  "/": { title: "Dashboard", description: "Welcome back! Here's your business overview." },
  "/clients": { title: "Clients", description: "Manage your client relationships and information." },
  "/invoices": { title: "Invoices", description: "Create and track your customer invoices." },
  "/estimates": { title: "Estimates", description: "Generate professional quotes for potential clients." },
  "/transactions": { title: "Transactions", description: "Review and categorize your business transactions." },
  "/receipts": { title: "Receipts", description: "Upload and manage your business receipts." },
  "/reports": { title: "Reports", description: "Generate financial reports and insights." },
  "/banking": { title: "Banking", description: "Connect and manage your bank accounts." },
  "/settings": { title: "Settings", description: "Configure your account and preferences." },
};

export default function Topbar() {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [location] = useLocation();
  
  const currentPage = pageNames[location] || { title: "BookkeepAI", description: "AI-Powered Bookkeeping" };

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{currentPage.title}</h1>
            <p className="text-sm text-gray-600 mt-1">{currentPage.description}</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                placeholder="Search transactions, clients..." 
                className="pl-10 w-64 bg-gray-50 border-gray-200 focus:bg-white"
                aria-label="Search transactions, clients, and other records"
              />
            </div>
            
            {/* Notifications */}
            <Button variant="ghost" size="sm" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5 text-gray-600" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
            </Button>
            
            {/* AI Processing Indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg" role="status" aria-label="AI system status: ready">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">AI Ready</span>
            </div>
            
            {/* Quick Actions */}
            <Button 
              onClick={() => setShowTransactionModal(true)}
              className="btn-modern bg-primary hover:bg-primary-dark text-white shadow-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        </div>
      </header>

      <TransactionModal 
        open={showTransactionModal}
        onOpenChange={setShowTransactionModal}
      />
    </>
  );
}
