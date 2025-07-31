import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Brain } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { T2125_CATEGORIES, getExpenseCategories, getIncomeCategories } from "@shared/t2125-categories";

const transactionSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  vendor: z.string().min(1, "Vendor is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
  category: z.string().optional(),
  isExpense: z.boolean().default(true),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export default function AddTransactionForm() {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      amount: "",
      vendor: "",
      description: "",
      date: new Date().toISOString().split('T')[0],
      isExpense: true,
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      return apiRequest("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount).toString(),
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/review-queue"] });
      form.reset();
      setShowForm(false);
      
      const confidence = data.aiConfidence ? parseFloat(data.aiConfidence) : 0;
      const categoryName = T2125_CATEGORIES.find(cat => cat.code === data.aiCategory)?.name || data.aiCategory;
      
      toast({
        title: "Transaction Added",
        description: confidence > 0.8 
          ? `AI categorized as "${categoryName}" with ${Math.round(confidence * 100)}% confidence`
          : `Added to review queue for manual categorization`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add transaction",
        variant: "destructive",
      });
    },
  });

  const expenseCategories = getExpenseCategories();
  const incomeCategories = getIncomeCategories();

  if (!showForm) {
    return (
      <Card>
        <CardContent className="p-6">
          <Button 
            onClick={() => setShowForm(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Add New Transaction</span>
          <Badge variant="secondary" className="ml-auto">
            <Brain className="h-3 w-3 mr-1" />
            AI Categorization
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createTransactionMutation.mutate(data))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount ($)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor/Merchant</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g., Tim Hortons, Staples, Bell Canada" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Brief description of the transaction..."
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-4">
              <FormField
                control={form.control}
                name="isExpense"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {field.value ? "Business Expense" : "Business Income"}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category (Optional - AI will suggest if blank)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Let AI categorize automatically" />
                      </SelectTrigger>
                    </FormControl>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center space-x-2 pt-4">
              <Button
                type="submit"
                disabled={createTransactionMutation.isPending}
                className="flex-1"
              >
                {createTransactionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </>
                )}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={createTransactionMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}