import { useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Paperclip, 
  Eye, 
  Edit2, 
  Check, 
  X, 
  AlertCircle, 
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  Banknote
} from 'lucide-react';
import { format } from 'date-fns';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  vendor?: string;
  category?: string;
  aiCategory?: string;
  amount: string;
  isExpense: boolean;
  isTransfer?: boolean;
  txnKind?: string;
  equityType?: string | null;
  transferType?: string;
  needsReview?: boolean;
  isReviewed?: boolean;
  receiptAttached?: boolean;
  receiptSource?: string;
  aiConfidence?: number;
  accountId?: string;
  bankConnectionId?: string;
  chartAccountId?: string;
  notes?: string;
}

interface TransactionRowProps {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => Promise<void>;
  onOpenDetails?: (transaction: Transaction) => void;
  categories: string[];
  accounts: Array<{ id: string; name: string }>;
  isEditing?: boolean;
  onEditToggle?: () => void;
}

export function TransactionRow({
  transaction,
  isSelected,
  onSelect,
  onUpdate,
  onOpenDetails,
  categories,
  accounts,
  isEditing = false,
  onEditToggle = () => {}
}: TransactionRowProps) {
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({});
  const [tempValues, setTempValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const startEditing = (field: string, currentValue: string) => {
    setEditingFields({ ...editingFields, [field]: true });
    setTempValues({ ...tempValues, [field]: currentValue || '' });
  };

  const cancelEditing = (field: string) => {
    const newEditingFields = { ...editingFields };
    delete newEditingFields[field];
    setEditingFields(newEditingFields);
    
    const newTempValues = { ...tempValues };
    delete newTempValues[field];
    setTempValues(newTempValues);
  };

  const saveField = async (field: string) => {
    const newValue = tempValues[field];
    if (newValue === undefined) return;

    setIsLoading(true);
    try {
      await onUpdate(transaction.id, { [field]: newValue });
      cancelEditing(field);
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkReviewed = async () => {
    await onUpdate(transaction.id, { isReviewed: true, needsReview: false });
  };

  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!onOpenDetails) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input, [role="button"], [data-no-row-open="true"]')) return;
    onOpenDetails(transaction);
  };

  const getTxnKind = () => {
    if (transaction.txnKind) return transaction.txnKind;
    if (transaction.isTransfer) return 'transfer';
    return transaction.isExpense ? 'expense' : 'income';
  };

  const getAmountColor = () => {
    const kind = getTxnKind();
    if (kind === 'transfer') return 'text-blue-600';
    if (kind === 'equity') return transaction.equityType === 'owner_draw' ? 'text-orange-600' : 'text-emerald-600';
    return kind === 'expense' ? 'text-red-600' : 'text-green-600';
  };

  const getTransactionIcon = () => {
    const kind = getTxnKind();
    if (kind === 'transfer') {
      return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
    }
    if (kind === 'equity') {
      return <Banknote className="h-4 w-4 text-orange-500" />;
    }
    return kind === 'expense' ? 
      <TrendingDown className="h-4 w-4 text-red-500" /> : 
      <TrendingUp className="h-4 w-4 text-green-500" />;
  };

  const formatAmount = (amount: string | number, isExpense: boolean, isTransfer: boolean) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(value)) return '$0.00';
    
    const formatted = value.toLocaleString('en-CA', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
    
    if (isTransfer) return `$${formatted}`;
    return `${isExpense ? '-' : '+'}$${formatted}`;
  };

  // Get account name from bankConnectionId or chartAccountId
  const getAccountName = () => {
    // First check if it's a manual transaction with chartAccountId
    if (transaction.chartAccountId) {
      const chartAccount = accounts.find(acc => acc.id === transaction.chartAccountId);
      if (chartAccount) return chartAccount.name;
    }
    
    // Then check if it's a bank transaction with bankConnectionId
    if (transaction.bankConnectionId) {
      const bankAccount = accounts.find(acc => acc.id === transaction.bankConnectionId);
      if (bankAccount) return bankAccount.name;
    }
    
    return 'Manual Entry';
  };

  // Debug log removed - transactions now rendering properly

  // Add error boundary for this component
  try {
    return (
      <tr
        className={`
        border-b transition-colors hover:bg-muted/50
        ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
        ${transaction.needsReview ? 'border-l-4 border-l-orange-400' : ''}
      `}
        onClick={handleRowClick}
      >
      {/* Selection Checkbox */}
      <td className="w-12 p-4">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select transaction from ${transaction.vendor || transaction.description || 'Unknown'}`}
        />
      </td>

      {/* Date */}
      <td className="p-4">
        <div className="text-sm">
          {transaction.date ? format(new Date(transaction.date), 'MMM d, yyyy') : 'No date'}
        </div>
      </td>

      {/* Description */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          {getTransactionIcon()}
          <div className="min-w-0 flex-1">
            {editingFields.description ? (
              <div className="flex items-center gap-2">
                <Input
                  value={tempValues.description}
                  onChange={(e) => setTempValues({ ...tempValues, description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveField('description');
                    if (e.key === 'Escape') cancelEditing('description');
                  }}
                  className="h-8"
                  autoFocus
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => saveField('description')}
                  aria-label="Save description"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => cancelEditing('description')}
                  aria-label="Cancel editing description"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div 
                className="cursor-pointer hover:bg-muted p-1 rounded truncate"
                data-no-row-open="true"
                onClick={() => startEditing('description', transaction.description)}
                role="button"
                tabIndex={0}
                aria-label="Edit transaction description"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    startEditing('description', transaction.description);
                  }
                }}
              >
                <div className="font-medium truncate">
                  {transaction.vendor || transaction.description || 'No description'}
                </div>
                {transaction.vendor && transaction.vendor !== transaction.description && (
                  <div className="text-xs text-muted-foreground truncate">
                    {transaction.description}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Review Indicator */}
          {transaction.needsReview && (
            <AlertCircle className="h-4 w-4 text-orange-500" />
          )}
        </div>
      </td>

      {/* Account */}
      <td className="p-4">
        {editingFields.bankConnectionId ? (
          <div className="flex items-center gap-2">
            <Select
              value={tempValues.bankConnectionId}
              onValueChange={(value) => setTempValues({ ...tempValues, bankConnectionId: value })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => saveField('bankConnectionId')}
              aria-label="Save account"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => cancelEditing('bankConnectionId')}
              aria-label="Cancel editing account"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            className="cursor-pointer hover:bg-muted p-1 rounded text-sm"
            data-no-row-open="true"
            onClick={() => startEditing('bankConnectionId', transaction.bankConnectionId || '')}
            role="button"
            tabIndex={0}
            aria-label="Edit account"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startEditing('bankConnectionId', transaction.bankConnectionId || '');
              }
            }}
          >
            {getAccountName()}
          </div>
        )}
      </td>

      {/* Category */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          {editingFields.category ? (
            <div className="flex items-center gap-2">
              <Select
                value={tempValues.category}
                onValueChange={(value) => setTempValues({ ...tempValues, category: value })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => saveField('category')}
                aria-label="Save category"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => cancelEditing('category')}
                aria-label="Cancel editing category"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div 
              className="cursor-pointer hover:bg-muted p-1 rounded"
              data-no-row-open="true"
              onClick={() => startEditing('category', transaction.category || transaction.aiCategory || '')}
              role="button"
              tabIndex={0}
              aria-label="Edit category"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  startEditing('category', transaction.category || transaction.aiCategory || '');
                }
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {transaction.category || transaction.aiCategory || 'Uncategorized'}
                </span>
                {transaction.aiCategory && !transaction.category && transaction.aiConfidence && (
                  <Badge variant="secondary" className="text-xs">
                    AI {Math.round(transaction.aiConfidence * 100)}%
                  </Badge>
                )}
                {getTxnKind() === 'transfer' && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {transaction.transferType}
                  </Badge>
                )}
                {getTxnKind() === 'equity' && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
                    {transaction.equityType === 'owner_contribution' ? 'Owner Contribution' : 'Owner Draw'}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </td>

      {/* Amount */}
      <td className="p-4 text-right">
        {editingFields.amount ? (
          <div className="flex items-center gap-2 justify-end">
            <Input
              type="number"
              step="0.01"
              value={tempValues.amount}
              onChange={(e) => setTempValues({ ...tempValues, amount: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveField('amount');
                if (e.key === 'Escape') cancelEditing('amount');
              }}
              className="h-8 w-24 text-right"
              autoFocus
            />
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => saveField('amount')}
              aria-label="Save amount"
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => cancelEditing('amount')}
              aria-label="Cancel editing amount"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            className={`cursor-pointer hover:bg-muted p-1 rounded font-medium ${getAmountColor()}`}
            data-no-row-open="true"
            onClick={() => startEditing('amount', transaction.amount)}
            role="button"
            tabIndex={0}
            aria-label="Edit amount"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                startEditing('amount', transaction.amount);
              }
            }}
          >
            {formatAmount(transaction.amount, getTxnKind() === 'expense', getTxnKind() === 'transfer')}
          </div>
        )}
      </td>

      {/* Receipt */}
      <td className="p-4">
        {transaction.receiptAttached ? (
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
            <Paperclip className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs font-medium">Attached</span>
          </div>
        ) : (
          <div className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-gray-500">
            <Paperclip className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">None</span>
          </div>
        )}
      </td>

      {/* Status & Actions */}
      <td className="p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {transaction.isReviewed ? (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Reviewed
            </Badge>
          ) : (transaction as any).receiptSource === 'bank_feed' || (transaction as any).bankTransactionId ? (
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              New
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Unreviewed
            </Badge>
          )}

          {transaction.needsReview && !transaction.isReviewed && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkReviewed}
              className="text-xs h-6 px-2"
              data-no-row-open="true"
              aria-label="Mark transaction as reviewed"
            >
              Mark Reviewed
            </Button>
          )}

          {onOpenDetails && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenDetails(transaction)}
              className="text-xs h-6 px-2"
              data-no-row-open="true"
              aria-label="Open transaction details"
            >
              <Eye className="h-3 w-3 mr-1" />
              Details
            </Button>
          )}
        </div>
      </td>
    </tr>
    );
  } catch (error: any) {
    console.error(`❌ Error rendering transaction ${transaction.id}:`, error);
    return (
      <tr className="border-b bg-red-50">
        <td colSpan={8} className="p-4 text-red-600">
          Error rendering transaction: {transaction.id} - {error?.message || 'Unknown error'}
        </td>
      </tr>
    );
  }
}
