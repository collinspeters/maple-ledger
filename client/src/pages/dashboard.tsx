import FinancialCards from "@/components/dashboard/financial-cards";
import RecentTransactions from "@/components/dashboard/recent-transactions";

import ReceiptUpload from "@/components/dashboard/receipt-upload";
import QuickActions from "@/components/dashboard/quick-actions";
import TransactionReviewQueue from "@/components/transactions/transaction-review-queue";
import QuickAddTransaction from "@/components/transactions/quick-add-transaction";
import BankingConnectionCard from "@/components/dashboard/banking-connection-card";
import ExpenseBreakdownChart from "@/components/dashboard/expense-breakdown-chart";
import MonthlyTrendChart from "@/components/dashboard/monthly-trend-chart";
import AIInsightsCard from "@/components/dashboard/ai-insights-card";

export default function Dashboard() {
  return (
    <div className="p-4 md:p-6 dashboard max-w-7xl mx-auto" data-testid="dashboard">
      {/* Financial Overview Cards */}
      <FinancialCards />
      
      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mt-8">
        {/* Analytics & Charts - Takes full width on mobile, 2 cols on xl */}
        <div className="lg:col-span-2 xl:col-span-2 space-y-6">
          <BankingConnectionCard />
          
          {/* Charts Grid - Responsive layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-6">
            <MonthlyTrendChart />
            <ExpenseBreakdownChart />
          </div>
          
          <RecentTransactions />
        </div>
        
        {/* Right Sidebar - Single column on mobile, fixed width on xl */}
        <div className="lg:col-span-2 xl:col-span-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-6">
          <div className="space-y-6">
            <QuickAddTransaction />
            <AIInsightsCard />
            <TransactionReviewQueue />
          </div>
          
          <div className="space-y-6">
            <ReceiptUpload />
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}
