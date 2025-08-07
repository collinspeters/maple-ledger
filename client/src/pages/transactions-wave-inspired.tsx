import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Download, 
  Upload, 
  RefreshCw, 
  BarChart3,
  Filter,
  ChevronDown,
  FileText,
  Search,
  Calendar,
  ArrowUpDown
} from 'lucide-react';
import { apiRequest } from "@/lib/queryClient";
import { Transaction } from "@/components/transactions/transaction-row";

export default function TransactionsWaveInspired() {
  const queryClient = useQueryClient();
  
  // Enhanced state management for Wave-like experience
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'description'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

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

  // Enhanced filtering logic
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions.filter(transaction => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        if (!transaction.description.toLowerCase().includes(searchLower) &&
            !(transaction.vendor?.toLowerCase().includes(searchLower))) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory && 
          transaction.category !== selectedCategory && 
          transaction.aiCategory !== selectedCategory) {
        return false;
      }

      // Account filter
      if (selectedAccount && transaction.bankConnectionId !== selectedAccount) {
        return false;
      }

      // Status filter
      if (selectedStatus) {
        if (selectedStatus === 'reviewed' && !transaction.isReviewed) return false;
        if (selectedStatus === 'unreviewed' && (transaction.isReviewed || transaction.needsReview)) return false;
        if (selectedStatus === 'needs_review' && !transaction.needsReview) return false;
      }

      return true;
    });

    // Sort transactions
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'date':
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case 'amount':
          aVal = parseFloat(a.amount);
          bVal = parseFloat(b.amount);
          break;
        case 'description':
          aVal = a.description.toLowerCase();
          bVal = b.description.toLowerCase();
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? 
        (aVal > bVal ? 1 : -1) : 
        (aVal < bVal ? 1 : -1);
    });

    return filtered;
  }, [transactions, searchTerm, selectedCategory, selectedAccount, selectedStatus, sortBy, sortOrder]);

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

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    await updateTransactionMutation.mutateAsync({ id, updates });
  };

  const formatAmount = (amount: string, isExpense: boolean, isTransfer: boolean) => {
    const value = parseFloat(amount);
    const formatted = value.toLocaleString('en-CA', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
    
    if (isTransfer) return `$${formatted}`;
    return `${isExpense ? '-' : '+'}$${formatted}`;
  };

  const getAccountName = (bankConnectionId: string | undefined) => {
    if (!bankConnectionId) return 'Manual Entry';
    const account = accounts.find(acc => acc.id === bankConnectionId);
    return account ? account.name : 'Unknown Account';
  };

  const getAmountColor = (isExpense: boolean, isTransfer: boolean) => {
    if (isTransfer) return 'text-blue-600';
    return isExpense ? 'text-red-600' : 'text-green-600';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedAccount('');
    setSelectedStatus('');
  };

  const activeFilterCount = [searchTerm, selectedCategory, selectedAccount, selectedStatus].filter(Boolean).length;

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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header - Wave-inspired */}
      <div className="border-b bg-white dark:bg-gray-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Transactions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {filteredAndSortedTransactions.length} of {transactions.length} transactions
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="bg-white dark:bg-gray-800">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" size="sm" className="bg-white dark:bg-gray-800">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Transaction
            </Button>
          </div>
        </div>

        {/* Search and Filters - Wave Style */}
        <div className="mt-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48 bg-gray-50 dark:bg-gray-800">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-48 bg-gray-50 dark:bg-gray-800">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </div>

      {/* Transaction Table - Wave-inspired design */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="min-w-[800px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 border-b">
                <tr>
                  <th className="w-12 p-4">
                    <Checkbox />
                  </th>
                  <th className="text-left p-4 font-medium text-gray-900 dark:text-white">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (sortBy === 'date') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('date');
                          setSortOrder('desc');
                        }
                      }}
                      className="font-medium -ml-2"
                    >
                      Date
                      {sortBy === 'date' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </Button>
                  </th>
                  <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Description</th>
                  <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Account</th>
                  <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Category</th>
                  <th className="text-right p-4 font-medium text-gray-900 dark:text-white">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        if (sortBy === 'amount') {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy('amount');
                          setSortOrder('desc');
                        }
                      }}
                      className="font-medium"
                    >
                      Amount
                      {sortBy === 'amount' && <ArrowUpDown className="ml-1 h-3 w-3" />}
                    </Button>
                  </th>
                  <th className="text-left p-4 font-medium text-gray-900 dark:text-white">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTransactions.map((transaction, index) => (
                  <tr 
                    key={transaction.id} 
                    className={`
                      border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
                      ${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-800/20'}
                    `}
                  >
                    <td className="w-12 p-4">
                      <Checkbox />
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {new Date(transaction.date).toLocaleDateString('en-CA')}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">
                          {transaction.vendor || transaction.description}
                        </div>
                        {transaction.vendor && transaction.vendor !== transaction.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {transaction.description}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {getAccountName(transaction.bankConnectionId)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {transaction.category || transaction.aiCategory || 'Uncategorized'}
                        </span>
                        {transaction.aiCategory && !transaction.category && transaction.aiConfidence && (
                          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                            AI {Math.round(transaction.aiConfidence * 100)}%
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className={`font-medium ${getAmountColor(transaction.isExpense, transaction.isTransfer || false)}`}>
                        {formatAmount(transaction.amount, transaction.isExpense, transaction.isTransfer || false)}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {transaction.isReviewed ? (
                          <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">
                            Reviewed
                          </Badge>
                        ) : transaction.needsReview ? (
                          <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">
                            Needs Review
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-700 bg-gray-50 border-gray-200">
                            Unreviewed
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAndSortedTransactions.length === 0 && (
              <div className="text-center py-16">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No transactions found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
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
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}