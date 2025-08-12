import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, TrendingUp, FileText, ArrowUp, ArrowDown } from "lucide-react";

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  gstOwing: number;
  revenueChange?: number;
  expenseChange?: number;
  profitMargin?: number;
  transactionCount?: number;
}

export default function FinancialCards() {
  const { data: summary, isLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-card">
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const revenueChange = summary?.revenueChange || 0;
  const expenseChange = summary?.expenseChange || 0;
  const profitMargin = summary?.profitMargin || 0;
  
  const cards = [
    {
      title: "This Month Revenue",
      value: `$${summary?.totalRevenue?.toLocaleString() || '0'}`,
      change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}% vs last month`,
      changeType: revenueChange >= 0 ? "positive" : "negative",
      icon: DollarSign,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      title: "This Month Expenses", 
      value: `$${summary?.totalExpenses?.toLocaleString() || '0'}`,
      change: `${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}% vs last month`,
      changeType: expenseChange <= 0 ? "positive" : "negative",
      icon: Receipt,
      iconBg: "bg-orange-50",
      iconColor: "text-orange-600",
    },
    {
      title: "Net Profit",
      value: `$${summary?.netProfit?.toLocaleString() || '0'}`,
      change: `${profitMargin.toFixed(1)}% profit margin`,
      changeType: (summary?.netProfit || 0) >= 0 ? "positive" : "negative",
      icon: TrendingUp,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      title: "GST/HST Owing",
      value: `$${summary?.gstOwing?.toLocaleString() || '0'}`,
      change: "Due Mar 31, 2025",
      changeType: "neutral",
      icon: FileText,
      iconBg: "bg-purple-50", 
      iconColor: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 financial-summary" data-testid="financial-summary">
      {cards.map((card, index) => (
        <Card key={index} className="financial-summary shadow-card hover:shadow-card-lg border-0 bg-white rounded-xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className={`text-sm mt-1 flex items-center ${
                  card.changeType === "positive" ? "text-emerald-600" :
                  card.changeType === "negative" ? "text-red-600" : 
                  "text-gray-600"
                }`}>
                  {card.changeType === "positive" && <ArrowUp className="mr-1 h-3 w-3" />}
                  {card.changeType === "negative" && <ArrowDown className="mr-1 h-3 w-3" />}
                  {card.change}
                </p>
              </div>
              <div className={`w-12 h-12 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                <card.icon className={`${card.iconColor} text-lg`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
