import { useState, useMemo, useEffect } from 'react';
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
import { useToast } from "@/hooks/use-toast";
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
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";

export default function Transactions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State management
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [lastSyncResult, setLastSyncResult] = useState<{ added: number; skipped: number } | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [filters, setFilters] = useState<TransactionFilters>({
    search: '',
    category: 'all',
    status: 'all',
    type: 'all',
    account: 'all',
    receiptStatus: 'all',
    dateRange: undefined,
    autoUpdates: 'all'
  });

  // Transactions component now working properly

  // Data fetching
  const { data: transactions = [], isLoading, error } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: bankConnections = [] } = useQuery<any[]>({
    queryKey: ["/api/bank-connections"],
  });

  const { data: chartOfAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/chart-of-accounts"],
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

  // Transform bank connections and chart of accounts to unified accounts format
  const accounts = useMemo(() => {
    const bankAccounts = bankConnections.map((bc: any) => ({
      id: bc.id,
      name: `${bc.bankName} ${bc.accountName} (${bc.accountMask})`
    }));
    
    const chartAccounts = chartOfAccounts.map((ca: any) => ({
      id: ca.id,
      name: ca.name
    }));
    
    return [...bankAccounts, ...chartAccounts];
  }, [bankConnections, chartOfAccounts]
  );

  // Count active filters (must be before filteredAndSortedTransactions)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.category && filters.category !== 'all') count++;
    if (filters.status && filters.status !== 'all') count++;
    if (filters.type && filters.type !== 'all') count++;
    if (filters.account && filters.account !== 'all') count++;
    if (filters.receiptStatus && filters.receiptStatus !== 'all') count++;
    if (filters.dateRange?.from) count++;
    if (filters.autoUpdates && filters.autoUpdates !== 'all') count++;
    return count;
  }, [filters]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    // Filtering logic working correctly
    
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
        if (filters.status === 'new' && (transaction.isReviewed || !(transaction as any).bankTransactionId)) return false;
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
      if (filters.receiptStatus && filters.receiptStatus !== 'all') {
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

      // Auto Updates filter (AI categorization) - fixed logic to match UI options
      if (filters.autoUpdates && filters.autoUpdates !== 'all') {
        if (filters.autoUpdates === 'categorizations' && !transaction.aiCategory) return false;
        if (filters.autoUpdates === 'merges' && !(transaction as any).isMerged) return false;
        if (filters.autoUpdates === 'scanned_receipts' && transaction.receiptSource !== 'scan') return false;
      }

      return true;
    });

    console.log('🎯 After filtering:', { 
      filtered: filtered.length, 
      sampleTransaction: filtered[0] || 'No filtered transactions' 
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

    // Final filtering complete

    return filtered;
  }, [transactions, filters, sortBy, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredAndSortedTransactions.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const handleFiltersChange = (newFilters: Partial<TransactionFilters>) => {
    setFilters({ ...filters, ...newFilters });
    setCurrentPage(1);
  };



  // SSE: listen for transactions.synced events and auto-refresh
  useEffect(() => {
    const evtSource = new EventSource('/api/events/transactions');
    evtSource.addEventListener('transactions.synced', () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
    });
    evtSource.onerror = () => evtSource.close();
    return () => evtSource.close();
  }, [queryClient]);

  // Sync Now mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/plaid/sync-transactions', {
        method: 'POST',
        body: JSON.stringify({ useMock: true }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      setLastSyncResult({ added: data.totalAdded ?? 0, skipped: data.totalDuplicatesSkipped ?? 0 });
      toast({
        title: 'Sync complete',
        description: data.message ?? `${data.totalAdded} new transactions imported`,
      });
    },
    onError: () => {
      toast({
        title: 'Sync failed',
        description: 'Could not sync transactions. Please try again.',
        variant: 'destructive',
      });
    },
  });

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
      type: 'all',
      account: 'all',
      receiptStatus: 'all',
      dateRange: undefined,
      autoUpdates: 'all'
    });
  };



  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
          </div>
          
          {/* Table Skeleton */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-12 p-4">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4"></div>
                      </th>
                      {['Date', 'Description', 'Account', 'Category', 'Amount', 'Status'].map((header, i) => (
                        <th key={i} className="text-left p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(8)].map((_, i) => (
                      <tr key={i} className="border-b">
                        <td className="w-12 p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4"></div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        </td>
                        <td className="p-4">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedTransactions.length)} of {filteredAndSortedTransactions.length} transactions
            {filteredAndSortedTransactions.length !== transactions.length && ` (${transactions.length} total)`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="sync-now"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncMutation.isPending ? 'Syncing…' : 'Sync Now'}
          </Button>
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

      {/* Sync Result Banner */}
      {lastSyncResult && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 px-4 py-2 text-sm text-green-800 dark:text-green-200">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>
            Sync complete — <strong>{lastSyncResult.added}</strong> new transactions imported
            {lastSyncResult.skipped > 0 && `, ${lastSyncResult.skipped} duplicates skipped`}.
          </span>
          <button className="ml-auto text-green-600 hover:text-green-900" onClick={() => setLastSyncResult(null)}>✕</button>
        </div>
      )}

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

      {/* Transactions Table - Mobile-Optimized Layout */}
      <Card data-testid="transactions" className="flex-1 flex flex-col min-h-0">
        <CardHeader className="transaction-list border-b flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>All Transactions</CardTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedTransactions.size === paginatedTransactions.length && paginatedTransactions.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedTransactions(new Set(paginatedTransactions.map(t => t.id)));
                    } else {
                      setSelectedTransactions(new Set());
                    }
                  }}
                  aria-label="Select all transactions on this page"
                />
                <span className="text-sm text-muted-foreground">
                  Select all on page
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Show:</span>
                <Select value={itemsPerPage.toString()} onValueChange={(value) => {
                  setItemsPerPage(parseInt(value));
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
                <span>per page</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto min-h-0">
          {filteredAndSortedTransactions.length > 0 ? (
            <div className="overflow-x-auto overflow-y-auto max-h-full">
              <table className="w-full min-w-[800px]">
                <thead className="bg-muted/50 sticky top-0 z-10">
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
                  {paginatedTransactions.map((transaction) => (
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
        
        {/* Pagination Controls */}
        {filteredAndSortedTransactions.length > 0 && totalPages > 1 && (
          <div className="border-t p-4 flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedTransactions.length)} of {filteredAndSortedTransactions.length} transactions
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {/* Show page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        className="w-8 h-8 p-0"
                        aria-label={`Go to page ${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
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
