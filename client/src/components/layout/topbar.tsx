import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import TransactionModal from "@/components/transaction-modal";

export default function Topbar() {
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  return (
    <>
      <header className="bg-surface border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
            <p className="text-sm text-gray-600">Welcome back! Here's your business overview.</p>
          </div>
          <div className="flex items-center space-x-4">
            {/* AI Processing Indicator */}
            <div className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">AI Processing...</span>
            </div>
            
            {/* Quick Actions */}
            <Button 
              onClick={() => setShowTransactionModal(true)}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
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
