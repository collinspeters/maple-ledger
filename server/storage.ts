import { 
  users, 
  transactions, 
  receipts, 
  aiSuggestions, 
  chatMessages,
  bankConnections,
  clients,
  invoices,
  invoiceItems,
  estimates,
  estimateItems,
  expenseCategories,
  recurringTransactions,
  type User, 
  type InsertUser,
  type Transaction,
  type InsertTransaction,
  type Receipt,
  type InsertReceipt,
  type AiSuggestion,
  type InsertAiSuggestion,
  type ChatMessage,
  type InsertChatMessage,
  type BankConnection,
  type InsertBankConnection,
  type Client,
  type InsertClient,
  type Invoice,
  type InsertInvoice,
  type InvoiceItem,
  type InsertInvoiceItem,
  type Estimate,
  type InsertEstimate,
  type EstimateItem,
  type InsertEstimateItem,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type RecurringTransaction,
  type InsertRecurringTransaction
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  updateUserSubscriptionStatus(userId: string, status: string): Promise<User>;
  
  // Transaction methods
  getTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]>;
  getTransactionByPlaidId(plaidTransactionId: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  deleteTransaction(id: string): Promise<void>;
  
  // Receipt methods
  getReceipts(userId: string): Promise<Receipt[]>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt>;
  getUnmatchedReceipts(userId: string): Promise<Receipt[]>;
  
  // AI Suggestion methods
  createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion>;
  getAiSuggestionsForTransaction(transactionId: string): Promise<AiSuggestion[]>;
  
  // Chat methods
  getChatHistory(userId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Financial analytics
  getFinancialSummary(userId: string, startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    gstOwing: number;
  }>;
  
  // Bank connections
  getBankConnections(userId: string): Promise<BankConnection[]>;
  createBankConnection(connection: InsertBankConnection): Promise<BankConnection>;
  updateBankConnection(id: string, updates: Partial<BankConnection>): Promise<BankConnection>;
  deleteBankConnection(id: string): Promise<void>;
  getBankConnectionByPlaidItemId(plaidItemId: string): Promise<BankConnection | undefined>;

  // Client methods
  getClients(userId: string): Promise<Client[]>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, updates: Partial<Client>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  // Invoice methods  
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  markInvoicePaid(id: string): Promise<Invoice>;

  // Estimate methods
  getEstimates(userId: string): Promise<Estimate[]>;
  getEstimate(id: string): Promise<Estimate | undefined>;
  createEstimate(estimate: InsertEstimate, items: InsertEstimateItem[]): Promise<Estimate>;
  updateEstimate(id: string, updates: Partial<Estimate>): Promise<Estimate>;
  deleteEstimate(id: string): Promise<void>;
  convertEstimateToInvoice(estimateId: string): Promise<Invoice>;

  // Expense categories
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;

  // Recurring transactions
  getRecurringTransactions(userId: string): Promise<RecurringTransaction[]>;
  createRecurringTransaction(transaction: InsertRecurringTransaction): Promise<RecurringTransaction>;
  updateRecurringTransaction(id: string, updates: Partial<RecurringTransaction>): Promise<RecurringTransaction>;
  deleteRecurringTransaction(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial
    
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        subscriptionStatus: "trial",
        trialEndsAt,
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        stripeCustomerId, 
        stripeSubscriptionId,
        subscriptionStatus: "active",
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserSubscriptionStatus(userId: string, status: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        subscriptionStatus: status,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getTransactions(userId: string, limit = 50): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date))
      .limit(limit);
  }

  async getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .orderBy(desc(transactions.date));
  }

  async getTransactionByPlaidId(plaidTransactionId: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.plaidTransactionId, plaidTransactionId));
    return transaction || undefined;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db
      .insert(transactions)
      .values(transaction)
      .returning();
    return newTransaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

  async deleteTransaction(id: string): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async getReceipts(userId: string): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(eq(receipts.userId, userId))
      .orderBy(desc(receipts.createdAt));
  }

  async createReceipt(receipt: InsertReceipt): Promise<Receipt> {
    const [newReceipt] = await db
      .insert(receipts)
      .values(receipt)
      .returning();
    return newReceipt;
  }

  async updateReceipt(id: string, updates: Partial<Receipt>): Promise<Receipt> {
    const [receipt] = await db
      .update(receipts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(receipts.id, id))
      .returning();
    return receipt;
  }

  async getReceiptById(id: string): Promise<Receipt | null> {
    const [receipt] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, id))
      .limit(1);
    return receipt || null;
  }

  async deleteReceipt(id: string): Promise<void> {
    await db.delete(receipts).where(eq(receipts.id, id));
  }

  async getUnmatchedReceipts(userId: string): Promise<Receipt[]> {
    return await db
      .select()
      .from(receipts)
      .where(
        and(
          eq(receipts.userId, userId),
          eq(receipts.isMatched, false)
        )
      )
      .orderBy(desc(receipts.createdAt));
  }

  async createAiSuggestion(suggestion: InsertAiSuggestion): Promise<AiSuggestion> {
    const [newSuggestion] = await db
      .insert(aiSuggestions)
      .values(suggestion)
      .returning();
    return newSuggestion;
  }

  async getAiSuggestionsForTransaction(transactionId: string): Promise<AiSuggestion[]> {
    return await db
      .select()
      .from(aiSuggestions)
      .where(eq(aiSuggestions.transactionId, transactionId))
      .orderBy(desc(aiSuggestions.createdAt));
  }

  async getChatHistory(userId: string, limit = 20): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getFinancialSummary(userId: string, startDate: Date, endDate: Date): Promise<{
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    gstOwing: number;
  }> {
    const result = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN is_expense = false THEN amount::numeric ELSE 0 END), 0)`,
        totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN is_expense = true THEN amount::numeric ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    const { totalRevenue, totalExpenses } = result[0] || { totalRevenue: 0, totalExpenses: 0 };
    const netProfit = totalRevenue - totalExpenses;
    const gstOwing = totalRevenue * 0.13; // Assuming 13% GST/HST for Ontario

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      gstOwing,
    };
  }

  async getBankConnections(userId: string): Promise<BankConnection[]> {
    return await db
      .select()
      .from(bankConnections)
      .where(eq(bankConnections.userId, userId))
      .orderBy(desc(bankConnections.createdAt));
  }

  async createBankConnection(connection: InsertBankConnection): Promise<BankConnection> {
    const [newConnection] = await db
      .insert(bankConnections)
      .values(connection)
      .returning();
    return newConnection;
  }

  async updateBankConnection(id: string, updates: Partial<BankConnection>): Promise<BankConnection> {
    const [connection] = await db
      .update(bankConnections)
      .set(updates)
      .where(eq(bankConnections.id, id))
      .returning();
    return connection;
  }

  async deleteBankConnection(id: string): Promise<void> {
    await db.delete(bankConnections).where(eq(bankConnections.id, id));
  }

  async getBankConnectionByPlaidItemId(plaidItemId: string): Promise<BankConnection | undefined> {
    const [connection] = await db
      .select()
      .from(bankConnections)
      .where(eq(bankConnections.plaidItemId, plaidItemId));
    return connection || undefined;
  }

  // Client methods
  async getClients(userId: string): Promise<Client[]> {
    return await db.select().from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(desc(clients.createdAt));
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db.insert(clients).values(client).returning();
    return newClient;
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const [updatedClient] = await db.update(clients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Invoice methods
  async getInvoices(userId: string): Promise<Invoice[]> {
    return await db.select().from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice || undefined;
  }

  async createInvoice(invoice: InsertInvoice, items: InsertInvoiceItem[]): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();
    
    if (items.length > 0) {
      await db.insert(invoiceItems).values(
        items.map(item => ({ ...item, invoiceId: newInvoice.id }))
      );
    }
    
    return newInvoice;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    const [updatedInvoice] = await db.update(invoices)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  async markInvoicePaid(id: string): Promise<Invoice> {
    const [paidInvoice] = await db.update(invoices)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    return paidInvoice;
  }

  // Estimate methods
  async getEstimates(userId: string): Promise<Estimate[]> {
    return await db.select().from(estimates)
      .where(eq(estimates.userId, userId))
      .orderBy(desc(estimates.createdAt));
  }

  async getEstimate(id: string): Promise<Estimate | undefined> {
    const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id));
    return estimate || undefined;
  }

  async createEstimate(estimate: InsertEstimate, items: InsertEstimateItem[]): Promise<Estimate> {
    const [newEstimate] = await db.insert(estimates).values(estimate).returning();
    
    if (items.length > 0) {
      await db.insert(estimateItems).values(
        items.map(item => ({ ...item, estimateId: newEstimate.id }))
      );
    }
    
    return newEstimate;
  }

  async updateEstimate(id: string, updates: Partial<Estimate>): Promise<Estimate> {
    const [updatedEstimate] = await db.update(estimates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(estimates.id, id))
      .returning();
    return updatedEstimate;
  }

  async deleteEstimate(id: string): Promise<void> {
    await db.delete(estimateItems).where(eq(estimateItems.estimateId, id));
    await db.delete(estimates).where(eq(estimates.id, id));
  }

  async convertEstimateToInvoice(estimateId: string): Promise<Invoice> {
    const estimate = await this.getEstimate(estimateId);
    if (!estimate) throw new Error("Estimate not found");

    const estimateItemsData = await db.select().from(estimateItems)
      .where(eq(estimateItems.estimateId, estimateId));

    // Generate invoice number
    const invoiceCount = await db.select({ count: sql`count(*)` }).from(invoices)
      .where(eq(invoices.userId, estimate.userId));
    const invoiceNumber = `INV-${String(Number(invoiceCount[0].count) + 1).padStart(4, '0')}`;

    const invoiceData: InsertInvoice = {
      userId: estimate.userId,
      clientId: estimate.clientId,
      invoiceNumber,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      subtotal: estimate.subtotal,
      taxAmount: estimate.taxAmount,
      totalAmount: estimate.totalAmount,
      notes: estimate.notes,
    };

    const invoice = await this.createInvoice(invoiceData, estimateItemsData.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      taxable: item.taxable,
      invoiceId: "", // This will be set by createInvoice
    })));

    // Mark estimate as accepted and link to invoice
    await this.updateEstimate(estimateId, {
      status: "accepted",
      acceptedAt: new Date(),
      convertedInvoiceId: invoice.id,
    });

    return invoice;
  }

  // Expense categories
  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories)
      .orderBy(expenseCategories.name);
  }

  async createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory> {
    const [newCategory] = await db.insert(expenseCategories).values(category).returning();
    return newCategory;
  }

  // Recurring transactions
  async getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    return await db.select().from(recurringTransactions)
      .where(eq(recurringTransactions.userId, userId))
      .orderBy(desc(recurringTransactions.createdAt));
  }

  async createRecurringTransaction(transaction: InsertRecurringTransaction): Promise<RecurringTransaction> {
    const [newTransaction] = await db.insert(recurringTransactions).values(transaction).returning();
    return newTransaction;
  }

  async updateRecurringTransaction(id: string, updates: Partial<RecurringTransaction>): Promise<RecurringTransaction> {
    const [updatedTransaction] = await db.update(recurringTransactions)
      .set(updates)
      .where(eq(recurringTransactions.id, id))
      .returning();
    return updatedTransaction;
  }

  async deleteRecurringTransaction(id: string): Promise<void> {
    await db.delete(recurringTransactions).where(eq(recurringTransactions.id, id));
  }
}

export const storage = new DatabaseStorage();
