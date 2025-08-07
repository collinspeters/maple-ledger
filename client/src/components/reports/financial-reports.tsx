import { useState } from "react";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/
import ErrorBoundary from "@/components/ui/error-boundary";
card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Download, 
  Calendar,
  DollarSign,
  PieChart,
  BarChart3
} from "lucide-react";

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  expensesByCategory: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
}

interface ReportsProps {
  period?: string;
}

export default function FinancialReports({ period = "current-month" }: ReportsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [reportType, setReportType] = useState<"pl" | "balance" | "cash-flow" | "tax">("pl");

  const { data: financialData, isLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/reports/financial-summary", selectedPeriod],
  });

  const reportTypes = [
    { id: "pl", name: "Profit & Loss", icon: TrendingUp, description: "Income and expenses overview" },
    { id: "balance", name: "Balance Sheet", icon: BarChart3, description: "Assets and liabilities" },
    { id: "cash-flow", name: "Cash Flow", icon: DollarSign, description: "Money in and out" },
    { id: "tax", name: "Tax Summary", icon: FileText, description: "CRA-ready tax information" },
  ];

  const periods = [
    { value: "current-month", label: "This Month" },
    { value: "last-month", label: "Last Month" },
    { value: "current-quarter", label: "This Quarter" },
    { value: "last-quarter", label: "Last Quarter" },
    { value: "current-year", label: "This Year" },
    { value: "last-year", label: "Last Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const handleExportPDF = () => {
    // This would trigger PDF generation
    console.log("Exporting PDF report...");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
      <ErrorBoundary>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded">
      </ErrorBoundary>
    </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Reports</h2>
          <p className="text-gray-600">Professional reports for Canadian sole proprietors</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button aria-label="Button action" o>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = reportType === type.id;
          
          return (
            <motion.div
              key={type.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}
                o> setReportType(type.id as any)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{type.name}</h3>
                      <p className="text-sm text-gray-600">{type.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Financial Summary Cards */}
      {financialData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${financialData.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    ${financialData.totalExpenses.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Net Income</p>
                  <p className={`text-2xl font-bold ${
                    financialData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${financialData.netIncome.toLocaleString()}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${
                  financialData.netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <DollarSign className={`h-6 w-6 ${
                    financialData.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Report Content */}
      {reportType === "pl" && (
        <ProfitLossReport data={financialData} period={selectedPeriod} />
      )}
      
      {reportType === "tax" && (
        <TaxSummaryReport data={financialData} period={selectedPeriod} />
      )}

      {reportType === "cash-flow" && (
        <CashFlowReport data={financialData} period={selectedPeriod} />
      )}
    </div>
  );
}

// Profit & Loss Report Component
function ProfitLossReport({ data, period }: { data?: FinancialSummary; period: string }) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <PieChart className="h-5 w-5" />
          <span>Profit & Loss Statement</span>
          <Badge variant="secondary">
            {period.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Revenue Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Revenue</h3>
            <div className="pl-4 border-l-2 border-green-200">
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-700">Total Revenue</span>
                <span className="font-semibold text-green-600">
                  ${data.totalRevenue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Expenses Section */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Expenses</h3>
            <div className="pl-4 border-l-2 border-red-200 space-y-2">
              {data.expensesByCategory.map((expense) => (
                <div key={expense.category} className="flex justify-between items-center py-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-700">{expense.category}</span>
                    <Badge variant="outline" className="text-xs">
                      {expense.percentage}%
                    </Badge>
                  </div>
                  <span className="font-medium text-red-600">
                    ${expense.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between items-center font-semibold">
                  <span className="text-gray-900">Total Expenses</span>
                  <span className="text-red-600">
                    ${data.totalExpenses.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Income */}
          <div className="border-t-2 border-gray-200 pt-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Net Income</h3>
              <span className={`text-xl font-bold ${
                data.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${data.netIncome.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Tax Summary Report Component  
function TaxSummaryReport({ data, period }: { data?: FinancialSummary; period: string }) {
  if (!data) return null;

  // Canadian tax calculations
  const gstHst = data.totalRevenue * 0.05; // 5% GST (simplified)
  const deductibleExpenses = data.totalExpenses;
  const taxableIncome = Math.max(0, data.netIncome);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Canadian Tax Summary</span>
          <Badge variant="secondary">CRA Ready</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">GST/HST Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>GST/HST Collected (5%)</span>
                <span className="font-medium">${gstHst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST/HST on Expenses</span>
                <span className="font-medium">${(deductibleExpenses * 0.05).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Business Income Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span>Total Business Revenue</span>
                <span className="font-medium">${data.totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span>Total Deductible Expenses</span>
                <span className="font-medium">${deductibleExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 font-semibold text-lg border-t-2">
                <span>Net Business Income</span>
                <span className={taxableIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ${taxableIncome.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This is a simplified tax summary for Canadian sole proprietors. 
              Consult with a qualified accountant for complete tax preparation and to ensure 
              compliance with current CRA regulations.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Cash Flow Report Component
function CashFlowReport({ data, period }: { data?: FinancialSummary; period: string }) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Cash Flow Statement</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {data.monthlyData && data.monthlyData.length > 0 ? (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Monthly Cash Flow</h3>
              {data.monthlyData.map((month) => (
                <div key={month.month} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">{month.month}</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-green-600">Cash In (Revenue)</span>
                      <span className="font-medium">${month.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-red-600">Cash Out (Expenses)</span>
                      <span className="font-medium">${month.expenses.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Net Cash Flow</span>
                      <span className={month.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${month.profit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No monthly data available for this period</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}