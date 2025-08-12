import { storage } from "../storage";
import { sql } from "drizzle-orm";

export interface ProfitLossReport {
  revenue: {
    total: number;
    categories: Array<{ category: string; amount: number; }>;
  };
  expenses: {
    total: number;
    categories: Array<{ category: string; amount: number; }>;
  };
  grossProfit: number;
  netProfit: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface BalanceSheetReport {
  assets: {
    total: number;
    current: Array<{ account: string; amount: number; }>;
    fixed: Array<{ account: string; amount: number; }>;
  };
  liabilities: {
    total: number;
    current: Array<{ account: string; amount: number; }>;
    longTerm: Array<{ account: string; amount: number; }>;
  };
  equity: {
    total: number;
    ownersEquity: number;
    retainedEarnings: number;
  };
  asOfDate: string;
}

export interface TaxSummaryReport {
  taxCollected: number;
  taxPaid: number;
  netTaxOwing: number;
  gstHstBreakdown: Array<{
    province: string;
    rate: number;
    collected: number;
    paid: number;
    net: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface TrialBalanceReport {
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
}

export interface GeneralLedgerReport {
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
}

export async function generateProfitLossReport(
  userId: string, 
  startDate: Date, 
  endDate: Date
): Promise<ProfitLossReport> {
  console.log(`Generating P&L report for user ${userId} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const transactions = await storage.getTransactionsByDateRange(userId, startDate, endDate);
  console.log(`Found ${transactions.length} transactions for P&L report`);
  
  // Separate revenue and expenses
  const revenueTransactions = transactions.filter(t => !t.isExpense);
  const expenseTransactions = transactions.filter(t => t.isExpense);
  
  console.log(`Revenue transactions: ${revenueTransactions.length}, Expense transactions: ${expenseTransactions.length}`);
  
  const revenue = revenueTransactions
    .reduce((acc, t) => acc + parseFloat(t.amount), 0);
    
  const expenses = expenseTransactions
    .reduce((acc, t) => acc + parseFloat(t.amount), 0);

  // Group by categories
  const revenueCategories = new Map<string, number>();
  const expenseCategories = new Map<string, number>();

  transactions.forEach(t => {
    // Use aiCategory if available, fallback to category
    const category = t.aiCategory || t.category || 'Uncategorized';
    const amount = parseFloat(t.amount);
    
    if (t.isExpense) {
      expenseCategories.set(category, (expenseCategories.get(category) || 0) + amount);
    } else {
      revenueCategories.set(category, (revenueCategories.get(category) || 0) + amount);
    }
  });

  const report = {
    revenue: {
      total: revenue,
      categories: Array.from(revenueCategories.entries()).map(([category, amount]) => ({
        category,
        amount
      }))
    },
    expenses: {
      total: expenses,
      categories: Array.from(expenseCategories.entries()).map(([category, amount]) => ({
        category,
        amount
      }))
    },
    grossProfit: revenue,
    netProfit: revenue - expenses,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  };
  
  console.log(`P&L Report generated:`, {
    revenue: revenue,
    expenses: expenses,
    netProfit: revenue - expenses,
    revenueCategories: revenueCategories.size,
    expenseCategories: expenseCategories.size
  });
  
  return report;
}

export async function generateBalanceSheetReport(
  userId: string, 
  asOfDate: Date
): Promise<BalanceSheetReport> {
  // For a sole proprietorship, the balance sheet is simplified
  // We'll calculate from transaction history up to the date
  
  const allTransactions = await storage.getTransactionsByDateRange(
    userId, 
    new Date('2000-01-01'), // Beginning of time
    asOfDate
  );

  // Calculate retained earnings (cumulative net income)
  const totalRevenue = allTransactions
    .filter(t => !t.isExpense)
    .reduce((acc, t) => acc + parseFloat(t.amount), 0);
    
  const totalExpenses = allTransactions
    .filter(t => t.isExpense)
    .reduce((acc, t) => acc + parseFloat(t.amount), 0);

  const retainedEarnings = totalRevenue - totalExpenses;

  // For sole proprietorship, assets primarily come from cash and accounts receivable
  // Liabilities from accounts payable and loans
  // This is a simplified implementation - in practice, you'd have a chart of accounts

  const assets = {
    total: Math.max(retainedEarnings, 0), // Simplified: positive equity suggests assets
    current: [
      { account: 'Cash and Bank Accounts', amount: Math.max(retainedEarnings * 0.8, 0) },
      { account: 'Accounts Receivable', amount: Math.max(retainedEarnings * 0.2, 0) }
    ],
    fixed: []
  };

  const liabilities = {
    total: Math.max(-retainedEarnings, 0), // Simplified: negative equity suggests liabilities
    current: [
      { account: 'Accounts Payable', amount: Math.max(-retainedEarnings * 0.6, 0) }
    ],
    longTerm: [
      { account: 'Long-term Debt', amount: Math.max(-retainedEarnings * 0.4, 0) }
    ]
  };

  return {
    assets,
    liabilities,
    equity: {
      total: retainedEarnings,
      ownersEquity: 0, // For sole proprietorship, this would be initial capital
      retainedEarnings
    },
    asOfDate: asOfDate.toISOString().split('T')[0]
  };
}

export async function generateTaxSummaryReport(
  userId: string, 
  startDate: Date, 
  endDate: Date
): Promise<TaxSummaryReport> {
  const transactions = await storage.getTransactionsByDateRange(userId, startDate, endDate);
  
  // Calculate tax collected on sales (HST/GST charged to customers)
  const taxCollected = transactions
    .filter(t => !t.isExpense && t.extractedTaxData)
    .reduce((acc, t) => {
      const taxData = t.extractedTaxData as any;
      return acc + (parseFloat(taxData?.tax || '0'));
    }, 0);

  // Calculate tax paid on purchases (HST/GST paid to suppliers - Input Tax Credits)
  const taxPaid = transactions
    .filter(t => t.isExpense && t.extractedTaxData)
    .reduce((acc, t) => {
      const taxData = t.extractedTaxData as any;
      return acc + (parseFloat(taxData?.tax || '0'));
    }, 0);

  // For Canadian businesses, assume HST/GST rates by province
  const provincialBreakdown = [
    {
      province: 'Ontario',
      rate: 13, // HST
      collected: taxCollected * 0.8, // Assume most business in Ontario
      paid: taxPaid * 0.8,
      net: (taxCollected - taxPaid) * 0.8
    },
    {
      province: 'Other Provinces',
      rate: 5, // GST only
      collected: taxCollected * 0.2,
      paid: taxPaid * 0.2,
      net: (taxCollected - taxPaid) * 0.2
    }
  ];

  return {
    taxCollected,
    taxPaid,
    netTaxOwing: taxCollected - taxPaid,
    gstHstBreakdown: provincialBreakdown,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  };
}

export async function generateTrialBalanceReport(
  userId: string, 
  asOfDate: Date
): Promise<TrialBalanceReport> {
  const transactions = await storage.getTransactionsByDateRange(
    userId, 
    new Date('2000-01-01'), 
    asOfDate
  );

  // Group transactions by account/category and create proper accounting entries
  const accountBalances = new Map<string, { debit: number; credit: number; type: string }>();

  // Initialize Owner's Equity account (for balancing manual transactions)
  accountBalances.set("Owner's Equity", { 
    debit: 0, 
    credit: 0, 
    type: 'equity'
  });

  // Initialize Cash account (for balancing all transactions)
  accountBalances.set("Cash", { 
    debit: 0, 
    credit: 0, 
    type: 'asset'
  });

  transactions.forEach(transaction => {
    const account = transaction.category || 'Uncategorized';
    const amount = parseFloat(transaction.amount);
    
    // Create account if it doesn't exist
    if (!accountBalances.has(account)) {
      accountBalances.set(account, { 
        debit: 0, 
        credit: 0, 
        type: transaction.isExpense ? 'expense' : 'revenue'
      });
    }

    const accountData = accountBalances.get(account)!;
    const cashAccount = accountBalances.get("Cash")!;
    const equityAccount = accountBalances.get("Owner's Equity")!;
    
    if (transaction.isExpense) {
      // Expense Transaction: Debit Expense, Credit Cash (or Credit Owner's Equity for manual entries)
      accountData.debit += amount;
      
      // For manual transactions without a funding source, balance with Owner's Equity
      if (!transaction.bankTransactionId) {
        equityAccount.credit += amount; // Owner funded the expense
      } else {
        cashAccount.credit += amount; // Cash was used for the expense
      }
    } else {
      // Revenue Transaction: Debit Cash, Credit Revenue
      accountData.credit += amount;
      cashAccount.debit += amount;
    }
  });

  const accounts = Array.from(accountBalances.entries())
    .filter(([_, data]) => data.debit !== 0 || data.credit !== 0) // Only show accounts with balances
    .map(([accountName, data]) => ({
      accountName,
      accountType: data.type as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
      debit: data.debit,
      credit: data.credit
    }));

  const totalDebits = accounts.reduce((sum, acc) => sum + acc.debit, 0);
  const totalCredits = accounts.reduce((sum, acc) => sum + acc.credit, 0);

  return {
    accounts,
    totalDebits,
    totalCredits,
    isBalanced: Math.abs(totalDebits - totalCredits) < 0.01, // Allow for rounding differences
    asOfDate: asOfDate.toISOString().split('T')[0]
  };
}

export async function generateGeneralLedgerReport(
  userId: string, 
  startDate: Date, 
  endDate: Date
): Promise<GeneralLedgerReport> {
  const transactions = await storage.getTransactionsByDateRange(userId, startDate, endDate);
  
  // Group transactions by account
  const accountGroups = new Map<string, any[]>();
  
  transactions.forEach(transaction => {
    const account = transaction.category || 'Uncategorized';
    if (!accountGroups.has(account)) {
      accountGroups.set(account, []);
    }
    accountGroups.get(account)!.push(transaction);
  });

  const accounts = Array.from(accountGroups.entries()).map(([accountName, accountTransactions]) => {
    let runningBalance = 0;
    
    // Sort transactions by date
    const sortedTransactions = accountTransactions.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const transactions = sortedTransactions.map(transaction => {
      const amount = parseFloat(transaction.amount);
      const isDebit = transaction.isExpense;
      
      // Update running balance
      if (isDebit) {
        runningBalance += amount;
      } else {
        runningBalance -= amount; // Revenue decreases the balance for expense accounts
      }

      return {
        date: new Date(transaction.date).toISOString().split('T')[0],
        description: transaction.description,
        reference: transaction.id.substring(0, 8), // Short reference
        debit: isDebit ? amount : 0,
        credit: !isDebit ? amount : 0,
        balance: runningBalance
      };
    });

    return {
      accountName,
      accountType: accountTransactions[0]?.isExpense ? 'expense' : 'revenue',
      transactions,
      beginningBalance: 0, // Would need to calculate from before start date
      endingBalance: runningBalance
    };
  });

  return {
    accounts: accounts.sort((a, b) => a.accountName.localeCompare(b.accountName)),
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  };
}

// Utility function to get common date ranges
export function getDateRanges() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return {
    thisMonth: {
      start: new Date(currentYear, currentMonth, 1),
      end: new Date(currentYear, currentMonth + 1, 0)
    },
    lastMonth: {
      start: new Date(currentYear, currentMonth - 1, 1),
      end: new Date(currentYear, currentMonth, 0)
    },
    thisQuarter: {
      start: new Date(currentYear, Math.floor(currentMonth / 3) * 3, 1),
      end: new Date(currentYear, Math.floor(currentMonth / 3) * 3 + 3, 0)
    },
    thisYear: {
      start: new Date(currentYear, 0, 1),
      end: new Date(currentYear, 11, 31)
    },
    lastYear: {
      start: new Date(currentYear - 1, 0, 1),
      end: new Date(currentYear - 1, 11, 31)
    }
  };
}