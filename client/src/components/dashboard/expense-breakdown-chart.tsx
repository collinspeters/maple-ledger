import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ExpenseCategory {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

const COLORS = [
  "#10b981", // emerald-500
  "#f59e0b", // amber-500  
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
  "#f97316", // orange-500
];

export default function ExpenseBreakdownChart() {
  const { data: expenses = [], isLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-breakdown"],
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-card rounded-xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse w-64 h-64 bg-gray-200 rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!expenses.length) {
    return (
      <Card className="border-0 shadow-card rounded-xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium">No expenses found</p>
              <p className="text-sm">Start categorizing transactions to see breakdown</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.category}</p>
          <p className="text-sm text-gray-600">
            ${data.amount.toLocaleString()} ({data.percentage.toFixed(1)}%)
          </p>
          <p className="text-xs text-gray-500">{data.count} transactions</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-0 shadow-card rounded-xl bg-white">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
          Expense Breakdown
          <span className="text-sm font-normal text-gray-500">This Month</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenses}
                cx="50%"
                cy="50%"
                outerRadius={window.innerWidth < 768 ? 60 : 80}
                fill="#8884d8"
                dataKey="amount"
                label={({ percentage }) => `${percentage.toFixed(0)}%`}
                labelLine={false}
              >
                {expenses.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                wrapperStyle={{ fontSize: '12px' }}
                formatter={(value, entry: any) => (
                  <span className="text-xs md:text-sm text-gray-700 truncate">
                    {value} (${entry.payload.amount.toLocaleString()})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}