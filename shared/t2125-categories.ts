// Official Canadian T2125 Statement of Business or Professional Activities
// Expense categories for sole proprietors - 2024 tax year

export interface T2125Category {
  code: string;
  name: string;
  description: string;
  lineNumber: string;
  isFullyDeductible: boolean;
  notes?: string;
}

export const T2125_CATEGORIES: T2125Category[] = [
  {
    code: "ADVERTISING",
    name: "Advertising",
    description: "Advertising and promotion expenses to generate business income",
    lineNumber: "8001",
    isFullyDeductible: true,
    notes: "Include website costs, business cards, promotional materials"
  },
  {
    code: "MEALS_ENTERTAINMENT", 
    name: "Meals and Entertainment",
    description: "Business meals and entertainment expenses",
    lineNumber: "8002",
    isFullyDeductible: false,
    notes: "Only 50% deductible in most cases"
  },
  {
    code: "BAD_DEBTS",
    name: "Bad Debts",
    description: "Amounts you cannot collect from customers",
    lineNumber: "8003", 
    isFullyDeductible: true
  },
  {
    code: "INSURANCE",
    name: "Insurance",
    description: "Business insurance premiums (not personal insurance)",
    lineNumber: "8004",
    isFullyDeductible: true,
    notes: "Professional liability, general business insurance"
  },
  {
    code: "INTEREST_BANK_CHARGES",
    name: "Interest and Bank Charges", 
    description: "Interest on business loans and bank service charges",
    lineNumber: "8005",
    isFullyDeductible: true
  },
  {
    code: "BUSINESS_TAX",
    name: "Business Tax, Fees, Licences, Dues",
    description: "Professional fees, licenses, memberships, business taxes",
    lineNumber: "8006", 
    isFullyDeductible: true,
    notes: "Professional association dues, business licenses"
  },
  {
    code: "OFFICE_EXPENSES",
    name: "Office Expenses",
    description: "Office supplies, stationery, postage, and similar expenses",
    lineNumber: "8007",
    isFullyDeductible: true
  },
  {
    code: "PROFESSIONAL_FEES",
    name: "Professional Fees",
    description: "Legal, accounting, consulting, and other professional services",
    lineNumber: "8008",
    isFullyDeductible: true
  },
  {
    code: "MANAGEMENT_ADMIN",
    name: "Management and Administration Fees",
    description: "Management and administration fees paid to others", 
    lineNumber: "8009",
    isFullyDeductible: true
  },
  {
    code: "RENT",
    name: "Rent",
    description: "Rent for business premises, equipment, or vehicles",
    lineNumber: "8010",
    isFullyDeductible: true
  },
  {
    code: "MAINTENANCE_REPAIRS",
    name: "Maintenance and Repairs", 
    description: "Repairs and maintenance of business property and equipment",
    lineNumber: "8011",
    isFullyDeductible: true,
    notes: "Repairs only, not improvements or capital additions"
  },
  {
    code: "SALARIES_WAGES",
    name: "Salaries, Wages, and Benefits",
    description: "Salaries, wages, and benefits paid to employees",
    lineNumber: "8012",
    isFullyDeductible: true,
    notes: "Include CPP, EI, and other payroll deductions"
  },
  {
    code: "SUBCONTRACTS",
    name: "Subcontracts",
    description: "Amounts paid to subcontractors",
    lineNumber: "8013", 
    isFullyDeductible: true,
    notes: "Issue T4A slips if required"
  },
  {
    code: "TRAVEL",
    name: "Travel",
    description: "Business travel expenses including accommodation and airfare",
    lineNumber: "8014",
    isFullyDeductible: true,
    notes: "Must be for business purposes, keep detailed records"
  },
  {
    code: "TELEPHONE_UTILITIES",
    name: "Telephone and Utilities",
    description: "Business telephone, internet, electricity, heating, water",
    lineNumber: "8015",
    isFullyDeductible: true,
    notes: "Business portion only if mixed use"
  },
  {
    code: "VEHICLE_EXPENSES",
    name: "Motor Vehicle Expenses",
    description: "Business use of motor vehicle expenses",
    lineNumber: "8016", 
    isFullyDeductible: false,
    notes: "Business portion only, detailed logbook required"
  },
  {
    code: "DELIVERY_FREIGHT",
    name: "Delivery, Freight, and Express",
    description: "Shipping, courier, and delivery expenses",
    lineNumber: "8017",
    isFullyDeductible: true
  },
  {
    code: "OTHER_EXPENSES",
    name: "Other Expenses",
    description: "Other business expenses not listed elsewhere",
    lineNumber: "8018",
    isFullyDeductible: true,
    notes: "Must be reasonable and for business purposes"
  },
  // Income categories
  {
    code: "BUSINESS_INCOME",
    name: "Business Income", 
    description: "Gross business income from sales and services",
    lineNumber: "8000",
    isFullyDeductible: false,
    notes: "This is income, not an expense"
  },
  {
    code: "PROFESSIONAL_INCOME",
    name: "Professional Income",
    description: "Income from professional services",
    lineNumber: "8001",
    isFullyDeductible: false,
    notes: "This is income, not an expense"
  }
];

// Helper function to get category by code
export function getT2125Category(code: string): T2125Category | undefined {
  return T2125_CATEGORIES.find(cat => cat.code === code);
}

// Helper function to get all expense categories (excluding income)
export function getExpenseCategories(): T2125Category[] {
  return T2125_CATEGORIES.filter(cat => 
    !cat.code.includes('INCOME') && cat.code !== 'BUSINESS_INCOME' && cat.code !== 'PROFESSIONAL_INCOME'
  );
}

// Helper function to get all income categories
export function getIncomeCategories(): T2125Category[] {
  return T2125_CATEGORIES.filter(cat => 
    cat.code.includes('INCOME') || cat.code === 'BUSINESS_INCOME' || cat.code === 'PROFESSIONAL_INCOME'
  );
}

// Mapping common transaction descriptions to T2125 categories
export const TRANSACTION_MAPPINGS: Record<string, string> = {
  // Office and supplies
  'staples': 'OFFICE_EXPENSES',
  'office depot': 'OFFICE_EXPENSES', 
  'costco': 'OFFICE_EXPENSES',
  'amazon': 'OFFICE_EXPENSES',
  
  // Professional services
  'lawyer': 'PROFESSIONAL_FEES',
  'accountant': 'PROFESSIONAL_FEES',
  'consultant': 'PROFESSIONAL_FEES',
  'cpa': 'PROFESSIONAL_FEES',
  
  // Travel
  'hotel': 'TRAVEL',
  'airline': 'TRAVEL',
  'uber': 'TRAVEL',
  'taxi': 'TRAVEL',
  'gas station': 'VEHICLE_EXPENSES',
  'petro canada': 'VEHICLE_EXPENSES',
  'shell': 'VEHICLE_EXPENSES',
  
  // Utilities
  'bell': 'TELEPHONE_UTILITIES',
  'rogers': 'TELEPHONE_UTILITIES',
  'telus': 'TELEPHONE_UTILITIES',
  'hydro': 'TELEPHONE_UTILITIES',
  'enbridge': 'TELEPHONE_UTILITIES',
  
  // Meals
  'restaurant': 'MEALS_ENTERTAINMENT',
  'tim hortons': 'MEALS_ENTERTAINMENT',
  'starbucks': 'MEALS_ENTERTAINMENT',
  
  // Banking
  'bank fee': 'INTEREST_BANK_CHARGES',
  'service charge': 'INTEREST_BANK_CHARGES',
  'interest': 'INTEREST_BANK_CHARGES',
  
  // Insurance
  'insurance': 'INSURANCE',
  'liability': 'INSURANCE',
  
  // Advertising
  'google ads': 'ADVERTISING',
  'facebook': 'ADVERTISING',
  'marketing': 'ADVERTISING',
  'advertising': 'ADVERTISING'
};

// Additional helper function for finding categories by code
export function findCategoryByCode(code: string): T2125Category | undefined {
  return T2125_CATEGORIES.find(cat => cat.code === code);
}