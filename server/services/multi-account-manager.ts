import { db } from '../db';
import { bankConnections, transactions } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getAccounts } from './plaid';
import { TransferMatchingService } from './transfer-matching';

// Service for managing multiple bank accounts and their relationships
export class MultiAccountManager {
  
  // Handle connecting multiple accounts from the same bank
  static async connectAccounts(
    userId: string, 
    accessToken: string, 
    itemId: string,
    bankName: string
  ): Promise<Array<any>> {
    try {
      // Get all accounts for this Plaid item
      const accountsData = await getAccounts(accessToken);
      const connectedAccounts = [];
      
      for (const account of accountsData.accounts) {
        // Check if this account is already connected
        const existingConnection = await db
          .select()
          .from(bankConnections)
          .where(
            and(
              eq(bankConnections.userId, userId),
              eq(bankConnections.accountId, account.account_id)
            )
          );
        
        if (existingConnection.length === 0) {
          // Create new connection for this account
          const newConnection = await db
            .insert(bankConnections)
            .values({
              userId,
              plaidItemId: itemId,
              plaidAccessToken: accessToken,
              bankName,
              accountType: account.type,
              accountId: account.account_id,
              accountName: account.name,
              accountMask: account.mask,
              isActive: true,
            })
            .returning();
          
          connectedAccounts.push({
            ...newConnection[0],
            balance: account.balances,
            accountDetails: account
          });
        }
      }
      
      return connectedAccounts;
    } catch (error) {
      console.error('Error connecting multiple accounts:', error);
      throw new Error('Failed to connect bank accounts');
    }
  }
  
  // Get all accounts grouped by bank for a user
  static async getAccountsByBank(userId: string): Promise<Array<{
    bankName: string;
    itemId: string;
    accounts: Array<any>;
    totalAccounts: number;
  }>> {
    try {
      const connections = await db
        .select()
        .from(bankConnections)
        .where(
          and(
            eq(bankConnections.userId, userId),
            eq(bankConnections.isActive, true)
          )
        )
        .orderBy(desc(bankConnections.createdAt));
      
      // Group by bank and item
      const groupedByBank = new Map();
      
      for (const connection of connections) {
        const key = `${connection.bankName}_${connection.plaidItemId}`;
        
        if (!groupedByBank.has(key)) {
          groupedByBank.set(key, {
            bankName: connection.bankName,
            itemId: connection.plaidItemId,
            accounts: [],
            totalAccounts: 0
          });
        }
        
        const group = groupedByBank.get(key);
        group.accounts.push(connection);
        group.totalAccounts++;
      }
      
      return Array.from(groupedByBank.values());
    } catch (error) {
      console.error('Error getting accounts by bank:', error);
      throw new Error('Failed to retrieve bank accounts');
    }
  }
  
  // Get account IDs for transfer detection
  static async getUserAccountIds(userId: string): Promise<string[]> {
    try {
      const connections = await db
        .select({ accountId: bankConnections.accountId })
        .from(bankConnections)
        .where(
          and(
            eq(bankConnections.userId, userId),
            eq(bankConnections.isActive, true)
          )
        );
      
      return connections.map(conn => conn.accountId);
    } catch (error) {
      console.error('Error getting user account IDs:', error);
      return [];
    }
  }
  
  // Process transactions with multi-account transfer detection
  static async processTransactionsWithTransferDetection(
    userId: string,
    newTransactions: any[]
  ): Promise<any[]> {
    try {
      // Get user's account IDs for transfer detection
      const userAccountIds = await this.getUserAccountIds(userId);
      
      // Detect and match transfers
      const transferMatches = await TransferMatchingService.findTransferMatches(
        userId,
        newTransactions,
        2 // 2-day window for matching
      );
      
      // Process each transaction with transfer information
      const processedTransactions = [];
      
      for (const match of transferMatches) {
        const transaction = match.transaction;
        
        // Add transfer pair information if matched
        if (match.matchId && match.confidence > 0.8) {
          transaction.transferPairId = match.matchId;
          transaction.needsReview = false; // High confidence transfers don't need review
        } else if (transaction.isTransfer) {
          transaction.needsReview = true; // Unmatched transfers need review
        }
        
        processedTransactions.push(transaction);
      }
      
      return processedTransactions;
    } catch (error) {
      console.error('Error processing transactions with transfer detection:', error);
      throw new Error('Failed to process transactions');
    }
  }
  
  // Get transfer summary for dashboard
  static async getTransferSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTransfers: number;
    internalTransfers: number;
    externalTransfers: number;
    unmatchedTransfers: number;
    transferAmount: number;
  }> {
    try {
      const transferTransactions = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.isTransfer, true),
            // Add date range filtering here if needed
          )
        );
      
      const summary = {
        totalTransfers: transferTransactions.length,
        internalTransfers: 0,
        externalTransfers: 0,
        unmatchedTransfers: 0,
        transferAmount: 0
      };
      
      for (const transaction of transferTransactions) {
        const amount = parseFloat(transaction.amount);
        summary.transferAmount += Math.abs(amount);
        
        if (transaction.transferType === 'internal') {
          summary.internalTransfers++;
        } else if (transaction.transferType === 'external') {
          summary.externalTransfers++;
        }
        
        if (!transaction.transferPairId) {
          summary.unmatchedTransfers++;
        }
      }
      
      return summary;
    } catch (error) {
      console.error('Error getting transfer summary:', error);
      return {
        totalTransfers: 0,
        internalTransfers: 0,
        externalTransfers: 0,
        unmatchedTransfers: 0,
        transferAmount: 0
      };
    }
  }
  
  // Disconnect a specific account while keeping others
  static async disconnectAccount(
    userId: string, 
    accountId: string
  ): Promise<void> {
    try {
      await db
        .update(bankConnections)
        .set({ 
          isActive: false
        })
        .where(
          and(
            eq(bankConnections.userId, userId),
            eq(bankConnections.accountId, accountId)
          )
        );
    } catch (error) {
      console.error('Error disconnecting account:', error);
      throw new Error('Failed to disconnect account');
    }
  }
}
