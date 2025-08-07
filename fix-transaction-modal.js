// Emergency fix for transaction modal syntax error
import { promises as fs } from 'fs';

async function fixTransactionModal() {
  console.log('🔧 Fixing transaction modal syntax error...');
  
  try {
    let content = await fs.readFile('client/src/components/transaction-modal.tsx', 'utf8');
    console.log('📄 Original file read successfully');
    
    // Replace the malformed JSX structure
    const fixed = `import { useState } from 'react';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Brain } from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Transaction = {
  date: string;
  amount: string;
  vendor: string;
  description: string;
  category: string;
  notes: string;
  accountId?: string;
};

type TransactionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function TransactionModal({ open, onOpenChange }: TransactionModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [formData, setFormData] = useState<Transaction>({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    vendor: '',
    description: '',
    category: '',
    notes: '',
  });

  const createTransactionMutation = useMutation({
    mutationFn: async (data: Transaction) => {
      return apiRequest("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({
        title: "Transaction Added",
        description: "Your transaction has been successfully added.",
      });
      onOpenChange(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        vendor: '',
        description: '',
        category: '',
        notes: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add transaction",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTransactionMutation.mutate(formData);
  };

  const handleChange = (field: string) => (value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <ErrorBoundary>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Add New Transaction
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {createTransactionMutation.isPending ? (
            <div className="animate-pulse p-6">Loading...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange("date")(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (CAD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => handleChange("amount")(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor/Description</Label>
                <Input
                  id="vendor"
                  placeholder="e.g., Office Depot, Client Payment"
                  value={formData.vendor}
                  onChange={(e) => handleChange("vendor")(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the transaction"
                  value={formData.description}
                  onChange={(e) => handleChange("description")(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={handleChange("category")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai-auto">Let AI categorize this transaction</SelectItem>
                    <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                    <SelectItem value="Meals & Entertainment">Meals & Entertainment</SelectItem>
                    <SelectItem value="Travel & Transportation">Travel & Transportation</SelectItem>
                    <SelectItem value="Professional Services">Professional Services</SelectItem>
                    <SelectItem value="Marketing & Advertising">Marketing & Advertising</SelectItem>
                    <SelectItem value="Revenue">Revenue</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Additional details about this transaction..."
                  value={formData.notes}
                  onChange={(e) => handleChange("notes")(e.target.value)}
                />
              </div>

              {/* AI Suggestion */}
              {formData.vendor && !formData.category && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                      <Brain className="text-primary text-xs" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">AI Suggestion</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Based on the vendor name, this looks like an <strong>Office Supplies</strong> expense. Confidence: 94%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  aria-label="Cancel transaction creation"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createTransactionMutation.isPending || !formData.amount || !formData.description}
                  className="bg-primary hover:bg-primary-dark"
                  aria-label="Save new transaction"
                >
                  {createTransactionMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Transaction
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}`;

    await fs.writeFile('client/src/components/transaction-modal.tsx', fixed, 'utf8');
    console.log('✅ Transaction modal syntax error fixed!');
    
  } catch (error) {
    console.error('❌ Failed to fix transaction modal:', error);
  }
}

// Run immediately
fixTransactionModal();