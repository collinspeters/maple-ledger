// Financial reporting service with real-time sync for BookkeepAI
import { db } from "../db";
import { 
  transactions, 
  chartOfAccounts, 
  journalEntries, 
  journalEntryLines 
} from "@shared/schema";
import { eq, and, gte, lte, sql, isNull } from "drizzle-orm";

const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
};

interface ReportPeriod {
  startDate: Date;
  endDate: Date;
}

interface IncomeStatementData {
  revenue: {
    total: number;
    categories: Array<{
      account: string;
      amount: number;
      t2125Line?: string;
    }>;
  };
  expenses: {
    total: number;
    categories: Array<{
      account: string;
      amount: number;
      t2125Line?: string;
      deductionRate?: number;
      deductibleAmount?: number;
    }>;
  };
  grossProfit: number;
  netProfit: number;
}

interface BalanceSheetData {
  assets: {
    current: Array<{ account: string; balance: number; }>;
    fixed: Array<{ account: string; balance: number; }>;
    total: number;
  };
  liabilities: {
    current: Array<{ account: string; balance: number; }>;
    longTerm: Array<{ account: string; balance: number; }>;
    total: number;
  };
  equity: {
    accounts: Array<{ account: string; balance: number; }>;
    total: number;
  };
}

interface GSTHSTSummary {
  totalSales: number;
  taxableSales: number;
  exemptSales: number;
  zeroRatedSales: number;
  gstCollected: number;
  hstCollected: number;
  inputTaxCredits: number;
  netTaxOwing: number;
  period: ReportPeriod;
}

export class FinancialReportsService {

  /**
   * Generate Income Statement (P&L) with real-time data
   */
  async generateIncomeStatement(userId: string, period: ReportPeriod): Promise<IncomeStatementData> {
    // Get all posted journal entries for the period
    const journalData = await db
      .select({
        accountId: journalEntryLines.accountId,
        accountName: chartOfAccounts.name,
        accountCategory: chartOfAccounts.category,
        t2125Category: chartOfAccounts.t2125Category,
        deductionRate: chartOfAccounts.deductionRate,
        debitAmount: journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(
        eq(journalEntries.userId, userId),
        gte(journalEntries.date, period.startDate),
        lte(journalEntries.date, period.endDate),
        sql`${chartOfAccounts.category} IN ('REVENUE', 'EXPENSE')`
      ));

    // Calculate revenue (credits to revenue accounts)
    const revenueData = journalData
      .filter(entry => entry.accountCategory === 'REVENUE')
      .reduce((acc, entry) => {
        const amount = toNumber(entry.creditAmount) - toNumber(entry.debitAmount);
        const accountName = entry.accountName ?? "Uncategorized";
        const existing = acc.find(item => item.account === accountName);
        if (existing) {
          existing.amount += amount;
        } else {
          acc.push({
            account: accountName,
            amount,
            t2125Line: entry.t2125Category || undefined
          });
        }
        return acc;
      }, [] as Array<{ account: string; amount: number; t2125Line?: string; }>);

    // Calculate expenses (debits to expense accounts)
    const expenseData = journalData
      .filter(entry => entry.accountCategory === 'EXPENSE')
      .reduce((acc, entry) => {
        const amount = toNumber(entry.debitAmount) - toNumber(entry.creditAmount);
        const deductionRate = entry.deductionRate ? toNumber(entry.deductionRate) : 1;
        const deductibleAmount = amount * deductionRate;
        const accountName = entry.accountName ?? "Uncategorized";
        
        const existing = acc.find(item => item.account === accountName);
        if (existing) {
          existing.amount += amount;
          existing.deductibleAmount += deductibleAmount;
        } else {
          acc.push({
            account: accountName,
            amount,
            t2125Line: entry.t2125Category || undefined,
            deductionRate,
            deductibleAmount
          });
        }
        return acc;
      }, [] as Array<{ 
        account: string; 
        amount: number; 
        t2125Line?: string;
        deductionRate: number;
        deductibleAmount: number;
      }>);

    const totalRevenue = revenueData.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenseData.reduce((sum, item) => sum + item.deductibleAmount, 0);

    return {
      revenue: {
        total: totalRevenue,
        categories: revenueData
      },
      expenses: {
        total: totalExpenses,
        categories: expenseData
      },
      grossProfit: totalRevenue,
      netProfit: totalRevenue - totalExpenses
    };
  }

  /**
   * Generate Balance Sheet with real-time account balances
   */
  async generateBalanceSheet(userId: string, asOfDate: Date): Promise<BalanceSheetData> {
    // Get all accounts with their current balances
    const accounts = await db
      .select({
        name: chartOfAccounts.name,
        category: chartOfAccounts.category,
        subcategory: chartOfAccounts.subcategory,
        balance: chartOfAccounts.balance,
      })
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.userId, userId),
        eq(chartOfAccounts.isActive, true)
      ));

    // Group by balance sheet categories
    const assets = {
      current: accounts
        .filter(acc => acc.category === 'ASSET' && acc.subcategory === 'Current Assets')
        .map(acc => ({ account: acc.name, balance: toNumber(acc.balance) })),
      fixed: accounts
        .filter(acc => acc.category === 'ASSET' && acc.subcategory === 'Fixed Assets')
        .map(acc => ({ account: acc.name, balance: toNumber(acc.balance) })),
      total: 0
    };

    const liabilities = {
      current: accounts
        .filter(acc => acc.category === 'LIABILITY' && acc.subcategory === 'Current Liabilities')
        .map(acc => ({ account: acc.name, balance: toNumber(acc.balance) })),
      longTerm: accounts
        .filter(acc => acc.category === 'LIABILITY' && acc.subcategory === 'Long-term Liabilities')
        .map(acc => ({ account: acc.name, balance: toNumber(acc.balance) })),
      total: 0
    };

    const equity = {
      accounts: accounts
        .filter(acc => acc.category === 'EQUITY')
        .map(acc => ({ account: acc.name, balance: toNumber(acc.balance) })),
      total: 0
    };

    // Calculate totals
    assets.total = [...assets.current, ...assets.fixed].reduce((sum, acc) => sum + acc.balance, 0);
    liabilities.total = [...liabilities.current, ...liabilities.longTerm].reduce((sum, acc) => sum + acc.balance, 0);
    equity.total = equity.accounts.reduce((sum, acc) => sum + acc.balance, 0);

    return { assets, liabilities, equity };
  }

  /**
   * Generate GST/HST Summary for Canadian tax compliance
   */
  async generateGSTHSTSummary(userId: string, period: ReportPeriod): Promise<GSTHSTSummary> {
    // Get all revenue transactions in period
    const revenueTransactions = await db
      .select({
        amount: transactions.amount,
        taxable: chartOfAccounts.taxable,
        exempt: chartOfAccounts.exempt,
        zeroRated: chartOfAccounts.zeroRated,
        extractedTaxData: transactions.extractedTaxData,
      })
      .from(transactions)
      .leftJoin(chartOfAccounts, eq(transactions.category, chartOfAccounts.t2125Category))
      .where(and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isExpense, false),
        eq(transactions.isTransfer, false),
        gte(transactions.date, period.startDate),
        lte(transactions.date, period.endDate)
      ));

    // Get input tax credits from expense receipts
    const expenseTransactions = await db
      .select({
        amount: transactions.amount,
        extractedTaxData: transactions.extractedTaxData,
      })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isExpense, true),
        eq(transactions.isTransfer, false),
        gte(transactions.date, period.startDate),
        lte(transactions.date, period.endDate),
        sql`${transactions.extractedTaxData} IS NOT NULL`
      ));

    let totalSales = 0;
    let taxableSales = 0;
    let exemptSales = 0;
    let zeroRatedSales = 0;
    let gstCollected = 0;
    let hstCollected = 0;

    // Process revenue transactions
    revenueTransactions.forEach(tx => {
      const amount = toNumber(tx.amount);
      totalSales += amount;

      if (tx.zeroRated) {
        zeroRatedSales += amount;
      } else if (tx.exempt) {
        exemptSales += amount;
      } else if (tx.taxable) {
        taxableSales += amount;
        // Standard GST rate is 5%, HST varies by province
        gstCollected += amount * 0.05;
      }

      // Extract tax from OCR data if available
      if (tx.extractedTaxData) {
        const taxData = tx.extractedTaxData as any;
        if (taxData.gst) gstCollected += toNumber(taxData.gst);
        if (taxData.hst) hstCollected += toNumber(taxData.hst);
      }
    });

    // Calculate input tax credits
    let inputTaxCredits = 0;
    expenseTransactions.forEach(tx => {
      const taxData = tx.extractedTaxData as any;
      if (taxData?.gst) inputTaxCredits += toNumber(taxData.gst);
      if (taxData?.hst) inputTaxCredits += toNumber(taxData.hst);
      if (taxData?.pst) inputTaxCredits += toNumber(taxData.pst);
    });

    const netTaxOwing = (gstCollected + hstCollected) - inputTaxCredits;

    return {
      totalSales,
      taxableSales,
      exemptSales,
      zeroRatedSales,
      gstCollected,
      hstCollected,
      inputTaxCredits,
      netTaxOwing,
      period
    };
  }

  /**
   * Get expense breakdown with receipt matching status
   */
  async getExpenseBreakdown(userId: string, period: ReportPeriod) {
    const expenses = await db
      .select({
        category: transactions.aiCategory,
        amount: transactions.amount,
        description: transactions.description,
        receiptAttached: transactions.receiptAttached,
        isPosted: transactions.isPosted,
        date: transactions.date,
      })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isExpense, true),
        eq(transactions.isTransfer, false),
        gte(transactions.date, period.startDate),
        lte(transactions.date, period.endDate)
      ));

    // Group by category
    const breakdown = expenses.reduce((acc, expense) => {
      const category = expense.category || 'UNCATEGORIZED';
      if (!acc[category]) {
        acc[category] = {
          total: 0,
          count: 0,
          withReceipts: 0,
          posted: 0,
          transactions: []
        };
      }
      
      acc[category].total += toNumber(expense.amount);
      acc[category].count += 1;
      if (expense.receiptAttached) acc[category].withReceipts += 1;
      if (expense.isPosted) acc[category].posted += 1;
      acc[category].transactions.push(expense);
      
      return acc;
    }, {} as Record<string, any>);

    return Object.entries(breakdown).map(([category, data]) => ({
      category,
      ...data,
      receiptCoverage: data.withReceipts / data.count,
      postingStatus: data.posted / data.count
    }));
  }

  /**
   * Real-time dashboard summary
   */
  async getDashboardSummary(userId: string) {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);

    const [incomeStatement, balanceSheet, gstSummary, expenseBreakdown] = await Promise.all([
      this.generateIncomeStatement(userId, { startDate: yearStart, endDate: yearEnd }),
      this.generateBalanceSheet(userId, new Date()),
      this.generateGSTHSTSummary(userId, { startDate: yearStart, endDate: yearEnd }),
      this.getExpenseBreakdown(userId, { startDate: yearStart, endDate: yearEnd })
    ]);

    // Calculate posting status
    const totalTransactions = await db
      .select({ count: sql`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isTransfer, false)
      ));

    const postedTransactions = await db
      .select({ count: sql`count(*)` })
      .from(transactions)
      .where(and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.isTransfer, false),
        eq(transactions.isPosted, true)
      ));

    return {
      incomeStatement,
      balanceSheet,
      gstSummary,
      expenseBreakdown,
      postingStatus: {
        total: parseInt(totalTransactions[0].count as string),
        posted: parseInt(postedTransactions[0].count as string),
        percentage: parseInt(postedTransactions[0].count as string) / parseInt(totalTransactions[0].count as string)
      },
      lastUpdated: new Date()
    };
  }
}

export const financialReportsService = new FinancialReportsService();
