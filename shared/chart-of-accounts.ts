// Chart of Accounts for Canadian sole proprietors (T2125 compliant)
import { z } from "zod";

export interface AccountType {
  id: string;
  name: string;
  category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subcategory?: string;
  code: string;
  description: string;
  isDeductible?: boolean;
  deductionRate?: number; // For partial deductions like meals (50%)
  t2125Category?: string; // Maps to T2125 tax form categories
  isActive: boolean;
  parentId?: string; // For sub-accounts
  isBankAccount: boolean; // Whether this is a linked bank account
  bankConnectionId?: string; // Links to bank connection
  plaidAccountId?: string; // Plaid account identifier
  taxSettings: {
    taxable: boolean;
    exempt: boolean;
    zeroRated: boolean;
  };
  balance?: number; // Current account balance
}

// Helper function to create account with defaults
function createAccount(account: Omit<AccountType, 'isBankAccount' | 'taxSettings'> & Partial<Pick<AccountType, 'isBankAccount' | 'taxSettings'>>): AccountType {
  return {
    ...account,
    isBankAccount: account.isBankAccount ?? false,
    taxSettings: account.taxSettings ?? { taxable: false, exempt: true, zeroRated: false }
  };
}

export const CHART_OF_ACCOUNTS: AccountType[] = [
  // ASSETS - Bank Accounts (will be dynamically populated from bank connections)
  createAccount({
    id: 'cash-bank',
    name: 'Cash and Bank Accounts',
    category: 'ASSET',
    subcategory: 'Current Assets',
    code: '1000',
    description: 'Business chequing and savings accounts',
    isActive: true
  }),
  createAccount({
    id: 'accounts-receivable',
    name: 'Accounts Receivable',
    category: 'ASSET',
    subcategory: 'Current Assets',
    code: '1200',
    description: 'Money owed by customers',
    isActive: true
  }),
  createAccount({
    id: 'office-equipment',
    name: 'Office Equipment',
    category: 'ASSET',
    subcategory: 'Fixed Assets',
    code: '1500',
    description: 'Computers, furniture, and office equipment',
    isActive: true
  }),

  // LIABILITIES
  createAccount({
    id: 'accounts-payable',
    name: 'Accounts Payable',
    category: 'LIABILITY',
    subcategory: 'Current Liabilities',
    code: '2000',
    description: 'Money owed to suppliers',
    isActive: true
  }),
  createAccount({
    id: 'credit-cards',
    name: 'Business Credit Cards',
    category: 'LIABILITY',
    subcategory: 'Current Liabilities',
    code: '2100',
    description: 'Business credit card balances',
    isActive: true,
    isBankAccount: true
  }),

  // EQUITY
  createAccount({
    id: 'owner-equity',
    name: 'Owner\'s Equity',
    category: 'EQUITY',
    code: '3000',
    description: 'Owner investment and retained earnings',
    isActive: true
  }),

  // REVENUE
  createAccount({
    id: 'business-income',
    name: 'Business Income',
    category: 'REVENUE',
    code: '4000',
    description: 'Revenue from business operations',
    t2125Category: 'BUSINESS_INCOME',
    isActive: true
  }),
  createAccount({
    id: 'professional-income',
    name: 'Professional Income',
    category: 'REVENUE',
    code: '4100',
    description: 'Professional services revenue',
    t2125Category: 'PROFESSIONAL_INCOME',
    isActive: true
  }),

  // EXPENSES - T2125 Categories
  createAccount({
    id: 'meals-entertainment',
    name: 'Meals and Entertainment',
    category: 'EXPENSE',
    code: '5040',
    description: 'Business meals and entertainment (50% deductible)',
    isDeductible: true,
    deductionRate: 0.50,
    t2125Category: 'MEALS_ENTERTAINMENT',
    isActive: true
  }),
  createAccount({
    id: 'vehicle-expenses',
    name: 'Vehicle Expenses',
    category: 'EXPENSE',
    code: '5080',
    description: 'Vehicle fuel, maintenance, and related costs',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'VEHICLE_EXPENSES',
    isActive: true
  }),
  createAccount({
    id: 'office-expenses',
    name: 'Office Expenses',
    category: 'EXPENSE',
    code: '5060',
    description: 'Office supplies, stationery, and small equipment',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'OFFICE_EXPENSES',
    isActive: true
  }),
  createAccount({
    id: 'telephone-utilities',
    name: 'Telephone and Utilities',
    category: 'EXPENSE',
    code: '5120',
    description: 'Business phone, internet, and utility costs',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'TELEPHONE_UTILITIES',
    isActive: true
  }),
  createAccount({
    id: 'professional-fees',
    name: 'Professional Fees',
    category: 'EXPENSE',
    code: '5070',
    description: 'Legal, accounting, and consulting fees',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'PROFESSIONAL_FEES',
    isActive: true
  }),
  createAccount({
    id: 'travel',
    name: 'Travel Expenses',
    category: 'EXPENSE',
    code: '5130',
    description: 'Business travel costs (excluding meals)',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'TRAVEL',
    isActive: true
  }),
  createAccount({
    id: 'insurance',
    name: 'Insurance',
    category: 'EXPENSE',
    code: '5030',
    description: 'Business insurance premiums',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'INSURANCE',
    isActive: true
  }),
  createAccount({
    id: 'interest-bank-charges',
    name: 'Interest and Bank Charges',
    category: 'EXPENSE',
    code: '5035',
    description: 'Bank fees, interest, and financial charges',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'INTEREST_BANK_CHARGES',
    isActive: true
  }),
  createAccount({
    id: 'maintenance-repairs',
    name: 'Maintenance and Repairs',
    category: 'EXPENSE',
    code: '5050',
    description: 'Equipment and facility maintenance',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'MAINTENANCE_REPAIRS',
    isActive: true
  }),
  createAccount({
    id: 'rent',
    name: 'Rent',
    category: 'EXPENSE',
    code: '5090',
    description: 'Office and equipment rental costs',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'RENT',
    isActive: true
  }),
  createAccount({
    id: 'business-tax',
    name: 'Business Tax, Fees, Licenses',
    category: 'EXPENSE',
    code: '5110',
    description: 'Business licenses, permits, and taxes',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'BUSINESS_TAX',
    isActive: true
  }),
  createAccount({
    id: 'subcontracts',
    name: 'Subcontracts',
    category: 'EXPENSE',
    code: '5100',
    description: 'Payments to subcontractors',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'SUBCONTRACTS',
    isActive: true
  }),
  createAccount({
    id: 'other-expenses',
    name: 'Other Expenses',
    category: 'EXPENSE',
    code: '5999',
    description: 'Other deductible business expenses',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'OTHER_EXPENSES',
    isActive: true
  })
];

// T2125 category mappings for validation
export const T2125_CATEGORIES = {
  // Revenue
  BUSINESS_INCOME: 'Business Income',
  PROFESSIONAL_INCOME: 'Professional Income',
  
  // Expenses
  MEALS_ENTERTAINMENT: 'Meals and Entertainment',
  VEHICLE_EXPENSES: 'Vehicle Expenses', 
  OFFICE_EXPENSES: 'Office Expenses',
  TELEPHONE_UTILITIES: 'Telephone and Utilities',
  PROFESSIONAL_FEES: 'Professional Fees',
  TRAVEL: 'Travel',
  INSURANCE: 'Insurance',
  INTEREST_BANK_CHARGES: 'Interest and Bank Charges',
  MAINTENANCE_REPAIRS: 'Maintenance and Repairs',
  RENT: 'Rent',
  BUSINESS_TAX: 'Business Tax, Fees, Licenses',
  SUBCONTRACTS: 'Subcontracts',
  OTHER_EXPENSES: 'Other Expenses'
} as const;

export type T2125Category = keyof typeof T2125_CATEGORIES;

// Validation schema
export const AccountTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  subcategory: z.string().optional(),
  code: z.string(),
  description: z.string(),
  isDeductible: z.boolean().optional(),
  deductionRate: z.number().min(0).max(1).optional(),
  t2125Category: z.string().optional(),
  isActive: z.boolean(),
  parentId: z.string().optional(),
  isBankAccount: z.boolean(),
  bankConnectionId: z.string().optional(),
  plaidAccountId: z.string().optional(),
  taxSettings: z.object({
    taxable: z.boolean(),
    exempt: z.boolean(),
    zeroRated: z.boolean()
  }),
  balance: z.number().optional()
});

// Helper function to get account by T2125 category
export function findAccountByT2125Category(category: string): AccountType | undefined {
  return CHART_OF_ACCOUNTS.find(account => account.t2125Category === category);
}

// Helper function to get bank accounts only
export function getBankAccounts(): AccountType[] {
  return CHART_OF_ACCOUNTS.filter(account => account.isBankAccount);
}

// Helper function to get expense accounts only
export function getExpenseAccounts(): AccountType[] {
  return CHART_OF_ACCOUNTS.filter(account => account.category === 'EXPENSE');
}