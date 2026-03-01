import { generalLedgerToCSV } from '../server/services/reports';
import type { GeneralLedgerReport } from '../server/services/reports';

// ---------------------------------------------------------------------------
// Monthly P&L helper tests (pure logic — no DB)
// ---------------------------------------------------------------------------
describe('Monthly P&L bucketing logic', () => {
  const bucketByMonth = (
    txns: Array<{ date: Date; isExpense: boolean; amount: number; isTransfer?: boolean }>
  ) => {
    const year = txns[0]?.date.getFullYear() ?? new Date().getFullYear();
    const buckets: Record<string, { revenue: number; expenses: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`;
      buckets[key] = { revenue: 0, expenses: 0 };
    }
    for (const t of txns) {
      if (t.isTransfer) continue;
      const d = t.date;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!buckets[key]) continue;
      if (t.isExpense) {
        buckets[key].expenses += t.amount;
      } else {
        buckets[key].revenue += t.amount;
      }
    }
    return buckets;
  };

  it('buckets revenue into the correct month', () => {
    const txns = [
      { date: new Date('2025-03-10'), isExpense: false, amount: 5000 },
      { date: new Date('2025-07-15'), isExpense: false, amount: 3000 },
    ];
    const result = bucketByMonth(txns);
    expect(result['2025-03'].revenue).toBe(5000);
    expect(result['2025-07'].revenue).toBe(3000);
    expect(result['2025-01'].revenue).toBe(0);
  });

  it('buckets expenses into the correct month', () => {
    const txns = [
      { date: new Date('2025-02-20'), isExpense: true, amount: 800 },
    ];
    const result = bucketByMonth(txns);
    expect(result['2025-02'].expenses).toBe(800);
    expect(result['2025-02'].revenue).toBe(0);
  });

  it('skips transfer transactions', () => {
    const txns = [
      { date: new Date('2025-05-01'), isExpense: true, amount: 500, isTransfer: true },
    ];
    const result = bucketByMonth(txns);
    expect(result['2025-05'].expenses).toBe(0);
  });

  it('accumulates multiple transactions in the same month', () => {
    const txns = [
      { date: new Date('2025-06-01'), isExpense: false, amount: 1000 },
      { date: new Date('2025-06-15'), isExpense: false, amount: 2000 },
      { date: new Date('2025-06-28'), isExpense: true, amount: 500 },
    ];
    const result = bucketByMonth(txns);
    expect(result['2025-06'].revenue).toBe(3000);
    expect(result['2025-06'].expenses).toBe(500);
  });

  it('annual totals sum correctly across all months', () => {
    const txns = [
      { date: new Date('2025-01-10'), isExpense: false, amount: 1000 },
      { date: new Date('2025-06-10'), isExpense: false, amount: 2000 },
      { date: new Date('2025-12-10'), isExpense: true, amount: 500 },
    ];
    const result = bucketByMonth(txns);
    const totalRevenue = Object.values(result).reduce((s, b) => s + b.revenue, 0);
    const totalExpenses = Object.values(result).reduce((s, b) => s + b.expenses, 0);
    expect(totalRevenue).toBe(3000);
    expect(totalExpenses).toBe(500);
  });

  it('produces 12 month keys for a full year', () => {
    const result = bucketByMonth([{ date: new Date('2025-01-01'), isExpense: false, amount: 0 }]);
    expect(Object.keys(result)).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// General Ledger CSV export
// ---------------------------------------------------------------------------
describe('generalLedgerToCSV', () => {
  const mockReport: GeneralLedgerReport = {
    accounts: [
      {
        accountName: 'Office Expenses',
        accountType: 'expense',
        transactions: [
          { date: '2025-03-01', description: 'Staples supply run', reference: 'abc123', debit: 120.50, credit: 0, balance: 120.50 },
          { date: '2025-03-15', description: 'Printer ink', reference: 'def456', debit: 45.00, credit: 0, balance: 165.50 },
        ],
        beginningBalance: 0,
        endingBalance: 165.50,
      },
      {
        accountName: 'Business Income',
        accountType: 'revenue',
        transactions: [
          { date: '2025-03-05', description: 'Invoice #101', reference: 'ghi789', debit: 0, credit: 5000, balance: -5000 },
        ],
        beginningBalance: 0,
        endingBalance: -5000,
      }
    ],
    period: { startDate: '2025-03-01', endDate: '2025-03-31' },
  };

  it('includes General Ledger header', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('General Ledger');
  });

  it('includes period in output', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('2025-03-01');
    expect(csv).toContain('2025-03-31');
  });

  it('includes account names', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('Office Expenses');
    expect(csv).toContain('Business Income');
  });

  it('includes debit amounts', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('120.50');
    expect(csv).toContain('45.00');
  });

  it('includes credit amounts', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('5000.00');
  });

  it('includes ending balances', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('165.50');
  });

  it('includes transaction descriptions', () => {
    const csv = generalLedgerToCSV(mockReport);
    expect(csv).toContain('Staples supply run');
    expect(csv).toContain('Invoice #101');
  });

  it('produces valid CSV with commas', () => {
    const csv = generalLedgerToCSV(mockReport);
    const lines = csv.split('\n').filter(l => l.trim());
    expect(lines.length).toBeGreaterThan(5);
    const hasCommas = lines.some(l => l.includes(','));
    expect(hasCommas).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Audit log event naming
// ---------------------------------------------------------------------------
describe('Audit log event types', () => {
  const validEvents = [
    'sync.started',
    'sync.completed',
    'transaction.reviewed',
    'transaction.categorized',
    'transaction.category_overridden',
    'transaction.bulk_categorized',
  ] as const;

  it('all event names are non-empty strings', () => {
    for (const ev of validEvents) {
      expect(ev.length).toBeGreaterThan(0);
    }
  });

  it('sync events use dot notation', () => {
    const syncEvents = validEvents.filter(e => e.startsWith('sync.'));
    expect(syncEvents).toHaveLength(2);
  });

  it('transaction events use dot notation', () => {
    const txnEvents = validEvents.filter(e => e.startsWith('transaction.'));
    expect(txnEvents).toHaveLength(4);
  });

  it('events are namespaced correctly', () => {
    for (const ev of validEvents) {
      expect(ev).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });
});
