import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { Plus, Download, RefreshCw, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import TransactionModal from "@/components/transaction-modal";

import React from "react";

const QuickActions = React.memo(function QuickActions() {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Sync bank account mutation
  const syncBankMutation = useMutation({
    mutationFn: () => apiRequest("/api/plaid/sync-transactions", {
      method: "POST",
    }),
    onSuccess: (data: { syncedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Transactions Synced",
        description: `Successfully imported ${data.syncedCount} new transactions.`,
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync transactions. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Generate P&L report mutation
  const generateReportMutation = useMutation({
    mutationFn: () => apiRequest("/api/reports/profit-loss", {
      method: "GET",
    }),
    onSuccess: () => {
      toast({
        title: "Report Generated",
        description: "P&L report has been generated successfully.",
      });
      // Redirect to reports page or open report in new tab
      window.open('/reports', '_blank');
    },
    onError: () => {
      toast({
        title: "Report Generation Failed",
        description: "Failed to generate P&L report. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAction = (actionName: string) => {
    setLoadingAction(actionName);
    
    switch (actionName) {
      case "sync-bank":
        syncBankMutation.mutate();
        break;
      case "generate-report":
        generateReportMutation.mutate();
        break;
      default:
        // For any other actions, just reset loading state
        setTimeout(() => {
          setLoadingAction(null);
        }, 1500);
    }
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
      <Card className="shadow-card border-0 rounded-xl bg-white quick-actions" data-testid="quick-actions">
        <CardHeader className="border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
        </CardHeader>
        
        <CardContent className="p-6">
          <div className="space-y-3">
            {actions.map((action) => {
              const isLoading = loadingAction === action.id || 
                (action.id === "sync-bank" && syncBankMutation.isPending) ||
                (action.id === "generate-report" && generateReportMutation.isPending);
              const Icon = isLoading ? Check : action.icon;
              
              return (
                <Button aria-label="Ghost button" key={action.id}
                  variant="ghost"
                  o
                  disabled={isLoading}
                  className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors justify-start h-auto"
                  data-testid={`quick-action-${action.id}`}
                >
      <ErrorBoundary>
        <div className={`w-8 h-8 ${action.iconBg} rounded-lg flex items-center justify-center`}>
                    <Icon className={`${action.iconColor} text-sm h-4 w-4 ${
                      isLoading ? "text-secondary" : ""
                    }`} />
                  </div>
                  <span className="font-medium text-gray-900">{action.label}</span>
      </ErrorBoundary>
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
});

export default QuickActions;
