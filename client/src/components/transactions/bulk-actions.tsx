import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Edit, 
  Trash2, 
  Check, 
  Tag, 
  CreditCard, 
  Calculator,
  X
} from 'lucide-react';

export interface BulkAction {
  type: 'category' | 'account' | 'salesTax' | 'review' | 'delete';
  value?: string;
  newValue?: string;
}

interface BulkActionsProps {
  selectedCount: number;
  selectedTransactions: any[];
  categories: string[];
  accounts: Array<{ id: string; name: string }>;
  onBulkAction: (action: BulkAction) => Promise<void>;
  onClearSelection: () => void;
  isLoading?: boolean;
}

export function BulkActions({
  selectedCount,
  selectedTransactions,
  categories,
  accounts,
  onBulkAction,
  onClearSelection,
  isLoading = false
}: BulkActionsProps) {
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEdits, setBulkEdits] = useState<BulkAction[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const addBulkEdit = (type: BulkAction['type']) => {
    setBulkEdits([...bulkEdits, { type }]);
  };

  const updateBulkEdit = (index: number, updates: Partial<BulkAction>) => {
    const updated = [...bulkEdits];
    updated[index] = { ...updated[index], ...updates };
    setBulkEdits(updated);
  };

  const removeBulkEdit = (index: number) => {
    setBulkEdits(bulkEdits.filter((_, i) => i !== index));
  };

  const applyBulkEdits = async () => {
    try {
      for (const edit of bulkEdits) {
        await onBulkAction(edit);
      }
      setBulkEdits([]);
      setBulkEditOpen(false);
      onClearSelection();
    } catch (error) {
      console.error('Error applying bulk edits:', error);
    }
  };

  const handleBulkReview = async () => {
    await onBulkAction({ type: 'review' });
    onClearSelection();
  };

  const handleBulkDelete = async () => {
    await onBulkAction({ type: 'delete' });
    setDeleteDialogOpen(false);
    onClearSelection();
  };

  // Check if selected transactions can be bulk edited
  const canBulkEdit = selectedTransactions.every(t => 
    !t.isWavePayment && 
    !t.isStripePayment && 
    !t.isTransfer && 
    !t.isJournalEntry
  );

  const restrictedCount = selectedTransactions.filter(t =>
    t.isWavePayment || t.isStripePayment || t.isTransfer || t.isJournalEntry
  ).length;

  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {selectedCount} transaction{selectedCount !== 1 ? 's' : ''} selected
            </Badge>
            {restrictedCount > 0 && (
              <Badge variant="destructive" className="bg-orange-100 text-orange-800">
                {restrictedCount} restricted
              </Badge>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4 mr-1" />
            Clear selection
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Review */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkReview}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Mark as Reviewed
          </Button>

          {/* Bulk Edit */}
          <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!canBulkEdit || isLoading}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Bulk Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Bulk Edit Transactions</DialogTitle>
                <DialogDescription>
                  Apply changes to {selectedCount} selected transaction{selectedCount !== 1 ? 's' : ''}
                  {restrictedCount > 0 && (
                    <span className="text-orange-600">
                      <br />Note: {restrictedCount} transaction{restrictedCount !== 1 ? 's' : ''} cannot be bulk edited due to restrictions.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Add Bulk Edit Buttons */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addBulkEdit('category')}
                    className="flex items-center gap-2"
                  >
                    <Tag className="h-4 w-4" />
                    Add Category Change
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addBulkEdit('account')}
                    className="flex items-center gap-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    Add Account Change
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addBulkEdit('salesTax')}
                    className="flex items-center gap-2"
                  >
                    <Calculator className="h-4 w-4" />
                    Add Sales Tax Change
                  </Button>
                </div>

                {/* Bulk Edit Forms */}
                <div className="space-y-4">
                  {bulkEdits.map((edit, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium capitalize">
                          Change {edit.type === 'salesTax' ? 'Sales Tax' : edit.type}
                        </h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBulkEdit(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {edit.type === 'category' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Change to:</label>
                          <Select
                            value={edit.newValue || ''}
                            onValueChange={(value) => updateBulkEdit(index, { newValue: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {edit.type === 'account' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Change to:</label>
                          <Select
                            value={edit.newValue || ''}
                            onValueChange={(value) => updateBulkEdit(index, { newValue: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {edit.type === 'salesTax' && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Change to:</label>
                          <Select
                            value={edit.newValue || ''}
                            onValueChange={(value) => updateBulkEdit(index, { newValue: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select tax rate" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">No tax</SelectItem>
                              <SelectItem value="5">5% GST</SelectItem>
                              <SelectItem value="13">13% HST (ON)</SelectItem>
                              <SelectItem value="12">12% HST (BC)</SelectItem>
                              <SelectItem value="15">15% HST (Atlantic)</SelectItem>
                              <SelectItem value="14.975">14.975% GST+QST (QC)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkEditOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={applyBulkEdits}
                  disabled={bulkEdits.length === 0 || bulkEdits.some(e => !e.newValue)}
                >
                  Apply Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Bulk Delete */}
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Transactions</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedCount} transaction{selectedCount !== 1 ? 's' : ''}? 
                  This action cannot be undone and will permanently remove the transactions from your records.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Transactions
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {restrictedCount > 0 && (
        <div className="mt-3 text-sm text-orange-600">
          <strong>Note:</strong> Some transactions cannot be bulk edited (Wave Payments, Stripe transactions, transfers, or journal entries).
        </div>
      )}
    </div>
  );
}