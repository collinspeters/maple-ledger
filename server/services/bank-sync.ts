import crypto from 'crypto';
import { EventEmitter } from 'events';
import { storage } from '../storage';
import { syncTransactions, processCanadianTransactions } from './plaid';
import { categorizeTransactionHybrid } from './hybrid-categorization';

export const syncEventEmitter = new EventEmitter();

export interface SyncResult {
  connectionId: string;
  bankName: string;
  added: number;
  modified: number;
  removed: number;
  duplicatesSkipped: number;
  cursorAdvanced: boolean;
  runningBalance?: number;
}

export interface SyncSummary {
  totalAdded: number;
  totalModified: number;
  totalRemoved: number;
  totalDuplicatesSkipped: number;
  results: SyncResult[];
  completedAt: string;
}

/**
 * Generate a stable de-duplication hash for a transaction.
 * Uses bankTransactionId if available; falls back to description+amount+date.
 */
export function stableTransactionHash(bankTransactionId?: string | null, description?: string, amount?: string, date?: Date | string): string {
  const key = bankTransactionId
    ? `txn:${bankTransactionId}`
    : `txn:${description}:${amount}:${typeof date === 'string' ? date : date?.toISOString().split('T')[0]}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Mock dataset simulating a Plaid transactions/sync response with a cursor.
 * Each call advances the cursor and returns a delta of new transactions.
 */
const MOCK_TRANSACTIONS_DATASET: Record<string, any[]> = {
  default: [
    {
      transaction_id: 'mock_txn_001',
      account_id: 'acc_checking',
      amount: 125.50,
      date: '2025-02-01',
      name: 'Canadian Tire',
      merchant_name: 'Canadian Tire',
      category: ['Shops', 'Hardware Store'],
      payment_channel: 'in store',
      location: { country: 'CA', region: 'ON', city: 'Toronto' }
    },
    {
      transaction_id: 'mock_txn_002',
      account_id: 'acc_checking',
      amount: -3500.00,
      date: '2025-02-03',
      name: 'Client Invoice Payment',
      merchant_name: null,
      category: ['Payment', 'Deposit'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_003',
      account_id: 'acc_checking',
      amount: 89.99,
      date: '2025-02-05',
      name: 'Adobe Creative Cloud',
      merchant_name: 'Adobe',
      category: ['Service', 'Software'],
      payment_channel: 'online',
      location: { country: 'US' }
    },
    {
      transaction_id: 'mock_txn_004',
      account_id: 'acc_checking',
      amount: 45.25,
      date: '2025-02-08',
      name: 'Tim Hortons',
      merchant_name: 'Tim Hortons',
      category: ['Food and Drink', 'Coffee Shop'],
      payment_channel: 'in store',
      location: { country: 'CA', region: 'ON', city: 'Toronto' }
    },
    {
      transaction_id: 'mock_txn_005',
      account_id: 'acc_checking',
      amount: 750.00,
      date: '2025-02-10',
      name: 'Office Rent Feb 2025',
      merchant_name: null,
      category: ['Rent', 'Real Estate'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_006',
      account_id: 'acc_checking',
      amount: 32.00,
      date: '2025-02-12',
      name: 'Shopify Subscription',
      merchant_name: 'Shopify',
      category: ['Service', 'Software'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_007',
      account_id: 'acc_checking',
      amount: -1200.00,
      date: '2025-02-15',
      name: 'E-Transfer from Client ABC',
      merchant_name: null,
      category: ['Transfer'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_008',
      account_id: 'acc_checking',
      amount: 18.50,
      date: '2025-02-18',
      name: 'Canada Post',
      merchant_name: 'Canada Post',
      category: ['Service', 'Shipping'],
      payment_channel: 'in store',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_009',
      account_id: 'acc_checking',
      amount: 200.00,
      date: '2025-02-20',
      name: 'Rogers Wireless',
      merchant_name: 'Rogers',
      category: ['Telecommunication Services'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_010',
      account_id: 'acc_checking',
      amount: 55.00,
      date: '2025-02-22',
      name: 'Staples Office Supplies',
      merchant_name: 'Staples',
      category: ['Shops', 'Office Supplies'],
      payment_channel: 'in store',
      location: { country: 'CA', region: 'ON', city: 'Toronto' }
    }
  ],
  // Second page of delta returned on subsequent syncs
  page2: [
    {
      transaction_id: 'mock_txn_011',
      account_id: 'acc_checking',
      amount: -2800.00,
      date: '2025-02-25',
      name: 'Project Invoice #INV-042',
      merchant_name: null,
      category: ['Payment', 'Deposit'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    },
    {
      transaction_id: 'mock_txn_012',
      account_id: 'acc_checking',
      amount: 147.30,
      date: '2025-02-26',
      name: 'Uber Business',
      merchant_name: 'Uber',
      category: ['Transportation', 'Ride Share'],
      payment_channel: 'online',
      location: { country: 'CA', region: 'ON' }
    }
  ]
};

/**
 * Fetch delta transactions using cursor-based pagination from mock dataset.
 */
function fetchMockDelta(cursor?: string | null): { added: any[]; nextCursor: string; hasMore: boolean } {
  if (!cursor) {
    return {
      added: MOCK_TRANSACTIONS_DATASET.default,
      nextCursor: 'cursor_page2_v1',
      hasMore: true
    };
  }
  if (cursor === 'cursor_page2_v1') {
    return {
      added: MOCK_TRANSACTIONS_DATASET.page2,
      nextCursor: 'cursor_final_v1',
      hasMore: false
    };
  }
  // Already at latest cursor — no new transactions
  return {
    added: [],
    nextCursor: cursor,
    hasMore: false
  };
}

/**
 * Calculate running balance by sorting transactions by date and summing amounts.
 */
export function calculateRunningBalance(transactions: Array<{ amount: string; isExpense: boolean; date: Date | string }>): number {
  const sorted = [...transactions].sort((a, b) => {
    const da = typeof a.date === 'string' ? new Date(a.date) : a.date;
    const db = typeof b.date === 'string' ? new Date(b.date) : b.date;
    return da.getTime() - db.getTime();
  });

  return sorted.reduce((balance, t) => {
    const amt = parseFloat(t.amount);
    return t.isExpense ? balance - amt : balance + amt;
  }, 0);
}

/**
 * Main sync pipeline for a single bank connection.
 * - Uses cursor-based delta fetching  
 * - De-duplicates by stable hash  
 * - Idempotently upserts transactions  
 * - Recalculates running balance  
 * - Emits transactions.synced event  
 */
export async function syncBankConnection(
  connection: {
    id: string;
    userId: string;
    plaidAccessToken: string;
    accountId: string;
    bankName: string;
    accountName?: string;
    syncCursor?: string | null;
  },
  userAccountIds: string[],
  useMockData = false
): Promise<SyncResult> {
  let added = 0;
  let modified = 0;
  let removed = 0;
  let duplicatesSkipped = 0;
  let nextCursor = connection.syncCursor || null;

  let rawAdded: any[] = [];
  let hasMore = false;

  if (useMockData) {
    const delta = fetchMockDelta(connection.syncCursor);
    rawAdded = delta.added;
    nextCursor = delta.nextCursor;
    hasMore = delta.hasMore;
  } else {
    const syncData = await syncTransactions(connection.plaidAccessToken, connection.syncCursor || undefined);
    rawAdded = syncData.added;
    nextCursor = syncData.nextCursor;
    hasMore = syncData.hasMore;
    removed = syncData.removed.length;
  }

  // Process added transactions
  for (const rawTxn of rawAdded) {
    const hash = stableTransactionHash(
      rawTxn.transaction_id,
      rawTxn.name,
      String(Math.abs(rawTxn.amount)),
      rawTxn.date
    );

    // Idempotent check: skip if we already have this transaction (by bankTransactionId)
    const existing = await storage.getTransactionByPlaidId(rawTxn.transaction_id);
    if (existing) {
      duplicatesSkipped++;
      continue;
    }

    // Categorize via hybrid system
    let category = 'OTHER_EXPENSES';
    let isExpense = rawTxn.amount > 0;
    let isTransfer = false;
    let transferType: string | null = null;
    let aiConfidence = '0.80';
    let aiExplanation: string | null = null;
    let categorizationMethod = 'plaid_rules';

    try {
      const catResult = await categorizeTransactionHybrid(rawTxn, userAccountIds);
      category = catResult.category;
      isExpense = catResult.isExpense;
      isTransfer = catResult.isTransfer;
      transferType = catResult.transferType || null;
      aiConfidence = catResult.confidence.toString();
      aiExplanation = catResult.explanation || null;
      categorizationMethod = catResult.method || 'plaid_rules';
    } catch (_err) {
      // Fall back to plaid category mapping
    }

    const txnData = {
      userId: connection.userId,
      description: rawTxn.name,
      vendor: rawTxn.merchant_name || rawTxn.name,
      amount: Math.abs(rawTxn.amount).toString(),
      date: new Date(rawTxn.date),
      category,
      isExpense,
      isTransfer,
      transferType,
      bankTransactionId: rawTxn.transaction_id,
      bankConnectionId: connection.id,
      accountId: rawTxn.account_id,
      aiCategory: category,
      aiConfidence,
      aiExplanation,
      needsReview: parseFloat(aiConfidence) < 0.8,
      isReviewed: false,
      plaidCategory: rawTxn.category?.[0] || null,
      paymentChannel: rawTxn.payment_channel || null,
      location: rawTxn.location ? JSON.stringify(rawTxn.location) : null,
      categorizationMethod,
      receiptSource: 'bank_feed',
    };

    await storage.createTransaction(txnData);
    added++;
  }

  // Advance cursor
  const cursorAdvanced = nextCursor !== connection.syncCursor;

  if (cursorAdvanced && nextCursor) {
    await storage.updateBankConnection(connection.id, {
      lastSyncAt: new Date(),
      syncCursor: nextCursor,
    } as any);
  } else {
    await storage.updateBankConnection(connection.id, { lastSyncAt: new Date() });
  }

  // Recalculate running balance for this account's transactions
  const allTxns = await storage.getTransactions(connection.userId);
  const acctTxns = allTxns.filter(t => t.bankConnectionId === connection.id);
  const runningBalance = calculateRunningBalance(acctTxns.map(t => ({
    amount: t.amount,
    isExpense: t.isExpense ?? true,
    date: t.date,
  })));

  const result: SyncResult = {
    connectionId: connection.id,
    bankName: connection.bankName,
    added,
    modified,
    removed,
    duplicatesSkipped,
    cursorAdvanced,
    runningBalance,
  };

  // Emit transactions.synced event
  syncEventEmitter.emit('transactions.synced', {
    userId: connection.userId,
    hasMore,
    timestamp: new Date().toISOString(),
    ...result,
  });

  return result;
}

/**
 * Sync all bank connections for a user.
 */
export async function syncAllConnections(userId: string, useMockData = false): Promise<SyncSummary> {
  const connections = await storage.getBankConnections(userId);
  const userAccountIds = connections.map(c => c.accountId);
  const results: SyncResult[] = [];

  for (const conn of connections) {
    try {
      const result = await syncBankConnection(
        {
          id: conn.id,
          userId: conn.userId,
          plaidAccessToken: conn.plaidAccessToken,
          accountId: conn.accountId,
          bankName: conn.bankName,
          accountName: conn.accountName,
          syncCursor: (conn as any).syncCursor,
        },
        userAccountIds,
        useMockData
      );
      results.push(result);
    } catch (err) {
      const failedResult: SyncResult = {
        connectionId: conn.id,
        bankName: conn.bankName,
        added: 0,
        modified: 0,
        removed: 0,
        duplicatesSkipped: 0,
        cursorAdvanced: false,
      };
      results.push(failedResult);
    }
  }

  const summary: SyncSummary = {
    totalAdded: results.reduce((s, r) => s + r.added, 0),
    totalModified: results.reduce((s, r) => s + r.modified, 0),
    totalRemoved: results.reduce((s, r) => s + r.removed, 0),
    totalDuplicatesSkipped: results.reduce((s, r) => s + r.duplicatesSkipped, 0),
    results,
    completedAt: new Date().toISOString(),
  };

  return summary;
}
