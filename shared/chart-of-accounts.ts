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
}

export const CHART_OF_ACCOUNTS: AccountType[] = [
  // ASSETS
  {
    id: 'cash-bank',
    name: 'Cash and Bank Accounts',
    category: 'ASSET',
    subcategory: 'Current Assets',
    code: '1000',
    description: 'Business chequing and savings accounts',
    isActive: true
  },
  {
    id: 'accounts-receivable',
    name: 'Accounts Receivable',
    category: 'ASSET',
    subcategory: 'Current Assets',
    code: '1200',
    description: 'Money owed by customers',
    isActive: true
  },
  {
    id: 'office-equipment',
    name: 'Office Equipment',
    category: 'ASSET',
    subcategory: 'Fixed Assets',
    code: '1500',
    description: 'Computers, furniture, and office equipment',
    isActive: true
  },

  // LIABILITIES
  {
    id: 'accounts-payable',
    name: 'Accounts Payable',
    category: 'LIABILITY',
    subcategory: 'Current Liabilities',
    code: '2000',
    description: 'Money owed to suppliers',
    isActive: true
  },
  {
    id: 'gst-hst-payable',
    name: 'GST/HST Payable',
    category: 'LIABILITY',
    subcategory: 'Current Liabilities',
    code: '2100',
    description: 'GST/HST collected on sales',
    isActive: true
  },

  // EQUITY
  {
    id: 'owners-equity',
    name: 'Owner\'s Equity',
    category: 'EQUITY',
    code: '3000',
    description: 'Owner\'s investment in the business',
    isActive: true
  },

  // REVENUE
  {
    id: 'business-income',
    name: 'Business Income',
    category: 'REVENUE',
    code: '4000',
    description: 'Income from business operations',
    t2125Category: 'BUSINESS_INCOME',
    isActive: true
  },
  {
    id: 'professional-income',
    name: 'Professional Income',
    category: 'REVENUE',
    code: '4100',
    description: 'Income from professional services',
    t2125Category: 'PROFESSIONAL_INCOME',
    isActive: true
  },

  // EXPENSES - T2125 Aligned
  {
    id: 'advertising',
    name: 'Advertising',
    category: 'EXPENSE',
    code: '5000',
    description: 'Marketing and promotional expenses',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'ADVERTISING',
    isActive: true
  },
  {
    id: 'meals-entertainment',
    name: 'Meals and Entertainment',
    category: 'EXPENSE',
    code: '5100',
    description: 'Business meals and entertainment expenses',
    isDeductible: true,
    deductionRate: 0.5, // Only 50% deductible
    t2125Category: 'MEALS_ENTERTAINMENT',
    isActive: true
  },
  {
    id: 'vehicle-expenses',
    name: 'Vehicle Expenses',
    category: 'EXPENSE',
    code: '5200',
    description: 'Vehicle operating expenses for business use',
    isDeductible: true,
    deductionRate: 1.0, // Prorated by business use percentage
    t2125Category: 'VEHICLE_EXPENSES',
    isActive: true
  },
  {
    id: 'office-expenses',
    name: 'Office Expenses',
    category: 'EXPENSE',
    code: '5300',
    description: 'Office supplies, stationery, and small equipment',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'OFFICE_EXPENSES',
    isActive: true
  },
  {
    id: 'professional-fees',
    name: 'Professional Fees',
    category: 'EXPENSE',
    code: '5400',
    description: 'Legal, accounting, and consulting fees',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'PROFESSIONAL_FEES',
    isActive: true
  },
  {
    id: 'telephone-utilities',
    name: 'Telephone and Utilities',
    category: 'EXPENSE',
    code: '5500',
    description: 'Business phone, internet, and utilities',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'TELEPHONE_UTILITIES',
    isActive: true
  },
  {
    id: 'travel',
    name: 'Travel',
    category: 'EXPENSE',
    code: '5600',
    description: 'Business travel expenses (excluding meals)',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'TRAVEL',
    isActive: true
  },
  {
    id: 'rent',
    name: 'Rent',
    category: 'EXPENSE',
    code: '5700',
    description: 'Office rent and leasing costs',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'RENT',
    isActive: true
  },
  {
    id: 'insurance',
    name: 'Insurance',
    category: 'EXPENSE',
    code: '5800',
    description: 'Business insurance premiums',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'INSURANCE',
    isActive: true
  },
  {
    id: 'interest-bank-charges',
    name: 'Interest and Bank Charges',
    category: 'EXPENSE',
    code: '5900',
    description: 'Bank fees, interest on business loans',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'INTEREST_BANK_CHARGES',
    isActive: true
  },
  {
    id: 'business-tax',
    name: 'Business Tax, Fees, Licences',
    category: 'EXPENSE',
    code: '6000',
    description: 'Business licenses, permits, and regulatory fees',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'BUSINESS_TAX',
    isActive: true
  },
  {
    id: 'maintenance-repairs',
    name: 'Maintenance and Repairs',
    category: 'EXPENSE',
    code: '6100',
    description: 'Maintenance and repair costs for business assets',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'MAINTENANCE_REPAIRS',
    isActive: true
  },
  {
    id: 'supplies',
    name: 'Supplies',
    category: 'EXPENSE',
    code: '6200',
    description: 'General business supplies and materials',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'SUPPLIES',
    isActive: true
  },
  {
    id: 'other-expenses',
    name: 'Other Expenses',
    category: 'EXPENSE',
    code: '6900',
    description: 'Other deductible business expenses',
    isDeductible: true,
    deductionRate: 1.0,
    t2125Category: 'OTHER_EXPENSES',
    isActive: true
  }
];

// Helper functions
export function getAccountByCode(code: string): AccountType | undefined {
  return CHART_OF_ACCOUNTS.find(account => account.code === code);
}

export function getAccountById(id: string): AccountType | undefined {
  return CHART_OF_ACCOUNTS.find(account => account.id === id);
}

export function getAccountsByCategory(category: AccountType['category']): AccountType[] {
  return CHART_OF_ACCOUNTS.filter(account => account.category === category && account.isActive);
}

export function getExpenseAccounts(): AccountType[] {
  return getAccountsByCategory('EXPENSE');
}

export function getRevenueAccounts(): AccountType[] {
  return getAccountsByCategory('REVENUE');
}

export function getAssetAccounts(): AccountType[] {
  return getAccountsByCategory('ASSET');
}

export function getLiabilityAccounts(): AccountType[] {
  return getAccountsByCategory('LIABILITY');
}

export function getEquityAccounts(): AccountType[] {
  return getAccountsByCategory('EQUITY');
}

export function mapT2125CategoryToAccount(t2125Category: string): AccountType | undefined {
  return CHART_OF_ACCOUNTS.find(account => account.t2125Category === t2125Category);
}

export function calculateDeductibleAmount(amount: number, accountId: string): number {
  const account = getAccountById(accountId);
  if (!account || !account.isDeductible) return 0;
  return amount * (account.deductionRate || 1.0);
}

// Validation schema
export const accountSchema = z.object({
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
  parentId: z.string().optional()
});

export type InsertAccount = z.infer<typeof accountSchema>;