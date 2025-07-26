import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FinancialSummary {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  gstOwing: number;
}

export default function Reports() {
  const { data: summary } = useQuery<FinancialSummary>({
    queryKey: ["/api/financial-summary"],
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
        <Button className="bg-primary hover:bg-primary-dark">
          Export PDF
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Profit & Loss Statement</h2>
            <p className="text-sm text-gray-600">Current month overview</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700">Total Revenue</span>
                <span className="font-semibold text-secondary">
                  ${summary?.totalRevenue?.toLocaleString() || '0.00'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Total Expenses</span>
                <span className="font-semibold text-gray-900">
                  ${summary?.totalExpenses?.toLocaleString() || '0.00'}
                </span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Net Profit</span>
                <span className="font-bold text-lg text-secondary">
                  ${summary?.netProfit?.toLocaleString() || '0.00'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">GST/HST Summary</h2>
            <p className="text-sm text-gray-600">Tax obligations</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700">GST/HST Collected</span>
                <span className="font-semibold">
                  ${((summary?.totalRevenue || 0) * 0.13).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">GST/HST Paid</span>
                <span className="font-semibold">
                  ${((summary?.totalExpenses || 0) * 0.13).toLocaleString()}
                </span>
              </div>
              <hr />
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Net GST/HST Owing</span>
                <span className="font-bold text-lg text-accent">
                  ${summary?.gstOwing?.toLocaleString() || '0.00'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
