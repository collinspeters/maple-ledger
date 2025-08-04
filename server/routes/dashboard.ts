// Simple dashboard API endpoint for real-time reporting
import { Request, Response } from "express";
import { storage } from "../storage";

export async function getDashboardData(req: Request, res: Response) {
  try {
    const user = req.user as any;
    
    // Get basic transaction metrics for now
    const transactions = await storage.getTransactions(user.id);
    
    const revenue = transactions
      .filter(t => !t.isTransfer && !t.isExpense)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const expenses = transactions
      .filter(t => !t.isTransfer && t.isExpense)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const postedCount = transactions.filter(t => t.isPosted).length;
    const totalCount = transactions.filter(t => !t.isTransfer).length;

    // Group expenses by category
    const expenseBreakdown = transactions
      .filter(t => t.isExpense && !t.isTransfer)
      .reduce((acc, t) => {
        const category = t.aiCategory || 'UNCATEGORIZED';
        if (!acc[category]) {
          acc[category] = { total: 0, count: 0, withReceipts: 0, posted: 0 };
        }
        acc[category].total += parseFloat(t.amount);
        acc[category].count += 1;
        if (t.receiptAttached) acc[category].withReceipts += 1;
        if (t.isPosted) acc[category].posted += 1;
        return acc;
      }, {} as Record<string, any>);

    const formattedBreakdown = Object.entries(expenseBreakdown).map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      withReceipts: data.withReceipts,
      receiptCoverage: data.withReceipts / data.count,
      postingStatus: data.posted / data.count
    }));
    
    const dashboardData = {
      incomeStatement: {
        revenue: { total: revenue, categories: [] },
        expenses: { total: expenses, categories: [] },
        netProfit: revenue - expenses
      },
      balanceSheet: {
        assets: { total: 25000 },
        liabilities: { total: 5000 },
        equity: { total: 20000 }
      },
      gstSummary: {
        totalSales: revenue,
        taxableSales: revenue * 0.9,
        gstCollected: revenue * 0.05,
        inputTaxCredits: expenses * 0.05,
        netTaxOwing: (revenue * 0.05) - (expenses * 0.05)
      },
      expenseBreakdown: formattedBreakdown,
      postingStatus: {
        total: totalCount,
        posted: postedCount,
        percentage: totalCount > 0 ? postedCount / totalCount : 0
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(dashboardData);
  } catch (error) {
    console.error("Error generating dashboard summary:", error);
    res.status(500).json({ message: "Failed to generate dashboard summary" });
  }
}