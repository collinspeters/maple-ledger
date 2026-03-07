import { db } from '../db';
import { transactions } from '@shared/schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { T2125_CATEGORIES, getExpenseCategories, getIncomeCategories, type T2125Category } from '@shared/t2125-categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface T2125LineItem {
  code: string;
  lineNumber: string;
  name: string;
  description: string;
  isFullyDeductible: boolean;
  notes?: string;
  grossAmount: number;
  deductibleAmount: number;
  transactionCount: number;
  currency: 'CAD';
}

export interface T2125Section {
  label: string;
  items: T2125LineItem[];
  total: number;
}

export interface T2125Report {
  taxYear: number;
  period: { startDate: string; endDate: string };
  grossIncome: T2125Section;
  expenses: T2125Section;
  totalDeductibleExpenses: number;
  netBusinessIncome: number;
  unmappedExpenses: { description: string; amount: number; category: string | null }[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Currency normalisation
// ---------------------------------------------------------------------------

/** Exchange rates TO CAD (hardcoded reasonable approximations for tax year). */
const EXCHANGE_RATES_TO_CAD: Record<string, number> = {
  CAD: 1.00,
  USD: 1.35,
  EUR: 1.46,
  GBP: 1.71,
  MXN: 0.079,
  AUD: 0.88,
};

/**
 * Normalise an amount to CAD.
 * Falls back to 1.35 (USD→CAD) if currency is unknown.
 */
export function normaliseToCad(amount: number, currency?: string | null): number {
  const cur = (currency || 'CAD').toUpperCase();
  const rate = EXCHANGE_RATES_TO_CAD[cur] ?? EXCHANGE_RATES_TO_CAD['USD'];
  return Math.round(amount * rate * 100) / 100;
}

// ---------------------------------------------------------------------------
// Deductibility rates
// ---------------------------------------------------------------------------

/** Returns the deductible fraction for a T2125 category (0–1). */
export function deductibleRate(code: string): number {
  const partiallyDeductible: Record<string, number> = {
    MEALS_ENTERTAINMENT: 0.50,  // CRA: 50%
    VEHICLE_EXPENSES: 0.80,     // typical business-use percentage
  };
  return partiallyDeductible[code] ?? 1.00;
}

// ---------------------------------------------------------------------------
// Mapping helper
// ---------------------------------------------------------------------------

/**
 * Map a raw transaction category code to a T2125 category code.
 * Handles both direct matches and common aliases.
 */
export function mapToT2125Code(rawCategory: string | null | undefined): string {
  if (!rawCategory) return 'OTHER_EXPENSES';

  const upper = rawCategory.toUpperCase().replace(/-/g, '_');

  // Direct match
  const direct = T2125_CATEGORIES.find(c => c.code === upper);
  if (direct) return direct.code;

  // Alias map
  const aliases: Record<string, string> = {
    'FOOD': 'MEALS_ENTERTAINMENT',
    'COFFEE': 'MEALS_ENTERTAINMENT',
    'DINING': 'MEALS_ENTERTAINMENT',
    'SHIPPING': 'DELIVERY_FREIGHT',
    'COURIER': 'DELIVERY_FREIGHT',
    'SOFTWARE': 'OFFICE_EXPENSES',
    'SUBSCRIPTIONS': 'OFFICE_EXPENSES',
    'HARDWARE': 'OFFICE_EXPENSES',
    'UTILITIES': 'TELEPHONE_UTILITIES',
    'INTERNET': 'TELEPHONE_UTILITIES',
    'PHONE': 'TELEPHONE_UTILITIES',
    'LEGAL': 'PROFESSIONAL_FEES',
    'ACCOUNTING': 'PROFESSIONAL_FEES',
    'GAS': 'VEHICLE_EXPENSES',
    'FUEL': 'VEHICLE_EXPENSES',
    'PARKING': 'VEHICLE_EXPENSES',
    'PROMOTION': 'ADVERTISING',
    'MARKETING': 'ADVERTISING',
    'BANK_FEE': 'INTEREST_BANK_CHARGES',
    'SERVICE_CHARGE': 'INTEREST_BANK_CHARGES',
    'TAX': 'BUSINESS_TAX',
    'LICENCE': 'BUSINESS_TAX',
    'SALARY': 'SALARIES_WAGES',
    'PAYROLL': 'SALARIES_WAGES',
    'CONTRACTOR': 'SUBCONTRACTS',
    'FREELANCE': 'SUBCONTRACTS',
    'REPAIR': 'MAINTENANCE_REPAIRS',
    'MAINTENANCE': 'MAINTENANCE_REPAIRS',
    'INCOME': 'BUSINESS_INCOME',
    'REVENUE': 'BUSINESS_INCOME',
    'INVOICE': 'BUSINESS_INCOME',
    'PAYMENT_RECEIVED': 'BUSINESS_INCOME',
  };

  for (const [alias, code] of Object.entries(aliases)) {
    if (upper.includes(alias)) return code;
  }

  return 'OTHER_EXPENSES';
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

/**
 * Aggregate the user's transactions into a CRA T2125 report.
 */
export async function generateT2125Report(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<T2125Report> {
  const taxYear = startDate.getFullYear();

  // Fetch all non-transfer transactions in the period
  const rows = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    );

  // Build accumulators keyed by T2125 code
  const expenseAccum: Record<string, { gross: number; count: number }> = {};
  const incomeAccum: Record<string, { gross: number; count: number }> = {};
  const unmapped: { description: string; amount: number; category: string | null }[] = [];

  for (const txn of rows) {
    if (txn.isTransfer) continue;

    const rawCat = txn.category || txn.aiCategory;
    const t2125Code = mapToT2125Code(rawCat);
    const isIncomeCategory = ['BUSINESS_INCOME', 'PROFESSIONAL_INCOME'].includes(t2125Code);

    // Normalise to CAD — transactions stored in CAD by default
    const amountCad = normaliseToCad(parseFloat(txn.amount), 'CAD');

    if (!txn.isExpense || isIncomeCategory) {
      // Income side
      const iCode = isIncomeCategory ? t2125Code : 'BUSINESS_INCOME';
      if (!incomeAccum[iCode]) incomeAccum[iCode] = { gross: 0, count: 0 };
      incomeAccum[iCode].gross += amountCad;
      incomeAccum[iCode].count++;
    } else {
      // Expense side
      if (!expenseAccum[t2125Code]) expenseAccum[t2125Code] = { gross: 0, count: 0 };
      expenseAccum[t2125Code].gross += amountCad;
      expenseAccum[t2125Code].count++;

      // Collect truly unmapped items (mapped to OTHER_EXPENSES but had no category)
      if (t2125Code === 'OTHER_EXPENSES' && !rawCat) {
        unmapped.push({
          description: txn.description,
          amount: amountCad,
          category: rawCat || null,
        });
      }
    }
  }

  // Build income section
  const incomeCategories = getIncomeCategories();
  const incomeItems: T2125LineItem[] = incomeCategories
    .filter(cat => incomeAccum[cat.code])
    .map(cat => {
      const acc = incomeAccum[cat.code];
      return {
        code: cat.code,
        lineNumber: cat.lineNumber,
        name: cat.name,
        description: cat.description,
        isFullyDeductible: false,
        notes: cat.notes,
        grossAmount: Math.round(acc.gross * 100) / 100,
        deductibleAmount: Math.round(acc.gross * 100) / 100,
        transactionCount: acc.count,
        currency: 'CAD' as const,
      };
    });

  const totalIncome = incomeItems.reduce((s, i) => s + i.grossAmount, 0);

  // Build expense section
  const expenseCategories = getExpenseCategories();
  const expenseItems: T2125LineItem[] = expenseCategories
    .filter(cat => expenseAccum[cat.code])
    .map(cat => {
      const acc = expenseAccum[cat.code];
      const rate = deductibleRate(cat.code);
      const gross = Math.round(acc.gross * 100) / 100;
      const deductible = Math.round(gross * rate * 100) / 100;
      return {
        code: cat.code,
        lineNumber: cat.lineNumber,
        name: cat.name,
        description: cat.description,
        isFullyDeductible: cat.isFullyDeductible,
        notes: cat.notes,
        grossAmount: gross,
        deductibleAmount: deductible,
        transactionCount: acc.count,
        currency: 'CAD' as const,
      };
    })
    // Sort by line number ascending
    .sort((a, b) => parseInt(a.lineNumber) - parseInt(b.lineNumber));

  const totalDeductible = expenseItems.reduce((s, i) => s + i.deductibleAmount, 0);

  return {
    taxYear,
    period: {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    },
    grossIncome: {
      label: 'Business Income',
      items: incomeItems,
      total: Math.round(totalIncome * 100) / 100,
    },
    expenses: {
      label: 'Business Expenses',
      items: expenseItems,
      total: Math.round(expenseItems.reduce((s, i) => s + i.grossAmount, 0) * 100) / 100,
    },
    totalDeductibleExpenses: Math.round(totalDeductible * 100) / 100,
    netBusinessIncome: Math.round((totalIncome - totalDeductible) * 100) / 100,
    unmappedExpenses: unmapped,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

/** Render T2125 report as a CSV string suitable for tax software import. */
export function reportToCSV(report: T2125Report): string {
  const lines: string[] = [];
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

  lines.push('CRA T2125 Statement of Business or Professional Activities');
  lines.push(`Tax Year,${report.taxYear}`);
  lines.push(`Period,${report.period.startDate} to ${report.period.endDate}`);
  lines.push(`Generated At,${report.generatedAt}`);
  lines.push('');

  // Income
  lines.push('INCOME');
  lines.push('Line Number,Category,Description,Gross Amount (CAD),Transactions');
  for (const item of report.grossIncome.items) {
    lines.push([
      esc(item.lineNumber),
      esc(item.name),
      esc(item.description),
      esc(item.grossAmount.toFixed(2)),
      esc(item.transactionCount),
    ].join(','));
  }
  lines.push(`,,Total Gross Income,${report.grossIncome.total.toFixed(2)},`);
  lines.push('');

  // Expenses
  lines.push('EXPENSES');
  lines.push('Line Number,Category,Description,Gross Amount (CAD),Deductible Amount (CAD),Deductible %,Transactions,Notes');
  for (const item of report.expenses.items) {
    const pct = item.grossAmount > 0
      ? Math.round((item.deductibleAmount / item.grossAmount) * 100)
      : 100;
    lines.push([
      esc(item.lineNumber),
      esc(item.name),
      esc(item.description),
      esc(item.grossAmount.toFixed(2)),
      esc(item.deductibleAmount.toFixed(2)),
      esc(`${pct}%`),
      esc(item.transactionCount),
      esc(item.notes || ''),
    ].join(','));
  }
  lines.push(`,,Total Expenses,${report.expenses.total.toFixed(2)},${report.totalDeductibleExpenses.toFixed(2)},,,`);
  lines.push('');

  lines.push('SUMMARY');
  lines.push(`Gross Income,,${report.grossIncome.total.toFixed(2)}`);
  lines.push(`Total Deductible Expenses,,${report.totalDeductibleExpenses.toFixed(2)}`);
  lines.push(`Net Business Income,,${report.netBusinessIncome.toFixed(2)}`);

  return lines.join('\n');
}
