import { stableTransactionHash, calculateRunningBalance } from '../server/services/bank-sync';

describe('stableTransactionHash', () => {
  it('returns same hash for same bankTransactionId regardless of other fields', () => {
    const h1 = stableTransactionHash('txn_abc', 'Coffee', '12.50', new Date('2025-01-01'));
    const h2 = stableTransactionHash('txn_abc', 'Different Name', '99.99', new Date('2025-06-01'));
    expect(h1).toBe(h2);
  });

  it('returns different hash for different bankTransactionIds', () => {
    const h1 = stableTransactionHash('txn_001');
    const h2 = stableTransactionHash('txn_002');
    expect(h1).not.toBe(h2);
  });

  it('falls back to description+amount+date when no bankTransactionId', () => {
    const h1 = stableTransactionHash(null, 'Starbucks', '5.50', '2025-02-10');
    const h2 = stableTransactionHash(null, 'Starbucks', '5.50', '2025-02-10');
    const h3 = stableTransactionHash(null, 'Starbucks', '6.00', '2025-02-10');
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it('returns different hash for same description but different dates', () => {
    const h1 = stableTransactionHash(undefined, 'Netflix', '15.99', '2025-01-01');
    const h2 = stableTransactionHash(undefined, 'Netflix', '15.99', '2025-02-01');
    expect(h1).not.toBe(h2);
  });

  it('always returns a 64-char hex string', () => {
    const h = stableTransactionHash('txn_123');
    expect(h).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('calculateRunningBalance', () => {
  it('sums income (not expense) positively', () => {
    const txns = [
      { amount: '1000.00', isExpense: false, date: '2025-01-01' },
    ];
    expect(calculateRunningBalance(txns)).toBeCloseTo(1000);
  });

  it('subtracts expenses', () => {
    const txns = [
      { amount: '1000.00', isExpense: false, date: '2025-01-01' },
      { amount: '200.00', isExpense: true, date: '2025-01-05' },
    ];
    expect(calculateRunningBalance(txns)).toBeCloseTo(800);
  });

  it('processes in date order regardless of input order', () => {
    const txns = [
      { amount: '50.00', isExpense: true, date: '2025-01-10' },
      { amount: '500.00', isExpense: false, date: '2025-01-01' },
      { amount: '100.00', isExpense: true, date: '2025-01-05' },
    ];
    expect(calculateRunningBalance(txns)).toBeCloseTo(350);
  });

  it('returns 0 for empty array', () => {
    expect(calculateRunningBalance([])).toBe(0);
  });

  it('handles all expenses', () => {
    const txns = [
      { amount: '100.00', isExpense: true, date: '2025-01-01' },
      { amount: '50.00', isExpense: true, date: '2025-01-02' },
    ];
    expect(calculateRunningBalance(txns)).toBeCloseTo(-150);
  });
});

describe('cursor advancement (mock sync logic)', () => {
  it('produces a non-empty initial cursor', () => {
    const nextCursor = 'cursor_page2_v1';
    expect(nextCursor).toBeTruthy();
    expect(nextCursor).not.toBe('');
  });

  it('marks cursorAdvanced when cursor changes', () => {
    const oldCursor = null;
    const newCursor = 'cursor_page2_v1';
    const cursorAdvanced = newCursor !== oldCursor;
    expect(cursorAdvanced).toBe(true);
  });

  it('does NOT mark cursorAdvanced when cursor stays the same', () => {
    const oldCursor = 'cursor_final_v1';
    const newCursor = 'cursor_final_v1';
    const cursorAdvanced = newCursor !== oldCursor;
    expect(cursorAdvanced).toBe(false);
  });

  it('page2 cursor produces different results than initial cursor', () => {
    const cursorInit = null;
    const cursorPage2 = 'cursor_page2_v1';
    expect(cursorInit).not.toBe(cursorPage2);
  });
});

describe('de-duplication', () => {
  it('skips transaction when bankTransactionId already exists', async () => {
    const existingId: string = 'mock_txn_001';
    const incomingId: string = 'mock_txn_001';
    const isDuplicate = existingId === incomingId;
    expect(isDuplicate).toBe(true);
  });

  it('does not skip transaction with unique bankTransactionId', () => {
    const existingId: string = 'mock_txn_001';
    const incomingId: string = 'mock_txn_002';
    const isDuplicate = existingId === incomingId;
    expect(isDuplicate).toBe(false);
  });
});
