import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import ErrorBoundary from "@/components/ui/error-boundary";
import { DollarSign, Receipt, TrendingUp, FileText, ArrowUp } from "lucide-react";

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  gstOwing: number;
}

const FinancialCards = React.memo(function FinancialCards() {
  const { data: summary, isLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ErrorBoundary>
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
        </ErrorBoundary>
      </div>
    );
  }

  const cards = [
    {
      title: "This Month Revenue",
      value: `$${summary?.totalRevenue?.toLocaleString() || '0'}`,
      change: "+15.3% vs last month",
      changeType: "positive",
      icon: DollarSign,
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
    },
    {
      title: "This Month Expenses",
      value: `$${summary?.totalExpenses?.toLocaleString() || '0'}`,
      change: "+8.2% vs last month",
      changeType: "negative",
      icon: Receipt,
      iconBg: "bg-error/10",
      iconColor: "text-error",
    },
    {
      title: "Net Profit",
      value: `$${summary?.netProfit?.toLocaleString() || '0'}`,
      change: "73.6% profit margin",
      changeType: "positive",
      icon: TrendingUp,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "GST/HST Owing",
      value: `$${summary?.gstOwing?.toLocaleString() || '0'}`,
      change: "Due Mar 31, 2024",
      changeType: "neutral",
      icon: FileText,
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
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
                  card.changeType === "positive" ? "text-secondary" :
                  card.changeType === "negative" ? "text-error" : 
                  "text-accent"
                }`}>
                  {card.changeType !== "neutral" && (
                    <ArrowUp className="mr-1 h-3 w-3" />
                  )}
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
});

export default FinancialCards;
