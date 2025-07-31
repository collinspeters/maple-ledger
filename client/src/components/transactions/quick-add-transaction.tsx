import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, Brain } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function QuickAddTransaction() {
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Today's date as default
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTransactionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: parseFloat(amount).toFixed(2),
          vendor: vendor.trim(),
          description: description.trim(),
          date: new Date(date).toISOString(),
          isExpense: true,
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/review-queue"] });
      setAmount("");
      setVendor("");
      setDescription("");
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
    if (!amount || !vendor || !description || !date) {
      toast({
        title: "Validation Error", 
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }
    console.log("Submitting transaction:", { amount, vendor, description, date });
    createTransactionMutation.mutate();
  };

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
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Input
            placeholder="Vendor (e.g., Tim Hortons)"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            required
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <Button
            type="submit"
            className="w-full"
            disabled={createTransactionMutation.isPending || !amount || !vendor || !description || !date}
          >
            {createTransactionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add & Categorize
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