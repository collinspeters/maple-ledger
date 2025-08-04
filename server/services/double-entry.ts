// Double-entry accounting service for BookkeepAI
import { db } from "../db";
import { chartOfAccounts, journalEntries, journalEntryLines, transactions } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { findAccountByT2125Category } from "@shared/chart-of-accounts";

interface DoubleEntryTransaction {
  transactionId: string;
  userId: string;
  amount: number;
  date: Date;
  description: string;
  bankAccountId: string; // COA ID for the bank account
  categoryAccountId?: string; // COA ID for expense/revenue account
  category?: string; // T2125 category
  isExpense: boolean;
  isTransfer: boolean;
}

interface JournalEntryLine {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  description: string;
}

export class DoubleEntryService {
  
  /**
   * Creates a double-entry journal entry for a transaction
   * Follows standard accounting rules:
   * - Assets increase with debits, decrease with credits
   * - Liabilities increase with credits, decrease with debits  
   * - Expenses increase with debits
   * - Revenue increases with credits
   */
  async createJournalEntry(transaction: DoubleEntryTransaction): Promise<string> {
    const lines: JournalEntryLine[] = [];
    
    if (transaction.isTransfer) {
      // Transfers don't affect expense/revenue accounts
      // They're between two balance sheet accounts (bank accounts)
      return ""; // Handle transfers separately
    }

    // Get bank account from Chart of Accounts
    const bankAccount = await this.getBankAccountFromCOA(transaction.userId, transaction.bankAccountId);
    if (!bankAccount) {
      throw new Error("Bank account not found in Chart of Accounts");
    }

    // Get category account from Chart of Accounts
    let categoryAccount;
    if (transaction.category) {
      categoryAccount = await this.getCategoryAccountFromT2125(transaction.userId, transaction.category);
    }
    
    if (!categoryAccount) {
      throw new Error(`Category account not found for: ${transaction.category}`);
    }

    const amount = Math.abs(transaction.amount);

    if (transaction.isExpense) {
      // Example: $75 lunch from TD Chequing
      // DR: Meals & Entertainment (Expense) $75
      // CR: TD Chequing (Asset) $75
      
      lines.push({
        accountId: categoryAccount.id,
        debitAmount: amount,
        creditAmount: 0,
        description: `${transaction.description} - Expense`
      });
      
      lines.push({
        accountId: bankAccount.id,
        debitAmount: 0,
        creditAmount: amount,
        description: `${transaction.description} - Payment from ${bankAccount.name}`
      });
    } else {
      // Revenue transaction
      // Example: $1000 client payment to PayPal
      // DR: PayPal (Asset) $1000
      // CR: Service Income (Revenue) $1000
      
      lines.push({
        accountId: bankAccount.id,
        debitAmount: amount,
        creditAmount: 0,
        description: `${transaction.description} - Deposit to ${bankAccount.name}`
      });
      
      lines.push({
        accountId: categoryAccount.id,
        debitAmount: 0,
        creditAmount: amount,
        description: `${transaction.description} - Revenue`
      });
    }

    // Create journal entry
    const entryNumber = await this.generateEntryNumber(transaction.userId);
    
    const [journalEntry] = await db
      .insert(journalEntries)
      .values({
        userId: transaction.userId,
        transactionId: transaction.transactionId,
        entryNumber,
        date: transaction.date,
        description: transaction.description,
        totalAmount: amount.toString()
      })
      .returning();

    // Create journal entry lines
    for (let i = 0; i < lines.length; i++) {
      await db.insert(journalEntryLines).values({
        journalEntryId: journalEntry.id,
        accountId: lines[i].accountId,
        debitAmount: lines[i].debitAmount.toString(),
        creditAmount: lines[i].creditAmount.toString(),
        description: lines[i].description,
        lineNumber: i + 1
      });
    }

    // Update transaction as posted
    await db
      .update(transactions)
      .set({ 
        journalEntryId: journalEntry.id,
        isPosted: true 
      })
      .where(eq(transactions.id, transaction.transactionId));

    // Update account balances
    await this.updateAccountBalances(lines);

    return journalEntry.id;
  }

  private async getBankAccountFromCOA(userId: string, bankConnectionId: string) {
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.userId, userId),
        eq(chartOfAccounts.bankConnectionId, bankConnectionId),
        eq(chartOfAccounts.isBankAccount, true)
      ))
      .limit(1);
    
    return account;
  }

  private async getCategoryAccountFromT2125(userId: string, t2125Category: string) {
    const [account] = await db
      .select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.userId, userId),
        eq(chartOfAccounts.t2125Category, t2125Category)
      ))
      .limit(1);
    
    return account;
  }

  private async generateEntryNumber(userId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const count = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId));
    
    const nextNumber = count.length + 1;
    return `JE-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
  }

  private async updateAccountBalances(lines: JournalEntryLine[]) {
    for (const line of lines) {
      const netAmount = line.debitAmount - line.creditAmount;
      
      await db
        .update(chartOfAccounts)
        .set({
          balance: sql`balance + ${netAmount}`
        })
        .where(eq(chartOfAccounts.id, line.accountId));
    }
  }

  /**
   * Creates Chart of Accounts entry for a bank account
   */
  async createBankAccountInCOA(userId: string, bankConnection: any) {
    const code = bankConnection.accountType === 'credit' ? 
      `2${String(Math.floor(Math.random() * 900) + 100)}` : // 2xxx for liabilities
      `1${String(Math.floor(Math.random() * 900) + 100)}`; // 1xxx for assets

    const [account] = await db
      .insert(chartOfAccounts)
      .values({
        userId,
        code,
        name: `${bankConnection.bankName} ${bankConnection.accountName}`,
        category: bankConnection.accountType === 'credit' ? 'LIABILITY' : 'ASSET',
        subcategory: bankConnection.accountType === 'credit' ? 'Current Liabilities' : 'Current Assets',
        description: `${bankConnection.accountType} account at ${bankConnection.bankName}`,
        isActive: true,
        isBankAccount: true,
        bankConnectionId: bankConnection.id,
        plaidAccountId: bankConnection.accountId,
        taxable: false,
        exempt: true,
        zeroRated: false,
        balance: "0"
      })
      .returning();

    return account;
  }

  /**
   * Processes a transaction for double-entry posting
   */
  async processTransactionForPosting(transactionId: string) {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, transactionId));

    if (!transaction || transaction.isPosted) {
      return; // Already posted or not found
    }

    if (transaction.isTransfer) {
      // Handle transfer logic separately
      return;
    }

    // Find or create bank account in COA
    let bankAccountId = "";
    if (transaction.bankConnectionId) {
      const bankCOAAccount = await this.getBankAccountFromCOA(transaction.userId, transaction.bankConnectionId);
      bankAccountId = bankCOAAccount?.id || "";
    }

    await this.createJournalEntry({
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: parseFloat(transaction.amount),
      date: transaction.date,
      description: transaction.description,
      bankAccountId,
      category: transaction.aiCategory || transaction.category || "",
      isExpense: transaction.isExpense,
      isTransfer: transaction.isTransfer
    });
  }
}

export const doubleEntryService = new DoubleEntryService();