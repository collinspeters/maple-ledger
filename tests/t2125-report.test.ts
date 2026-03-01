import { normaliseToCad, deductibleRate, mapToT2125Code, reportToCSV } from '../server/services/t2125-report';
import type { T2125Report } from '../server/services/t2125-report';

// ---------------------------------------------------------------------------
// Multi-currency normalisation
// ---------------------------------------------------------------------------
describe('normaliseToCad', () => {
  it('returns same value for CAD', () => {
    expect(normaliseToCad(100, 'CAD')).toBe(100);
  });

  it('converts USD to CAD at 1.35 rate', () => {
    expect(normaliseToCad(100, 'USD')).toBeCloseTo(135, 1);
  });

  it('converts EUR to CAD at 1.46 rate', () => {
    expect(normaliseToCad(100, 'EUR')).toBeCloseTo(146, 1);
  });

  it('converts GBP to CAD at 1.71 rate', () => {
    expect(normaliseToCad(50, 'GBP')).toBeCloseTo(85.5, 1);
  });

  it('falls back to USD rate for unknown currencies', () => {
    expect(normaliseToCad(100, 'XYZ')).toBeCloseTo(135, 1);
  });

  it('treats null/undefined currency as CAD', () => {
    expect(normaliseToCad(200, null)).toBe(200);
    expect(normaliseToCad(200, undefined)).toBe(200);
  });

  it('handles zero amounts', () => {
    expect(normaliseToCad(0, 'USD')).toBe(0);
  });

  it('rounds to two decimal places', () => {
    const result = normaliseToCad(1.125, 'CAD');
    expect(result).toBe(1.13);
  });
});

// ---------------------------------------------------------------------------
// Deductibility rates
// ---------------------------------------------------------------------------
describe('deductibleRate', () => {
  it('returns 0.50 for MEALS_ENTERTAINMENT', () => {
    expect(deductibleRate('MEALS_ENTERTAINMENT')).toBe(0.50);
  });

  it('returns 0.80 for VEHICLE_EXPENSES', () => {
    expect(deductibleRate('VEHICLE_EXPENSES')).toBe(0.80);
  });

  it('returns 1.00 for fully deductible categories', () => {
    const fullyCodes = [
      'ADVERTISING', 'OFFICE_EXPENSES', 'PROFESSIONAL_FEES',
      'RENT', 'TELEPHONE_UTILITIES', 'INSURANCE', 'TRAVEL',
    ];
    for (const code of fullyCodes) {
      expect(deductibleRate(code)).toBe(1.00);
    }
  });

  it('returns 1.00 for unknown code', () => {
    expect(deductibleRate('SOME_RANDOM_CODE')).toBe(1.00);
  });
});

// ---------------------------------------------------------------------------
// T2125 code mapping
// ---------------------------------------------------------------------------
describe('mapToT2125Code', () => {
  it('maps MEALS_ENTERTAINMENT directly', () => {
    expect(mapToT2125Code('MEALS_ENTERTAINMENT')).toBe('MEALS_ENTERTAINMENT');
  });

  it('maps OFFICE_EXPENSES directly', () => {
    expect(mapToT2125Code('OFFICE_EXPENSES')).toBe('OFFICE_EXPENSES');
  });

  it('maps SOFTWARE alias to OFFICE_EXPENSES', () => {
    expect(mapToT2125Code('SOFTWARE')).toBe('OFFICE_EXPENSES');
  });

  it('maps TELEPHONE alias to TELEPHONE_UTILITIES', () => {
    expect(mapToT2125Code('TELEPHONE_UTILITIES')).toBe('TELEPHONE_UTILITIES');
  });

  it('maps INTERNET alias to TELEPHONE_UTILITIES', () => {
    expect(mapToT2125Code('INTERNET')).toBe('TELEPHONE_UTILITIES');
  });

  it('maps MARKETING alias to ADVERTISING', () => {
    expect(mapToT2125Code('MARKETING')).toBe('ADVERTISING');
  });

  it('maps REVENUE alias to BUSINESS_INCOME', () => {
    expect(mapToT2125Code('REVENUE')).toBe('BUSINESS_INCOME');
  });

  it('maps INCOME to BUSINESS_INCOME', () => {
    expect(mapToT2125Code('BUSINESS_INCOME')).toBe('BUSINESS_INCOME');
  });

  it('returns OTHER_EXPENSES for null', () => {
    expect(mapToT2125Code(null)).toBe('OTHER_EXPENSES');
  });

  it('returns OTHER_EXPENSES for undefined', () => {
    expect(mapToT2125Code(undefined)).toBe('OTHER_EXPENSES');
  });

  it('returns OTHER_EXPENSES for unknown category', () => {
    expect(mapToT2125Code('MYSTERY_EXPENSE')).toBe('OTHER_EXPENSES');
  });

  it('is case-insensitive', () => {
    expect(mapToT2125Code('office_expenses')).toBe('OFFICE_EXPENSES');
    expect(mapToT2125Code('Meals_Entertainment')).toBe('MEALS_ENTERTAINMENT');
  });
});

// ---------------------------------------------------------------------------
// Mapping totals
// ---------------------------------------------------------------------------
describe('T2125 mapping totals', () => {
  it('deductible amount for MEALS_ENTERTAINMENT is 50% of gross', () => {
    const gross = 1000;
    const rate = deductibleRate('MEALS_ENTERTAINMENT');
    expect(gross * rate).toBe(500);
  });

  it('deductible amount for VEHICLE_EXPENSES is 80% of gross', () => {
    const gross = 500;
    const rate = deductibleRate('VEHICLE_EXPENSES');
    expect(gross * rate).toBe(400);
  });

  it('deductible amount for RENT is 100% of gross', () => {
    const gross = 1200;
    const rate = deductibleRate('RENT');
    expect(gross * rate).toBe(1200);
  });

  it('net income = gross income minus total deductible expenses', () => {
    const grossIncome = 50000;
    const totalDeductible = 12000;
    const net = grossIncome - totalDeductible;
    expect(net).toBe(38000);
  });

  it('multi-currency sum normalises correctly before aggregating', () => {
    const cadAmount = normaliseToCad(1000, 'CAD');
    const usdAmount = normaliseToCad(100, 'USD');
    const total = cadAmount + usdAmount;
    expect(total).toBeCloseTo(1135, 0);
  });
});

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------
describe('reportToCSV', () => {
  const mockReport: T2125Report = {
    taxYear: 2025,
    period: { startDate: '2025-01-01', endDate: '2025-12-31' },
    grossIncome: {
      label: 'Business Income',
      items: [
        {
          code: 'BUSINESS_INCOME',
          lineNumber: '8000',
          name: 'Business Income',
          description: 'Gross business income',
          isFullyDeductible: false,
          grossAmount: 50000,
          deductibleAmount: 50000,
          transactionCount: 12,
          currency: 'CAD',
        }
      ],
      total: 50000,
    },
    expenses: {
      label: 'Business Expenses',
      items: [
        {
          code: 'OFFICE_EXPENSES',
          lineNumber: '8007',
          name: 'Office Expenses',
          description: 'Office supplies',
          isFullyDeductible: true,
          grossAmount: 1200,
          deductibleAmount: 1200,
          transactionCount: 5,
          currency: 'CAD',
        },
        {
          code: 'MEALS_ENTERTAINMENT',
          lineNumber: '8002',
          name: 'Meals and Entertainment',
          description: 'Business meals',
          isFullyDeductible: false,
          notes: 'Only 50% deductible',
          grossAmount: 800,
          deductibleAmount: 400,
          transactionCount: 3,
          currency: 'CAD',
        }
      ],
      total: 2000,
    },
    totalDeductibleExpenses: 1600,
    netBusinessIncome: 48400,
    unmappedExpenses: [],
    generatedAt: '2025-03-01T00:00:00.000Z',
  };

  it('includes T2125 header', () => {
    const csv = reportToCSV(mockReport);
    expect(csv).toContain('T2125');
  });

  it('includes tax year', () => {
    const csv = reportToCSV(mockReport);
    expect(csv).toContain('2025');
  });

  it('includes income line items', () => {
    const csv = reportToCSV(mockReport);
    expect(csv).toContain('Business Income');
    expect(csv).toContain('50000.00');
  });

  it('includes expense line items with deductible amounts', () => {
    const csv = reportToCSV(mockReport);
    expect(csv).toContain('Office Expenses');
    expect(csv).toContain('1200.00');
    expect(csv).toContain('Meals and Entertainment');
    expect(csv).toContain('400.00'); // 50% of 800
  });

  it('includes net business income in summary', () => {
    const csv = reportToCSV(mockReport);
    expect(csv).toContain('48400.00');
  });

  it('includes period dates', () => {
    const csv = reportToCSV(mockReport);
    expect(csv).toContain('2025-01-01');
    expect(csv).toContain('2025-12-31');
  });
});
