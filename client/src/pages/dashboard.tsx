import FinancialCards from "@/components/dashboard/financial-cards";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import AiAssistant from "@/components/dashboard/ai-assistant";
import ReceiptUpload from "@/components/dashboard/receipt-upload";
import QuickActions from "@/components/dashboard/quick-actions";
import TransactionReviewQueue from "@/components/transactions/transaction-review-queue";
import AddTransactionForm from "@/components/transactions/add-transaction-form";
import QuickAddTransaction from "@/components/transactions/quick-add-transaction";
import BankingConnectionCard from "@/components/dashboard/banking-connection-card";
import ErrorBoundary from "@/components/ui/error-boundary";

export default function Dashboard() {
  return (
    <div className="p-6 dashboard" data-testid="dashboard">
      <ErrorBoundary>
        <FinancialCards />
      </ErrorBoundary>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-8">
          <ErrorBoundary>
            <BankingConnectionCard />
          </ErrorBoundary>
          <ErrorBoundary>
            <TransactionReviewQueue />
          </ErrorBoundary>
          <ErrorBoundary>
            <RecentTransactions />
          </ErrorBoundary>
        </div>
        
        <div className="space-y-6">
          <ErrorBoundary>
            <QuickAddTransaction />
          </ErrorBoundary>
          <ErrorBoundary>
            <AiAssistant />
          </ErrorBoundary>
          <ErrorBoundary>
            <ReceiptUpload />
          </ErrorBoundary>
          <ErrorBoundary>
            <QuickActions />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
