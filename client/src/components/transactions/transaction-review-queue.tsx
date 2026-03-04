import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AlertTriangle, 
  Check, 
  X, 
  Brain,
  Clock,
  TrendingUp
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { T2125_CATEGORIES, getExpenseCategories, getIncomeCategories } from "@shared/t2125-categories";

interface Transaction {
  id: string;
  vendor: string;
  amount: string;
  description: string;
  date: string;
  category?: string;
  aiCategory?: string;
  aiConfidence?: string;
  aiExplanation?: string;
  needsReview: boolean;
  isExpense: boolean;
}

interface ReviewItem {
  id: string;
  entityType: string;
  entityId: string;
  prompt: string;
  kind: string;
}

const QUICK_ACTIONS: Record<string, Array<{ label: string; value: "resolve" | "skip" }>> = {
  category: [
    { label: "Accept AI", value: "resolve" },
    { label: "Skip", value: "skip" },
  ],
  txn_kind: [
    { label: "Mark Resolved", value: "resolve" },
    { label: "Skip", value: "skip" },
  ],
  receipt_match: [
    { label: "Handled", value: "resolve" },
    { label: "Skip", value: "skip" },
  ],
  reconciliation: [
    { label: "Reviewed", value: "resolve" },
    { label: "Skip", value: "skip" },
  ],
};

export default function TransactionReviewQueue() {
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: transactionsResponse, isLoading } = useQuery<any>({
    queryKey: ["/api/transactions/review-queue"],
  });
  const transactions: Transaction[] = Array.isArray(transactionsResponse)
    ? transactionsResponse
    : Array.isArray(transactionsResponse?.data?.items)
      ? transactionsResponse.data.items
      : Array.isArray(transactionsResponse?.items)
        ? transactionsResponse.items
        : [];
  const { data: reviewItemsData } = useQuery<{ items: ReviewItem[]; data?: { items: ReviewItem[] } }>({
    queryKey: ["/api/review/items"],
  });
  const reviewItems = reviewItemsData?.items || reviewItemsData?.data?.items || [];

  const approveMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const promises = transactionIds.map(id =>
        apiRequest(`/api/transactions/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ needsReview: false }),
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/review-queue"] });
      setSelectedTransactions([]);
      toast({
        title: "Transactions Approved",
        description: "Selected transactions have been approved and categorized",
      });
    },
  });

  const resolveReviewItemMutation = useMutation({
    mutationFn: async (reviewItemId: string) =>
      apiRequest(`/api/review/items/${reviewItemId}/resolve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
    },
  });

  const skipReviewItemMutation = useMutation({
    mutationFn: async (reviewItemId: string) =>
      apiRequest(`/api/review/items/${reviewItemId}/skip`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
    },
  });

  const recategorizeMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      return apiRequest(`/api/transactions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ 
          category, 
          needsReview: false,
          userOverride: true
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/review-queue"] });
      toast({
        title: "Transaction Updated",
        description: "Category has been updated and approved",
      });
    },
  });

  // Get official T2125 categories
  const expenseCategories = getExpenseCategories();
  const incomeCategories = getIncomeCategories();
  const allCategories = [...expenseCategories, ...incomeCategories];

  const toggleSelection = (transactionId: string) => {
    setSelectedTransactions(prev => 
      prev.includes(transactionId)
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const selectAll = () => {
    if (selectedTransactions.length === transactions?.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(transactions?.map(t => t.id) || []);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "text-green-600 bg-green-100";
    if (confidence >= 0.6) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Review Queue</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const reviewTransactions = transactions || [];
  const openReviewCount = reviewItems.filter((i) => i.entityType === "transaction").length;

  if (reviewTransactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Check className="h-5 w-5 text-green-600" />
            <span>Review Queue</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <TrendingUp className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-gray-600">All transactions are properly categorized!</p>
            <p className="text-sm text-gray-500 mt-2">
              New transactions will appear here if they need manual review.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span>Review Queue</span>
            <Badge variant="secondary">
              {Math.max(reviewTransactions.length, openReviewCount)} pending
            </Badge>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
            >
              {selectedTransactions.length === reviewTransactions.length ? 'None' : 'All'}
            </Button>
            
            {selectedTransactions.length > 0 && (
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(selectedTransactions)}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="h-4 w-4 mr-2" />
                Approve ({selectedTransactions.length})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
          {reviewTransactions.map((transaction) => {
            const confidence = transaction.aiConfidence ? parseFloat(transaction.aiConfidence) : 0;
            const isSelected = selectedTransactions.includes(transaction.id);
            const item = reviewItems.find((i) => i.entityType === "transaction" && i.entityId === transaction.id);
            const quickActions = item ? (QUICK_ACTIONS[item.kind] || QUICK_ACTIONS.category) : [];
            
            return (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 transition-colors ${
                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(transaction.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {transaction.vendor || transaction.description}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {new Date(transaction.date).toLocaleDateString()} • 
                          ${parseFloat(transaction.amount).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="text-right">
                        <Badge className={getConfidenceColor(confidence)}>
                          <Brain className="h-3 w-3 mr-1" />
                          {Math.round(confidence * 100)}% confident
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <span className="text-sm text-gray-600">AI Suggests:</span>
                          <Badge variant="outline" className="ml-2">
                            {(() => {
                              const category = T2125_CATEGORIES.find(cat => cat.code === transaction.aiCategory);
                              return category ? category.name : transaction.aiCategory;
                            })()}
                          </Badge>
                        </div>
                        
                        {transaction.aiExplanation && (
                          <div className="max-w-md">
                            <p className="text-xs text-gray-500">
                              {transaction.aiExplanation}
                            </p>
                          </div>
                        )}
                        {item?.prompt && (
                          <div className="max-w-md space-y-2">
                            <p className="text-xs text-amber-700">{item.prompt}</p>
                            {item?.id && quickActions.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {quickActions.map((action) => (
                                  <Button
                                    key={`${item.id}-${action.label}`}
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      if (action.value === "resolve") {
                                        resolveReviewItemMutation.mutate(item.id);
                                      } else {
                                        skipReviewItemMutation.mutate(item.id);
                                      }
                                    }}
                                    disabled={resolveReviewItemMutation.isPending || skipReviewItemMutation.isPending}
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Select
                          value={transaction.aiCategory}
                          onValueChange={(category) => 
                            recategorizeMutation.mutate({ id: transaction.id, category })
                          }
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="text-xs font-semibold text-gray-500 px-2 py-1">Expense Categories</div>
                            {expenseCategories.map((category) => (
                              <SelectItem key={category.code} value={category.code}>
                                <div>
                                  <div className="font-medium">{category.name}</div>
                                  <div className="text-xs text-gray-500">{category.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                            <div className="text-xs font-semibold text-gray-500 px-2 py-1 border-t mt-1">Income Categories</div>
                            {incomeCategories.map((category) => (
                              <SelectItem key={category.code} value={category.code}>
                                <div>
                                  <div className="font-medium">{category.name}</div>
                                  <div className="text-xs text-gray-500">{category.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            await approveMutation.mutateAsync([transaction.id]);
                            if (item?.id) {
                              resolveReviewItemMutation.mutate(item.id);
                            }
                          }}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        {item?.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => skipReviewItemMutation.mutate(item.id)}
                            disabled={skipReviewItemMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
