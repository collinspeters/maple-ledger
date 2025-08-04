import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Filter, X, Search } from 'lucide-react';

type DateRange = {
  from?: Date;
  to?: Date;
} | undefined;

export interface TransactionFilters {
  search: string;
  category: string;
  status: string;
  type: string;
  account: string;
  receiptStatus: string;
  dateRange: DateRange | undefined;
  autoUpdates: string;
}

interface TransactionFiltersProps {
  filters: TransactionFilters;
  onFiltersChange: (filters: Partial<TransactionFilters>) => void;
  accounts: Array<{ id: string; name: string }>;
  categories: string[];
  onClearFilters: () => void;
  activeFilterCount: number;
}

export function TransactionFiltersComponent({
  filters,
  onFiltersChange,
  accounts,
  categories,
  onClearFilters,
  activeFilterCount
}: TransactionFiltersProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const handleDateSelect = (range: DateRange | undefined) => {
    onFiltersChange({ dateRange: range });
    if (range?.from && range?.to) {
      setIsDatePickerOpen(false);
    }
  };

  return (
    <div className="space-y-4 bg-white dark:bg-gray-900 border rounded-lg p-4">
      {/* Search and Quick Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search transactions..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                className="flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Category</Label>
          <Select
            value={filters.category}
            onValueChange={(value) => onFiltersChange({ category: value })}
          >
            <SelectTrigger>
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
        </div>

        {/* Status Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(value) => onFiltersChange({ status: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="unreviewed">Unreviewed</SelectItem>
              <SelectItem value="needs_review">Needs Review</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Type Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Type</Label>
          <Select
            value={filters.type}
            onValueChange={(value) => onFiltersChange({ type: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income/Deposit</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="journal">Journal Entry</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Account Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Account</Label>
          <Select
            value={filters.account}
            onValueChange={(value) => onFiltersChange({ account: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Receipt Status Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Receipts</Label>
          <Select
            value={filters.receiptStatus}
            onValueChange={(value) => onFiltersChange({ receiptStatus: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All receipts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All receipts</SelectItem>
              <SelectItem value="from_scan">From scan</SelectItem>
              <SelectItem value="has_receipt">Any receipt attached</SelectItem>
              <SelectItem value="no_receipt">No receipts attached</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={filters.dateRange?.from ? filters.dateRange.from.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : undefined;
                onFiltersChange({ 
                  dateRange: { 
                    from: date, 
                    to: filters.dateRange?.to 
                  } 
                });
              }}
              placeholder="From date"
            />
            <Input
              type="date"
              value={filters.dateRange?.to ? filters.dateRange.to.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const date = e.target.value ? new Date(e.target.value) : undefined;
                onFiltersChange({ 
                  dateRange: { 
                    from: filters.dateRange?.from, 
                    to: date 
                  } 
                });
              }}
              placeholder="To date"
            />
          </div>
        </div>
      </div>

      {/* Auto-Updates Filter */}
      <div className="border-t pt-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Auto-Updates</Label>
          <Select
            value={filters.autoUpdates}
            onValueChange={(value) => onFiltersChange({ autoUpdates: value })}
          >
            <SelectTrigger className="w-full md:w-64">
              <SelectValue placeholder="All auto-updates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All auto-updates</SelectItem>
              <SelectItem value="categorizations">Categorizations</SelectItem>
              <SelectItem value="merges">Merges</SelectItem>
              <SelectItem value="scanned_receipts">Scanned receipts</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}