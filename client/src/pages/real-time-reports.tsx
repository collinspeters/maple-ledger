import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt, 
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw
} from "lucide-react";

interface DashboardData {
  incomeStatement: {
    revenue: { total: number; categories: any[] };
    expenses: { total: number; categories: any[] };
    netProfit: number;
  };
  balanceSheet: {
    assets: { total: number };
    liabilities: { total: number };
    equity: { total: number };
  };
  gstSummary: {
    totalSales: number;
    taxableSales: number;
    gstCollected: number;
    inputTaxCredits: number;
    netTaxOwing: number;
  };
  expenseBreakdown: Array<{
    category: string;
    total: number;
    count: number;
    withReceipts: number;
    receiptCoverage: number;
    postingStatus: number;
  }>;
  postingStatus: {
    total: number;
    posted: number;
    percentage: number;
  };
  lastUpdated: string;
}

export default function RealTimeReports() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: dashboard, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['/api/reports/dashboard'],
    refetchInterval: autoRefresh ? 30000 : false, // Auto-refresh every 30 seconds
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'percent',
      minimumFractionDigits: 1
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Loading real-time financial data...</span>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container mx-auto p-6">
        <p>No financial data available</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Financial Reports</h1>
          <p className="text-muted-foreground">
            Live sync with double-entry accounting • Last updated: {new Date(dashboard.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Clock className="w-4 h-4 mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(dashboard.incomeStatement.revenue.total)}
            </div>
            <p className="text-xs text-muted-foreground">Year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(dashboard.incomeStatement.expenses.total)}
            </div>
            <p className="text-xs text-muted-foreground">Year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${dashboard.incomeStatement.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(dashboard.incomeStatement.netProfit)}
            </div>
            <p className="text-xs text-muted-foreground">Year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posting Status</CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(dashboard.postingStatus.percentage)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard.postingStatus.posted} of {dashboard.postingStatus.total} transactions posted
            </p>
            <Progress value={dashboard.postingStatus.percentage * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Balance Sheet Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet Summary</CardTitle>
          <CardDescription>Real-time account balances from Chart of Accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground">Assets</div>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(dashboard.balanceSheet.assets.total)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground">Liabilities</div>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(dashboard.balanceSheet.liabilities.total)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-muted-foreground">Equity</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(dashboard.balanceSheet.equity.total)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GST/HST Summary */}
      <Card>
        <CardHeader>
          <CardTitle>GST/HST Summary</CardTitle>
          <CardDescription>Canadian tax compliance tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Total Sales</div>
              <div className="text-lg font-bold">{formatCurrency(dashboard.gstSummary.totalSales)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Taxable Sales</div>
              <div className="text-lg font-bold">{formatCurrency(dashboard.gstSummary.taxableSales)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">GST Collected</div>
              <div className="text-lg font-bold text-green-600">{formatCurrency(dashboard.gstSummary.gstCollected)}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Net Tax Owing</div>
              <div className={`text-lg font-bold ${dashboard.gstSummary.netTaxOwing >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(dashboard.gstSummary.netTaxOwing)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown by Category</CardTitle>
          <CardDescription>T2125 categories with receipt matching status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboard.expenseBreakdown.map((category, index) => (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{category.category.replace(/_/g, ' ')}</h4>
                    <Badge variant="outline">{category.count} transactions</Badge>
                  </div>
                  <div className="flex items-center space-x-4 mt-2">
                    <div className="flex items-center space-x-1 text-sm">
                      <Receipt className="w-4 h-4" />
                      <span>{formatPercentage(category.receiptCoverage)} with receipts</span>
                    </div>
                    <div className="flex items-center space-x-1 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span>{formatPercentage(category.postingStatus)} posted</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{formatCurrency(category.total)}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatCurrency(category.total / category.count)} avg
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Real-time Status Indicator */}
      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>Live sync active</span>
        </div>
        <span>•</span>
        <span>Updates every 30 seconds</span>
        <span>•</span>
        <span>Double-entry accounting</span>
      </div>
    </div>
  );
}