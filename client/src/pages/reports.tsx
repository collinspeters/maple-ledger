import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Calculator,
  PieChart,
  BarChart3,
  Download,
  Mail,
  Calendar as CalendarIcon,
  Building2,
  Receipt,
  Scale,
  BookOpen,
  ChevronRight,
  Eye,
  ArrowUpDown
} from "lucide-react";

type DateRange = {
  from: Date;
  to: Date;
};

type ProfitLossReport = {
  revenue: {
    categories: Array<{
      category: string;
      amount: number;
    }>;
    total: number;
  };
  expenses: {
    categories: Array<{
      category: string;
      amount: number;
    }>;
    total: number;
  };
  netProfit: number;
  period: {
    startDate: string;
    endDate: string;
  };
};

type BalanceSheetReport = {
  assets: {
    current: Array<{
      account: string;
      amount: number;
    }>;
    fixed: Array<{
      account: string;
      amount: number;
    }>;
    total: number;
  };
  liabilities: {
    current: Array<{
      account: string;
      amount: number;
    }>;
    longTerm: Array<{
      account: string;
      amount: number;
    }>;
    total: number;
  };
  equity: {
    retainedEarnings: number;
    currentEarnings: number;
    total: number;
  };
  asOfDate: string;
};

type TaxSummaryReport = {
  taxCollected: number;
  taxPaid: number;
  netTaxOwing: number;
  period: {
    startDate: string;
    endDate: string;
  };
  gstHstBreakdown: Array<{
    province: string;
    rate: number;
    collected: number;
    paid: number;
    net: number;
  }>;
};

type TrialBalanceReport = {
  accounts: Array<{
    accountName: string;
    accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    debit: number;
    credit: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  asOfDate: string;
};

type GeneralLedgerReport = {
  accounts: Array<{
    accountName: string;
    accountType: string;
    transactions: Array<{
      date: string;
      description: string;
      reference: string;
      debit: number;
      credit: number;
      balance: number;
    }>;
    beginningBalance: number;
    endingBalance: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
};

// Transaction detail for drill-down
type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: string;
  category: string;
  aiCategory?: string;
  isExpense: boolean;
  isPosted: boolean;
  receiptAttached: boolean;
};

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date()
  });
  const [datePreset, setDatePreset] = useState<string>("thisMonth");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showTransactionDetail, setShowTransactionDetail] = useState(false);

  // Fetch reports data
  const { data: profitLoss, isLoading: plLoading } = useQuery<ProfitLossReport>({
    queryKey: [`/api/reports/profit-loss?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`],
  });

  const { data: balanceSheet, isLoading: bsLoading } = useQuery<BalanceSheetReport>({
    queryKey: [`/api/reports/balance-sheet?asOf=${dateRange.to.toISOString()}`],
  });

  const { data: taxSummary, isLoading: taxLoading } = useQuery<TaxSummaryReport>({
    queryKey: [`/api/reports/tax-summary?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`],
  });

  const { data: trialBalance, isLoading: tbLoading } = useQuery<TrialBalanceReport>({
    queryKey: [`/api/reports/trial-balance?asOf=${dateRange.to.toISOString()}`],
  });

  const { data: generalLedger, isLoading: glLoading } = useQuery<GeneralLedgerReport>({
    queryKey: [`/api/reports/general-ledger?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`],
  });

  // Get all transactions for category drill-down
  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['/api/transactions'],
  });

  const formatCurrency = (amount: number) => {
    // Handle NaN, null, undefined values
    if (isNaN(amount) || amount === null || amount === undefined) {
      return '$0.00';
    }
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const formatDateRange = (from: Date, to: Date) => {
    return `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`;
  };

  // Handle category drill-down
  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setShowTransactionDetail(true);
  };

  // Get transactions for selected category
  const getCategoryTransactions = (category: string) => {
    if (!transactions) return [];
    
    return transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const inDateRange = transactionDate >= dateRange.from && transactionDate <= dateRange.to;
      const matchesCategory = t.category === category || t.aiCategory === category;
      return inDateRange && matchesCategory;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    switch (preset) {
      case "thisMonth":
        setDateRange({
          from: new Date(currentYear, currentMonth, 1),
          to: new Date(currentYear, currentMonth + 1, 0)
        });
        break;
      case "lastMonth":
        setDateRange({
          from: new Date(currentYear, currentMonth - 1, 1),
          to: new Date(currentYear, currentMonth, 0)
        });
        break;
      case "thisQuarter":
        const quarterStart = Math.floor(currentMonth / 3) * 3;
        setDateRange({
          from: new Date(currentYear, quarterStart, 1),
          to: new Date(currentYear, quarterStart + 3, 0)
        });
        break;
      case "thisYear":
        setDateRange({
          from: new Date(currentYear, 0, 1),
          to: new Date(currentYear, 11, 31)
        });
        break;
      case "lastYear":
        setDateRange({
          from: new Date(currentYear - 1, 0, 1),
          to: new Date(currentYear - 1, 11, 31)
        });
        break;
    }
  };

  const exportReport = (reportType: string) => {
    // Implementation for PDF export
    window.open(`/api/reports/${reportType}/export?from=${dateRange.from.toISOString()}&to=${dateRange.to.toISOString()}`, '_blank');
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-6">
      {/* Header - Simplified to remove duplication */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-600">
            Generate financial reports and insights for your business
          </p>
        </div>
        
        {/* Date Range Controls */}
        <div className="flex items-center gap-4">
          <Select value={datePreset} onValueChange={handleDatePresetChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="lastMonth">Last Month</SelectItem>
              <SelectItem value="thisQuarter">This Quarter</SelectItem>
              <SelectItem value="thisYear">This Year</SelectItem>
              <SelectItem value="lastYear">Last Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-60 justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(dateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={(range) => range && setDateRange(range as DateRange)}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-card border-0 rounded-xl bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {profitLoss ? formatCurrency(profitLoss.revenue.total) : '--'}
                </p>
                <p className="text-sm text-gray-600">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 rounded-xl bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {profitLoss ? formatCurrency(profitLoss.expenses.total) : '--'}
                </p>
                <p className="text-sm text-gray-600">Total Expenses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 rounded-xl bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${profitLoss && profitLoss.netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <DollarSign className={`h-5 w-5 ${profitLoss && profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${profitLoss && profitLoss.netProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  {profitLoss ? formatCurrency(profitLoss.netProfit) : '--'}
                </p>
                <p className="text-sm text-gray-600">Net Profit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0 rounded-xl bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Receipt className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {taxSummary ? formatCurrency(taxSummary.netTaxOwing) : '--'}
                </p>
                <p className="text-sm text-gray-600">Tax Owing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs */}
      <Tabs defaultValue="profit-loss" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profit-loss" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            P&L
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Balance Sheet
          </TabsTrigger>
          <TabsTrigger value="tax-summary" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Tax Summary
          </TabsTrigger>
          <TabsTrigger value="trial-balance" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Trial Balance
          </TabsTrigger>
          <TabsTrigger value="general-ledger" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            General Ledger
          </TabsTrigger>
        </TabsList>

        {/* Profit & Loss Report */}
        <TabsContent value="profit-loss">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-600" />
                Profit & Loss Statement
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportReport('profit-loss')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {plLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : profitLoss ? (
                <div className="bg-white">
                  <div className="text-center border-b-2 pb-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {formatDateRange(dateRange.from, dateRange.to)}
                    </h3>
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b-2">
                        <TableHead className="font-bold text-left w-3/4">Account</TableHead>
                        <TableHead className="font-bold text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Revenue Section */}
                      <TableRow className="bg-green-50">
                        <TableCell className="font-bold text-green-800 py-3">REVENUE</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {profitLoss.revenue.categories.map((category, index) => (
                        <TableRow key={index} className="hover:bg-gray-50 cursor-pointer group" onClick={() => handleCategoryClick(category.category)}>
                          <TableCell className="pl-6 group-hover:text-blue-600 flex items-center">
                            {category.category.replace(/_/g, ' ')}
                            <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(category.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t border-green-200 bg-green-50">
                        <TableCell className="font-bold pl-6">Total Revenue</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          {formatCurrency(profitLoss.revenue.total)}
                        </TableCell>
                      </TableRow>
                      
                      {/* Spacing */}
                      <TableRow><TableCell colSpan={2} className="h-4"></TableCell></TableRow>
                      
                      {/* Expenses Section */}
                      <TableRow className="bg-red-50">
                        <TableCell className="font-bold text-red-800 py-3">EXPENSES</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {profitLoss.expenses.categories.map((category, index) => (
                        <TableRow key={index} className="hover:bg-gray-50 cursor-pointer group" onClick={() => handleCategoryClick(category.category)}>
                          <TableCell className="pl-6 group-hover:text-blue-600 flex items-center">
                            {category.category.replace(/_/g, ' ')}
                            <ChevronRight className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {formatCurrency(category.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t border-red-200 bg-red-50">
                        <TableCell className="font-bold pl-6">Total Expenses</TableCell>
                        <TableCell className="text-right font-bold text-red-600">
                          {formatCurrency(profitLoss.expenses.total)}
                        </TableCell>
                      </TableRow>
                      
                      {/* Spacing */}
                      <TableRow><TableCell colSpan={2} className="h-4"></TableCell></TableRow>
                      
                      {/* Net Profit */}
                      <TableRow className="border-t-2 border-gray-400 bg-blue-50">
                        <TableCell className="font-bold text-lg">NET PROFIT</TableCell>
                        <TableCell className={`text-right font-bold text-lg ${profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(profitLoss.netProfit)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No data available for selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet Report */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                Balance Sheet
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportReport('balance-sheet')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : balanceSheet ? (
                <div className="space-y-6">
                  <div className="text-center border-b pb-4">
                    <h3 className="text-lg font-semibold">
                      As of {format(new Date(balanceSheet.asOfDate), "MMMM d, yyyy")}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Assets */}
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Assets</h4>
                      
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Current Assets</h5>
                        {balanceSheet.assets.current.map((asset, index) => (
                          <div key={index} className="flex justify-between py-1 pl-4">
                            <span className="text-gray-600">{asset.account}</span>
                            <span>{formatCurrency(asset.amount)}</span>
                          </div>
                        ))}
                      </div>

                      {balanceSheet.assets.fixed.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Fixed Assets</h5>
                          {balanceSheet.assets.fixed.map((asset, index) => (
                            <div key={index} className="flex justify-between py-1 pl-4">
                              <span className="text-gray-600">{asset.account}</span>
                              <span>{formatCurrency(asset.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total Assets</span>
                        <span>{formatCurrency(balanceSheet.assets.total)}</span>
                      </div>
                    </div>

                    {/* Liabilities & Equity */}
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Liabilities & Equity</h4>
                      
                      <div className="mb-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Current Liabilities</h5>
                        {balanceSheet.liabilities.current.map((liability, index) => (
                          <div key={index} className="flex justify-between py-1 pl-4">
                            <span className="text-gray-600">{liability.account}</span>
                            <span>{formatCurrency(liability.amount)}</span>
                          </div>
                        ))}
                      </div>

                      {balanceSheet.liabilities.longTerm.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Long-term Liabilities</h5>
                          {balanceSheet.liabilities.longTerm.map((liability, index) => (
                            <div key={index} className="flex justify-between py-1 pl-4">
                              <span className="text-gray-600">{liability.account}</span>
                              <span>{formatCurrency(liability.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total Liabilities</span>
                        <span>{formatCurrency(balanceSheet.liabilities.total)}</span>
                      </div>

                      <div className="mt-6">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">Equity</h5>
                        <div className="flex justify-between py-1 pl-4">
                          <span className="text-gray-600">Retained Earnings</span>
                          <span>{formatCurrency(balanceSheet.equity.retainedEarnings)}</span>
                        </div>
                        <div className="flex justify-between py-1 pl-4">
                          <span className="text-gray-600">Current Year Earnings</span>
                          <span>{formatCurrency(balanceSheet.equity.currentYearEarnings || 0)}</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t pt-2">
                          <span>Total Equity</span>
                          <span>{formatCurrency(balanceSheet.equity.total)}</span>
                        </div>
                      </div>

                      <div className="flex justify-between font-bold text-lg border-t-2 border-gray-300 pt-3 mt-4">
                        <span>Total Liabilities & Equity</span>
                        <span>{formatCurrency(balanceSheet.liabilities.total + balanceSheet.equity.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Scale className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No balance sheet data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Summary Report */}
        <TabsContent value="tax-summary">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                Tax Summary
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportReport('tax-summary')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {taxLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : taxSummary ? (
                <div className="space-y-6">
                  <div className="text-center border-b pb-4">
                    <h3 className="text-lg font-semibold">
                      {format(new Date(taxSummary.period.startDate), "MMMM d, yyyy")} - {format(new Date(taxSummary.period.endDate), "MMMM d, yyyy")}
                    </h3>
                  </div>

                  {/* Tax Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          {formatCurrency(taxSummary.taxCollected)}
                        </div>
                        <div className="text-sm text-gray-600">GST/HST Collected</div>
                        <div className="text-xs text-gray-500 mt-1">Tax charged to customers</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600 mb-2">
                          {formatCurrency(taxSummary.taxPaid)}
                        </div>
                        <div className="text-sm text-gray-600">GST/HST Paid</div>
                        <div className="text-xs text-gray-500 mt-1">Input Tax Credits</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold mb-2 ${(taxSummary.netTaxOwing || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(Math.abs(taxSummary.netTaxOwing || 0))}
                        </div>
                        <div className="text-sm text-gray-600">
                          {(taxSummary.netTaxOwing || 0) >= 0 ? 'Tax Owing' : 'Tax Refund'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {(taxSummary.netTaxOwing || 0) >= 0 ? 'Amount to remit' : 'Amount to claim'}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Provincial Breakdown */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3">Provincial Breakdown</h4>
                    <div className="space-y-3">
                      {taxSummary.gstHstBreakdown.map((province, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium">{province.province}</h5>
                            <Badge variant="secondary">{Math.round((province.rate || 0) * 100)}%</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <div className="text-gray-600">Collected</div>
                              <div className="font-medium">{formatCurrency(province.collected)}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Paid</div>
                              <div className="font-medium">{formatCurrency(province.paid)}</div>
                            </div>
                            <div>
                              <div className="text-gray-600">Net</div>
                              <div className={`font-medium ${(province.net || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(Math.abs(province.net || 0))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Receipt className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No tax data available for selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance Report */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-blue-600" />
                Trial Balance
                {trialBalance && (
                  <Badge variant={trialBalance.isBalanced ? "default" : "destructive"} className="ml-2">
                    {trialBalance.isBalanced ? "Balanced" : "Out of Balance"}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportReport('trial-balance')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tbLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : trialBalance ? (
                <div className="space-y-6">
                  <div className="text-center border-b pb-4">
                    <h3 className="text-lg font-semibold">
                      As of {format(new Date(trialBalance.asOfDate), "MMMM d, yyyy")}
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Account Name</th>
                          <th className="text-left py-2">Account Type</th>
                          <th className="text-right py-2">Debit</th>
                          <th className="text-right py-2">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalance.accounts.map((account, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-2">{account.accountName}</td>
                            <td className="py-2 capitalize">
                              <Badge variant="outline" className="text-xs">
                                {account.accountType}
                              </Badge>
                            </td>
                            <td className="text-right py-2">
                              {account.debit > 0 ? formatCurrency(account.debit) : '--'}
                            </td>
                            <td className="text-right py-2">
                              {account.credit > 0 ? formatCurrency(account.credit) : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 font-semibold">
                          <td className="py-3" colSpan={2}>Total</td>
                          <td className="text-right py-3">{formatCurrency(trialBalance.totalDebits)}</td>
                          <td className="text-right py-3">{formatCurrency(trialBalance.totalCredits)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {!trialBalance.isBalanced && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-red-800 mb-2">
                        <ArrowUpDown className="h-4 w-4" />
                        <span className="font-medium">Trial Balance is Out of Balance</span>
                      </div>
                      <p className="text-red-700 text-sm">
                        Total debits ({formatCurrency(trialBalance.totalDebits)}) do not equal total credits ({formatCurrency(trialBalance.totalCredits)}).
                        Please review your journal entries.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calculator className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No trial balance data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Ledger Report */}
        <TabsContent value="general-ledger">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                General Ledger
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportReport('general-ledger')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {glLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : generalLedger ? (
                <div className="space-y-8">
                  <div className="text-center border-b pb-4">
                    <h3 className="text-lg font-semibold">
                      {format(new Date(generalLedger.period.startDate), "MMMM d, yyyy")} - {format(new Date(generalLedger.period.endDate), "MMMM d, yyyy")}
                    </h3>
                  </div>

                  {generalLedger.accounts.map((account, accountIndex) => (
                    <div key={accountIndex} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold">{account.accountName}</h4>
                          <Badge variant="outline" className="text-xs mt-1 capitalize">
                            {account.accountType}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">Beginning Balance</div>
                          <div className="font-medium">{formatCurrency(account.beginningBalance)}</div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2">Date</th>
                              <th className="text-left py-2">Description</th>
                              <th className="text-left py-2">Ref</th>
                              <th className="text-right py-2">Debit</th>
                              <th className="text-right py-2">Credit</th>
                              <th className="text-right py-2">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.transactions.map((transaction, transIndex) => (
                              <tr key={transIndex} className="border-b">
                                <td className="py-2">{format(new Date(transaction.date), "MMM d, yyyy")}</td>
                                <td className="py-2 max-w-xs truncate">{transaction.description}</td>
                                <td className="py-2 text-xs text-gray-500">{transaction.reference}</td>
                                <td className="text-right py-2">
                                  {transaction.debit > 0 ? formatCurrency(transaction.debit) : '--'}
                                </td>
                                <td className="text-right py-2">
                                  {transaction.credit > 0 ? formatCurrency(transaction.credit) : '--'}
                                </td>
                                <td className="text-right py-2 font-medium">
                                  {formatCurrency(transaction.balance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 font-semibold">
                              <td className="py-3" colSpan={5}>Ending Balance</td>
                              <td className="text-right py-3">{formatCurrency(account.endingBalance)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No ledger data available for selected period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Detail Modal */}
      <Dialog open={showTransactionDetail} onOpenChange={setShowTransactionDetail}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Transactions in {selectedCategory?.replace(/_/g, ' ')}
              <Badge variant="outline" className="ml-2">
                {selectedCategory ? getCategoryTransactions(selectedCategory).length : 0} transactions
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {selectedCategory && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Date range: {formatDateRange(dateRange.from, dateRange.to)}
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getCategoryTransactions(selectedCategory).map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-gray-50">
                      <TableCell>
                        {format(new Date(transaction.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={transaction.description}>
                          {transaction.description}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className={transaction.isExpense ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(parseFloat(transaction.amount))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.isPosted ? "default" : "secondary"}>
                          {transaction.isPosted ? "Posted" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {transaction.receiptAttached ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Receipt className="h-3 w-3 mr-1" />
                            Attached
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">No receipt</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {getCategoryTransactions(selectedCategory).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No transactions found in this category for the selected date range.
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}