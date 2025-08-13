import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  category: string;
  subcategory: string;
  isBankAccount: boolean;
}

export default function QuickAddTransaction() {
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountId, setAccountId] = useState("");
  const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("withdrawal");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch chart of accounts
  const { data: accounts = [] } = useQuery<ChartOfAccount[]>({
    queryKey: ["/api/chart-of-accounts"],
  });

  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: parseFloat(amount).toFixed(2),
          vendor: vendor.trim() || null,
          description: description.trim(),
          date: date,
          chartAccountId: accountId,
          isExpense: transactionType === "withdrawal",
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/review-queue"] });
      setAmount("");
      setVendor("");
      setDescription("");
      setAccountId("");
      setDate(new Date().toISOString().split('T')[0]);
      
      const confidence = data.aiConfidence ? parseFloat(data.aiConfidence) : 0;
      
      toast({
        title: "Transaction Added",
        description: confidence > 0.8 
          ? `AI categorized with ${Math.round(confidence * 100)}% confidence`
          : `Added to review queue for manual categorization`,
      });
    },
    onError: (error: any) => {
      console.error("Transaction creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to add transaction",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !date || !accountId) {
      toast({
        title: "Validation Error", 
        description: "Please fill in amount, description, account, and date",
        variant: "destructive"
      });
      return;
    }
    console.log("Submitting transaction:", { amount, vendor, description, date, accountId, transactionType });
    createTransactionMutation.mutate();
  };

  // Group accounts by category for better UX
  const groupedAccounts = accounts.reduce((groups, account) => {
    const category = account.category;
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(account);
    return groups;
  }, {} as Record<string, ChartOfAccount[]>);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Quick Add Transaction</span>
          <Brain className="h-4 w-4 ml-auto text-primary" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="transaction-type">Type</Label>
              <Select value={transactionType} onValueChange={(value: "deposit" | "withdrawal") => setTransactionType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Deposit
                    </div>
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      Withdrawal
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="account">Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedAccounts).map(([category, categoryAccounts]) => (
                  <div key={category}>
                    <div className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-50">
                      {category}
                    </div>
                    {categoryAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{account.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{account.code}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              placeholder="Transaction description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="vendor">Vendor (Optional)</Label>
            <Input
              id="vendor"
              placeholder="e.g., Tim Hortons"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createTransactionMutation.isPending || !amount || !description || !date || !accountId}
          >
            {createTransactionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add {transactionType === "deposit" ? "Deposit" : "Withdrawal"}
              </>
            )}
          </Button>
        </form>
        <p className="text-xs text-gray-500 mt-2 text-center">
          AI will categorize using official T2125 tax codes
        </p>
      </CardContent>
    </Card>
  );
}