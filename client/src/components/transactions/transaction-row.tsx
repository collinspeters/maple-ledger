import { useState } from 'react';
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
  transferType?: string;
  needsReview?: boolean;
  isReviewed?: boolean;
  receiptAttached?: boolean;
  receiptSource?: string;
  aiConfidence?: number;
  accountId?: string;
  bankConnectionId?: string;
}

interface TransactionRowProps {
  transaction: Transaction;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onUpdate: (id: string, updates: Partial<Transaction>) => Promise<void>;
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

  const getAmountColor = () => {
    if (transaction.isTransfer) return 'text-blue-600';
    return transaction.isExpense ? 'text-red-600' : 'text-green-600';
  };

  const getTransactionIcon = () => {
    if (transaction.isTransfer) {
      return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
    }
    return transaction.isExpense ? 
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

  // Get account name from bankConnectionId
  const getAccountName = () => {
    if (!transaction.bankConnectionId) return 'Manual Entry';
    const account = accounts.find(acc => acc.id === transaction.bankConnectionId);
    return account ? account.name : 'Unknown Account';
  };

  // Debug log each render attempt
  console.log(`🔧 TransactionRow rendering for transaction ${transaction.id}:`, {
    description: transaction.description,
    amount: transaction.amount,
    date: transaction.date,
    vendor: transaction.vendor,
    isExpense: transaction.isExpense,
    amountType: typeof transaction.amount
  });

  // Add error boundary for this component
  try {
    return (
      <tr className={`
        border-b transition-colors hover:bg-muted/50 min-h-[60px] bg-white
        ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : ''}
        ${transaction.needsReview ? 'border-l-4 border-l-orange-400' : ''}
      `} style={{ minHeight: '60px', backgroundColor: '#f8f9fa' }}>
      {/* Selection Checkbox */}
      <td className="w-12 p-4" style={{ backgroundColor: '#e3f2fd', minHeight: '60px' }}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
        />
        <div className="text-xs text-blue-600">✓</div>
      </td>

      {/* Date */}
      <td className="p-4" style={{ backgroundColor: '#fff3e0' }}>
        <div className="text-sm font-bold text-orange-800">
          {transaction.date ? format(new Date(transaction.date), 'MMM d, yyyy') : 'No date'}
        </div>
        <div className="text-xs text-orange-600">DATE</div>
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
                <Button size="sm" variant="ghost" onClick={() => saveField('description')}>
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => cancelEditing('description')}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div 
                className="cursor-pointer hover:bg-muted p-1 rounded truncate"
                onClick={() => startEditing('description', transaction.description)}
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

          {/* Receipt Indicator */}
          {transaction.receiptAttached && (
            <Paperclip className="h-4 w-4 text-gray-400" />
          )}

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
            <Button size="sm" variant="ghost" onClick={() => saveField('bankConnectionId')}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => cancelEditing('bankConnectionId')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            className="cursor-pointer hover:bg-muted p-1 rounded text-sm"
            onClick={() => startEditing('bankConnectionId', transaction.bankConnectionId || '')}
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
              <Button size="sm" variant="ghost" onClick={() => saveField('category')}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => cancelEditing('category')}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div 
              className="cursor-pointer hover:bg-muted p-1 rounded"
              onClick={() => startEditing('category', transaction.category || transaction.aiCategory || '')}
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
                {transaction.isTransfer && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                    {transaction.transferType}
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
            <Button size="sm" variant="ghost" onClick={() => saveField('amount')}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => cancelEditing('amount')}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div 
            className={`cursor-pointer hover:bg-muted p-1 rounded font-medium ${getAmountColor()}`}
            onClick={() => startEditing('amount', transaction.amount)}
          >
            {formatAmount(transaction.amount, transaction.isExpense, transaction.isTransfer || false)}
          </div>
        )}
      </td>

      {/* Status & Actions */}
      <td className="p-4">
        <div className="flex items-center gap-2">
          {transaction.needsReview && !transaction.isReviewed && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleMarkReviewed}
              className="text-xs"
            >
              Review
            </Button>
          )}
          
          {transaction.isReviewed && (
            <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
              Reviewed
            </Badge>
          )}

          {!transaction.isReviewed && !transaction.needsReview && (
            <Badge variant="outline" className="text-xs">
              Unreviewed
            </Badge>
          )}
        </div>
      </td>
    </tr>
    );
  } catch (error: any) {
    console.error(`❌ Error rendering transaction ${transaction.id}:`, error);
    return (
      <tr className="border-b bg-red-50">
        <td colSpan={7} className="p-4 text-red-600">
          Error rendering transaction: {transaction.id} - {error?.message || 'Unknown error'}
        </td>
      </tr>
    );
  }
}