import FinancialCards from "@/components/dashboard/financial-cards";
import RecentTransactions from "@/components/dashboard/recent-transactions";
import AiAssistant from "@/components/dashboard/ai-assistant";
import ReceiptUpload from "@/components/dashboard/receipt-upload";
import QuickActions from "@/components/dashboard/quick-actions";
import TransactionReviewQueue from "@/components/transactions/transaction-review-queue";

export default function Dashboard() {
  return (
    <div className="p-6">
      <FinancialCards />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-8">
          <TransactionReviewQueue />
          <RecentTransactions />
        </div>
        
        <div className="space-y-6">
          <AiAssistant />
          <ReceiptUpload />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
