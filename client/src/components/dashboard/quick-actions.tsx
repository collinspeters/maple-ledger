import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Download, RefreshCw, Check } from "lucide-react";
import TransactionModal from "@/components/transaction-modal";

export default function QuickActions() {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleAction = (actionName: string) => {
    setLoadingAction(actionName);
    // Simulate action
    setTimeout(() => {
      setLoadingAction(null);
    }, 1500);
  };

  const actions = [
    {
      id: "add-transaction",
      icon: Plus,
      label: "Add Manual Transaction",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      onClick: () => setShowTransactionModal(true),
    },
    {
      id: "generate-report",
      icon: Download,
      label: "Generate P&L Report",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
      onClick: () => handleAction("generate-report"),
    },
    {
      id: "sync-bank",
      icon: RefreshCw,
      label: "Sync Bank Account",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      onClick: () => handleAction("sync-bank"),
    },
  ];

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="space-y-3">
            {actions.map((action) => {
              const isLoading = loadingAction === action.id;
              const Icon = isLoading ? Check : action.icon;
              
              return (
                <Button
                  key={action.id}
                  variant="ghost"
                  onClick={action.onClick}
                  disabled={isLoading}
                  className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors justify-start h-auto"
                >
                  <div className={`w-8 h-8 ${action.iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`${action.iconColor} text-sm h-4 w-4 ${
                      isLoading ? "text-secondary" : ""
                    }`} />
                  </div>
                  <span className="font-medium text-gray-900">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <TransactionModal 
        open={showTransactionModal}
        onOpenChange={setShowTransactionModal}
      />
    </>
  );
}
