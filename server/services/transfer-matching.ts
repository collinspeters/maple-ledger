import { Transaction } from 'plaid';
import { db } from './db';
import { transactions } from '../../shared/schema';
import { eq, and, gte, lte, ne } from 'drizzle-orm';

// Service for matching and linking transfer transactions between accounts
export class TransferMatchingService {
  
  // Find matching transfers within user's accounts
  static async findTransferMatches(
    userId: string, 
    newTransactions: any[], 
    dateWindow: number = 2 // days
  ): Promise<Array<{ transaction: any; matchId?: string; confidence: number }>> {
    
    const results = [];
    
    for (const transaction of newTransactions) {
      if (!transaction.isTransfer) {
        results.push({ transaction, confidence: 0 });
        continue;
      }
      
      // Look for matching transaction in opposite direction
      const matchingTransaction = await this.findMatchingTransfer(
        userId, 
        transaction, 
        dateWindow
      );
      
      if (matchingTransaction) {
        results.push({
          transaction,
          matchId: matchingTransaction.id,
          confidence: this.calculateMatchConfidence(transaction, matchingTransaction)
        });
      } else {
        results.push({ transaction, confidence: 0 });
      }
    }
    
    return results;
  }
  
  // Find a single matching transfer transaction
  private static async findMatchingTransfer(
    userId: string,
    sourceTransaction: any,
    dateWindow: number
  ) {
    const searchDate = new Date(sourceTransaction.date);
    const startDate = new Date(searchDate);
    const endDate = new Date(searchDate);
    
    startDate.setDate(startDate.getDate() - dateWindow);
    endDate.setDate(endDate.getDate() + dateWindow);
    
    const sourceAmount = Math.abs(parseFloat(sourceTransaction.amount));
    
    // Look for transactions with matching amount in opposite direction
    const candidates = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.isTransfer, true),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          ne(transactions.bankTransactionId, sourceTransaction.plaidTransactionId)
        )
      );
    
    // Find best match based on amount and timing
    let bestMatch = null;
    let bestScore = 0;
    
    for (const candidate of candidates) {
      const candidateAmount = Math.abs(parseFloat(candidate.amount));
      const score = this.calculateMatchScore(
        sourceTransaction,
        candidate,
        sourceAmount,
        candidateAmount
      );
      
      if (score > bestScore && score > 0.8) { // High confidence threshold
        bestMatch = candidate;
        bestScore = score;
      }
    }
    
    return bestMatch;
  }
  
  // Calculate how well two transactions match as a transfer pair
  private static calculateMatchScore(
    sourceTransaction: any,
    candidateTransaction: any,
    sourceAmount: number,
    candidateAmount: number
  ): number {
    let score = 0;
    
    // Amount matching (most important)
    const amountDiff = Math.abs(sourceAmount - candidateAmount);
    const amountScore = Math.max(0, 1 - (amountDiff / Math.max(sourceAmount, candidateAmount)));
    score += amountScore * 0.6;
    
    // Date proximity
    const sourceDate = new Date(sourceTransaction.date);
    const candidateDate = new Date(candidateTransaction.date);
    const daysDiff = Math.abs((sourceDate.getTime() - candidateDate.getTime()) / (1000 * 60 * 60 * 24));
    const dateScore = Math.max(0, 1 - (daysDiff / 2));
    score += dateScore * 0.2;
    
    // Opposite flow (one in, one out)
    const sourceIsOutflow = parseFloat(sourceTransaction.amount) > 0;
    const candidateIsOutflow = parseFloat(candidateTransaction.amount) > 0;
    if (sourceIsOutflow !== candidateIsOutflow) {
      score += 0.2;
    }
    
    return score;
  }
  
  // Calculate confidence for a matched pair
  private static calculateMatchConfidence(
    transaction1: any,
    transaction2: any
  ): number {
    const amount1 = Math.abs(parseFloat(transaction1.amount));
    const amount2 = Math.abs(parseFloat(transaction2.amount));
    
    return this.calculateMatchScore(transaction1, transaction2, amount1, amount2);
  }
  
  // Link matched transfer transactions with a shared ID
  static async linkTransferPair(
    transaction1Id: string,
    transaction2Id: string,
    transferType: 'internal' | 'external' | 'payment'
  ): Promise<string> {
    const transferPairId = `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update both transactions with the shared transfer pair ID
    await Promise.all([
      db.update(transactions)
        .set({
          transferPairId,
          transferType,
          updatedAt: new Date()
        })
        .where(eq(transactions.id, transaction1Id)),
      
      db.update(transactions)
        .set({
          transferPairId,
          transferType,
          updatedAt: new Date()
        })
        .where(eq(transactions.id, transaction2Id))
    ]);
    
    return transferPairId;
  }
  
  // Get all transfer pairs for a user
  static async getTransferPairs(userId: string): Promise<Array<{
    pairId: string;
    transactions: any[];
    transferType: string;
    totalAmount: number;
  }>> {
    const transferTransactions = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.isTransfer, true),
          ne(transactions.transferPairId, null)
        )
      );
    
    // Group by transfer pair ID
    const pairs = new Map();
    
    for (const transaction of transferTransactions) {
      const pairId = transaction.transferPairId!;
      if (!pairs.has(pairId)) {
        pairs.set(pairId, {
          pairId,
          transactions: [],
          transferType: transaction.transferType,
          totalAmount: 0
        });
      }
      
      const pair = pairs.get(pairId);
      pair.transactions.push(transaction);
      pair.totalAmount += Math.abs(parseFloat(transaction.amount));
    }
    
    return Array.from(pairs.values());
  }
}