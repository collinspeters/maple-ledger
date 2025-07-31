import { useQuery } from "@tanstack/react-query";
import { T2125_CATEGORIES } from "@shared/t2125-categories";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Transaction } from "@shared/schema";
import { Store, Utensils, CreditCard, MoreVertical, Brain, TriangleAlert, Check } from "lucide-react";

export default function RecentTransactions() {
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <p className="text-sm text-gray-600">AI-categorized and ready for review</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center justify-between p-4">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                  <div>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-24"></div>
                  </div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTransactionIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case "office supplies":
        return Store;
      case "meals & entertainment":
        return Utensils;
      case "revenue":
        return CreditCard;
      default:
        return Store;
    }
  };

  const getConfidenceBadge = (confidence: number | null, category: string | null) => {
    if (!confidence || !category) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
          <TriangleAlert className="mr-1 h-3 w-3" />
          Needs Review
        </span>
      );
    }

    // Get the display name from T2125 categories
    const t2125Category = T2125_CATEGORIES.find(cat => cat.code === category);
    const displayName = t2125Category ? t2125Category.name : category;

    if (confidence >= 0.9) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
          <Brain className="mr-1 h-3 w-3" />
          {displayName}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary">
        <Check className="mr-1 h-3 w-3" />
        {displayName}
      </span>
    );
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
            <p className="text-sm text-gray-600">AI-categorized and ready for review</p>
          </div>
          <Link href="/transactions">
            <Button variant="ghost" className="text-primary hover:text-primary-dark font-medium text-sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
          {transactions?.slice(0, 5).map((transaction) => {
            const Icon = getTransactionIcon(transaction.category || transaction.aiCategory || "");
            const confidence = transaction.aiConfidence ? parseFloat(transaction.aiConfidence) : null;
            
            return (
              <div key={transaction.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Icon className="text-gray-600 h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {transaction.vendor || transaction.description}
                      </p>
                      <div className="flex items-center space-x-3 mt-1">
                        {getConfidenceBadge(confidence, transaction.category || transaction.aiCategory)}
                        {confidence && (
                          <span className="text-xs text-gray-500">
                            {Math.round(confidence * 100)}% confidence
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`font-semibold ${
                      transaction.isExpense ? "text-gray-900" : "text-secondary"
                    }`}>
                      {transaction.isExpense ? "-" : "+"}${parseFloat(transaction.amount).toLocaleString()}
                    </span>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 p-1">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          
          {(!transactions || transactions.length === 0) && (
            <div className="p-8 text-center">
              <p className="text-gray-500">No transactions yet. Add your first transaction to get started!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
