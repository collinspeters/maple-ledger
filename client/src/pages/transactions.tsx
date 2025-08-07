import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { TransactionFiltersComponent, TransactionFilters } from "@/components/transactions/transaction-filters";
import { BulkActions, BulkAction } from "@/components/transactions/bulk-actions";
import { TransactionRow, Transaction } from "@/components/transactions/transaction-row";
import BulkCategorizeButton from "@/components/transactions/bulk-categorize-button";
type DateRange = {
  from?: Date;
  to?: Date;
} | undefined;
import { 
  Plus, 
  Download, 
  Upload, 
  RefreshCw, 
  BarChart3,
  Filter,
  ChevronDown,
  FileText
} from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";

export default function Transactions() {
  const queryClient = useQueryClient();
  
  // State management
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    category: '',
    status: '',
    type: '',
    account: '',
    receiptStatus: '',
    dateRange: undefined,
    autoUpdates: ''
  });

  // Data fetching
  const { data: transactions = [], isLoading, error } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: bankConnections = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-connections"],
  });

  // Generate categories from existing transactions
  const categories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach(t => {
      if (t.category) cats.add(t.category);
      if (t.aiCategory) cats.add(t.aiCategory);
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Transform bank connections to accounts format
  const accounts = useMemo(() => 
    bankConnections.map((bc: any) => ({
      id: bc.id,
      name: `${bc.bankName} ${bc.accountName} (${bc.accountMask})`
    })), 
    [bankConnections]
  );

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter(transaction => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!transaction.description.toLowerCase().includes(searchLower) &&
            !(transaction.vendor?.toLowerCase().includes(searchLower))) {
          return false;
        }
      }

      // Category filter
      if (filters.category && filters.category !== 'all' && 
          transaction.category !== filters.category && 
          transaction.aiCategory !== filters.category) {
        return false;
      }

      // Status filter
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'reviewed' && !transaction.isReviewed) return false;
        if (filters.status === 'unreviewed' && (transaction.isReviewed || transaction.needsReview)) return false;
        if (filters.status === 'needs_review' && !transaction.needsReview) return false;
      }

      // Type filter
      if (filters.type && filters.type !== 'all') {
        if (filters.type === 'income' && transaction.isExpense) return false;
        if (filters.type === 'expense' && !transaction.isExpense) return false;
        if (filters.type === 'transfer' && !transaction.isTransfer) return false;
      }

      // Account filter
      if (filters.account && filters.account !== 'all' && transaction.bankConnectionId !== filters.account) {
        return false;
      }

      // Receipt filter
      if (filters.receiptStatus) {
        if (filters.receiptStatus === 'has_receipt' && !transaction.receiptAttached) return false;
        if (filters.receiptStatus === 'no_receipt' && transaction.receiptAttached) return false;
        if (filters.receiptStatus === 'from_scan' && transaction.receiptSource !== 'scan') return false;
      }

      // Date range filter
      if (filters.dateRange?.from) {
        const transactionDate = new Date(transaction.date);
        if (transactionDate < filters.dateRange.from) return false;
        if (filters.dateRange.to && transactionDate > filters.dateRange.to) return false;
      }

      return true;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'amount':
          comparison = parseFloat(a.amount) - parseFloat(b.amount);
          break;
        case 'description':
          comparison = (a.vendor || a.description).localeCompare(b.vendor || b.description);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [transactions, filters, sortBy, sortOrder]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.category) count++;
    if (filters.status) count++;
    if (filters.type) count++;
    if (filters.account) count++;
    if (filters.receiptStatus) count++;
    if (filters.dateRange?.from) count++;
    if (filters.autoUpdates) count++;
    return count;
  }, [filters]);

  // Mutations
  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      return apiRequest(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
  });

  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, transactionIds }: { action: BulkAction; transactionIds: string[] }) => {
      return apiRequest('/api/transactions/bulk', {
        method: 'POST',
        body: JSON.stringify({ action, transactionIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    },
  });

  // Handlers
  const handleSelectTransaction = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedTransactions);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedTransactions(new Set(filteredAndSortedTransactions.map(t => t.id)));
    } else {
      setSelectedTransactions(new Set());
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    await updateTransactionMutation.mutateAsync({ id, updates });
  };

  const handleBulkAction = async (action: BulkAction) => {
    const transactionIds = Array.from(selectedTransactions);
    await bulkActionMutation.mutateAsync({ action, transactionIds });
    setSelectedTransactions(new Set());
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: 'all',
      status: 'all',
      type: '',
      account: '',
      receiptStatus: '',
      dateRange: undefined,
      autoUpdates: ''
    });
  };

  const handleFiltersChange = (newFilters: Partial<TransactionFilters>) => {
    setFilters({ ...filters, ...newFilters });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600">Error loading transactions. Please try again.</p>
            <Button 
              onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/transactions'] })}
              className="mt-4"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            {filteredAndSortedTransactions.length} of {transactions.length} transactions
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports
          </Button>
          <Button data-testid="add-transaction">
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* AI Categorization Section */}
      <BulkCategorizeButton />

      {/* Filters Toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 filters"
          data-testid="filters"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </Button>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="amount">Amount</SelectItem>
                <SelectItem value="description">Description</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filters" data-testid="filters">
          <TransactionFiltersComponent
            filters={filters}
            onFiltersChange={handleFiltersChange}
            accounts={accounts}
            categories={categories}
            onClearFilters={clearFilters}
            activeFilterCount={activeFilterCount}
          />
        </div>
      )}

      {/* Transactions Table - Improved Layout */}
      <Card data-testid="transactions" className="flex-1 overflow-hidden">
        <CardHeader className="transaction-list border-b">
          <div className="flex items-center justify-between">
            <CardTitle>All Transactions</CardTitle>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedTransactions.size === filteredAndSortedTransactions.length && filteredAndSortedTransactions.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">
                Select all
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {filteredAndSortedTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="w-12 p-4"></th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Description</th>
                    <th className="text-left p-4 font-medium">Account</th>
                    <th className="text-left p-4 font-medium">Category</th>
                    <th className="text-right p-4 font-medium">Amount</th>
                    <th className="text-left p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedTransactions.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      isSelected={selectedTransactions.has(transaction.id)}
                      onSelect={(selected) => handleSelectTransaction(transaction.id, selected)}
                      onUpdate={handleUpdateTransaction}
                      categories={categories}
                      accounts={accounts}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground mb-4">
                {activeFilterCount > 0 
                  ? "No transactions match your current filters. Try adjusting your search criteria."
                  : "Start by connecting a bank account or adding your first transaction manually."
                }
              </p>
              {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add your first transaction
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <BulkActions
        selectedCount={selectedTransactions.size}
        selectedTransactions={filteredAndSortedTransactions.filter(t => selectedTransactions.has(t.id))}
        categories={categories}
        accounts={accounts}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setSelectedTransactions(new Set())}
        isLoading={bulkActionMutation.isPending}
      />
    </div>
  );
}
