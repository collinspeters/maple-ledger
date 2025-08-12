import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function MonthlyTrendChart() {
  const { data: monthlyData = [], isLoading } = useQuery<MonthlyData[]>({
    queryKey: ["/api/monthly-trends"],
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-card rounded-xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Monthly Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse space-y-4 w-full">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!monthlyData.length) {
    return (
      <Card className="border-0 shadow-card rounded-xl bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Monthly Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg font-medium">No historical data</p>
              <p className="text-sm">Data will appear as you use the system over time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: ${entry.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="border-0 shadow-card rounded-xl bg-white">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center justify-between">
          Monthly Trends
          <span className="text-sm font-normal text-gray-500">Last 6 Months</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={monthlyData} 
              margin={{ 
                top: 5, 
                right: window.innerWidth < 768 ? 10 : 30, 
                left: window.innerWidth < 768 ? 10 : 20, 
                bottom: 5 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="month" 
                stroke="#64748b"
                fontSize={window.innerWidth < 768 ? 10 : 12}
                tickLine={false}
                axisLine={false}
                angle={window.innerWidth < 768 ? -45 : 0}
                textAnchor={window.innerWidth < 768 ? 'end' : 'middle'}
                height={window.innerWidth < 768 ? 60 : 30}
              />
              <YAxis 
                stroke="#64748b"
                fontSize={window.innerWidth < 768 ? 10 : 12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                width={window.innerWidth < 768 ? 40 : 60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: window.innerWidth < 768 ? '11px' : '14px' }} />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#10b981" 
                strokeWidth={window.innerWidth < 768 ? 2 : 3}
                dot={{ fill: "#10b981", strokeWidth: 2, r: window.innerWidth < 768 ? 3 : 4 }}
                activeDot={{ r: window.innerWidth < 768 ? 4 : 6, stroke: "#10b981", strokeWidth: 2 }}
                name="Revenue"
              />
              <Line 
                type="monotone" 
                dataKey="expenses" 
                stroke="#f59e0b" 
                strokeWidth={window.innerWidth < 768 ? 2 : 3}
                dot={{ fill: "#f59e0b", strokeWidth: 2, r: window.innerWidth < 768 ? 3 : 4 }}
                activeDot={{ r: window.innerWidth < 768 ? 4 : 6, stroke: "#f59e0b", strokeWidth: 2 }}
                name="Expenses"
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#3b82f6" 
                strokeWidth={window.innerWidth < 768 ? 2 : 3}
                dot={{ fill: "#3b82f6", strokeWidth: 2, r: window.innerWidth < 768 ? 3 : 4 }}
                activeDot={{ r: window.innerWidth < 768 ? 4 : 6, stroke: "#3b82f6", strokeWidth: 2 }}
                name="Net Profit"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}