import { 
  users, 
  transactions, 
  receipts, 
  aiSuggestions, 
  chatMessages,
  bankConnections,
  chartOfAccounts,
  journalEntries,
  journalEntryLines,
  clients,
  invoices,
  invoiceItems,
  estimates,
  estimateItems,
  expenseCategories,
  recurringTransactions,
  collaborators,
  bankStatements,
  transactionClears,
  reviewItems,
  reviewMessages,
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
  type InsertRecurringTransaction,
  type ChartOfAccount,
  type InsertChartOfAccount,
  type Collaborator,
  type InsertCollaborator,
  type BankStatement,
  type InsertBankStatement,
  type TransactionClear,
  type InsertTransactionClear,
  type ReviewItem,
  type InsertReviewItem,
  type ReviewMessage,
  type InsertReviewMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByStripeSubscriptionId(subscriptionId: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeCustomerId: string, stripeSubscriptionId: string): Promise<User>;
  updateUserSubscriptionStatus(userId: string, status: string): Promise<User>;
  updateUserProfile(userId: string, updates: Partial<User>): Promise<User>;
  
  // Transaction methods
  getTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  getTransactionsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Transaction[]>;
  getTransactionByPlaidId(plaidTransactionId: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | null>;
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
    revenueChange?: number;
    expenseChange?: number;
    profitMargin?: number;
    transactionCount?: number;
  }>;
  getExpenseBreakdown(userId: string): Promise<any[]>;
  getMonthlyTrends(userId: string): Promise<any[]>;
  getAIInsights(userId: string): Promise<any[]>;
  
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
  
  // Chart of Accounts methods
  getChartOfAccounts(userId: string): Promise<ChartOfAccount[]>;
  createChartOfAccountsEntry(userId: string, account: InsertChartOfAccount): Promise<ChartOfAccount>;
  getBankAccountsForChartOfAccounts(userId: string): Promise<any[]>;

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

  // Collaborators
  createCollaborator(input: InsertCollaborator): Promise<Collaborator>;
  getCollaboratorsByOwner(ownerUserId: string): Promise<Collaborator[]>;
  updateCollaborator(ownerUserId: string, collaboratorId: string, updates: Partial<Collaborator>): Promise<Collaborator>;
  getCollaboratorByInviteToken(inviteToken: string): Promise<Collaborator | undefined>;
  hasActiveCollaboratorAccess(userId: string): Promise<boolean>;
  acceptCollaboratorInvite(inviteToken: string, collaboratorUserId: string): Promise<Collaborator | null>;
  deleteCollaborator(ownerUserId: string, collaboratorId: string): Promise<void>;

  // Reconciliation
  getBankStatement(ownerUserId: string, bankAccountId: string, statementMonth: Date): Promise<BankStatement | null>;
  upsertBankStatement(input: InsertBankStatement): Promise<BankStatement>;
  setTransactionClear(input: InsertTransactionClear): Promise<TransactionClear>;
  getTransactionClearsForStatement(bankStatementId: string): Promise<TransactionClear[]>;
  getUnclearedTransactions(ownerUserId: string, bankAccountId: string, statementEndDate: Date): Promise<Transaction[]>;
  getBookEndingBalance(ownerUserId: string, bankAccountId: string, statementEndDate: Date): Promise<number>;

  // Structured review
  createReviewItem(input: InsertReviewItem): Promise<ReviewItem>;
  updateReviewItem(id: string, updates: Partial<ReviewItem>): Promise<ReviewItem>;
  getOpenReviewItems(ownerUserId: string): Promise<ReviewItem[]>;
  createReviewMessage(input: InsertReviewMessage): Promise<ReviewMessage>;
  getReviewMessages(reviewItemId: string): Promise<ReviewMessage[]>;
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

  async getUserByStripeSubscriptionId(subscriptionId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.stripeSubscriptionId, subscriptionId));
    return user || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetPasswordToken, token));
    return user || undefined;
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
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

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getTransactions(userId: string, limit = 1000): Promise<Transaction[]> {
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
      .where(eq(transactions.bankTransactionId, plaidTransactionId));
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

  async getTransaction(id: string): Promise<Transaction | null> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction || null;
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
    revenueChange?: number;
    expenseChange?: number;
    profitMargin?: number;
    transactionCount?: number;
  }> {
    const result = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN is_expense = false AND is_transfer = false THEN amount::numeric ELSE 0 END), 0)`,
        totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN is_expense = true AND is_transfer = false THEN amount::numeric ELSE 0 END), 0)`,
        transactionCount: sql<number>`COUNT(*)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    const raw = result[0] || { totalRevenue: 0, totalExpenses: 0, transactionCount: 0 };
    const totalRevenue = parseFloat(String(raw.totalRevenue)) || 0;
    const totalExpenses = parseFloat(String(raw.totalExpenses)) || 0;
    const transactionCount = Number(raw.transactionCount) || 0;

    // Calculate previous period for comparison
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
    const prevEndDate = new Date(startDate);
    
    const prevResult = await db
      .select({
        totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN is_expense = false AND is_transfer = false THEN amount::numeric ELSE 0 END), 0)`,
        totalExpenses: sql<number>`COALESCE(SUM(CASE WHEN is_expense = true AND is_transfer = false THEN amount::numeric ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, prevStartDate),
          lte(transactions.date, prevEndDate)
        )
      );

    const prevRaw = prevResult[0] || { totalRevenue: 0, totalExpenses: 0 };
    const prevRevenue = parseFloat(String(prevRaw.totalRevenue)) || 0;
    const prevExpenses = parseFloat(String(prevRaw.totalExpenses)) || 0;

    // Calculate changes and metrics
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
    const expenseChange = prevExpenses > 0 ? ((totalExpenses - prevExpenses) / prevExpenses) * 100 : 0;
    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

    const netProfit = totalRevenue - totalExpenses;
    const gstOwing = totalRevenue * 0.13; // Assuming 13% GST/HST for Ontario

    return {
      totalRevenue,
      totalExpenses,
      netProfit,
      gstOwing,
      revenueChange,
      expenseChange,
      profitMargin,
      transactionCount,
    };
  }

  async getBankConnections(userId: string): Promise<BankConnection[]> {
    return await db
      .select()
      .from(bankConnections)
      .where(
        and(
          eq(bankConnections.userId, userId),
          eq(bankConnections.isActive, true)
        )
      )
      .orderBy(desc(bankConnections.createdAt));
  }

  async getBankConnectionsByItemId(userId: string, itemId: string): Promise<BankConnection[]> {
    return await db
      .select()
      .from(bankConnections)
      .where(
        and(
          eq(bankConnections.userId, userId),
          eq(bankConnections.plaidItemId, itemId),
          eq(bankConnections.isActive, true)
        )
      );
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

  async getBankConnectionByAccountId(userId: string, accountId: string): Promise<BankConnection | undefined> {
    const [connection] = await db
      .select()
      .from(bankConnections)
      .where(and(
        eq(bankConnections.userId, userId),
        eq(bankConnections.accountId, accountId),
      ));
    return connection || undefined;
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

  // Collaborators
  async createCollaborator(input: InsertCollaborator): Promise<Collaborator> {
    const [row] = await db.insert(collaborators).values(input).returning();
    return row;
  }

  async getCollaboratorsByOwner(ownerUserId: string): Promise<Collaborator[]> {
    return await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.ownerUserId, ownerUserId))
      .orderBy(desc(collaborators.createdAt));
  }

  async updateCollaborator(ownerUserId: string, collaboratorId: string, updates: Partial<Collaborator>): Promise<Collaborator> {
    const [row] = await db
      .update(collaborators)
      .set(updates)
      .where(and(
        eq(collaborators.ownerUserId, ownerUserId),
        eq(collaborators.id, collaboratorId)
      ))
      .returning();
    return row;
  }

  async getCollaboratorByInviteToken(inviteToken: string): Promise<Collaborator | undefined> {
    const [row] = await db
      .select()
      .from(collaborators)
      .where(eq(collaborators.inviteToken, inviteToken));
    return row || undefined;
  }

  async hasActiveCollaboratorAccess(userId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: collaborators.id })
      .from(collaborators)
      .where(and(
        eq(collaborators.collaboratorUserId, userId),
        eq(collaborators.status, "active")
      ))
      .limit(1);
    return Boolean(row);
  }

  async acceptCollaboratorInvite(inviteToken: string, collaboratorUserId: string): Promise<Collaborator | null> {
    const [row] = await db
      .update(collaborators)
      .set({
        collaboratorUserId,
        status: "active",
        inviteToken: null,
        inviteExpiresAt: null,
      })
      .where(eq(collaborators.inviteToken, inviteToken))
      .returning();
    return row || null;
  }

  async deleteCollaborator(ownerUserId: string, collaboratorId: string): Promise<void> {
    await db
      .delete(collaborators)
      .where(and(
        eq(collaborators.id, collaboratorId),
        eq(collaborators.ownerUserId, ownerUserId)
      ));
  }

  // Reconciliation
  async getBankStatement(ownerUserId: string, bankAccountId: string, statementMonth: Date): Promise<BankStatement | null> {
    const [row] = await db
      .select()
      .from(bankStatements)
      .where(and(
        eq(bankStatements.ownerUserId, ownerUserId),
        eq(bankStatements.bankAccountId, bankAccountId),
        eq(bankStatements.statementMonth, statementMonth)
      ));
    return row || null;
  }

  async upsertBankStatement(input: InsertBankStatement): Promise<BankStatement> {
    const existing = await this.getBankStatement(input.ownerUserId, input.bankAccountId, input.statementMonth as Date);
    if (existing) {
      const [updated] = await db
        .update(bankStatements)
        .set({
          statementEndDate: input.statementEndDate,
          endingBalance: input.endingBalance,
          currency: input.currency,
        })
        .where(eq(bankStatements.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(bankStatements).values(input).returning();
    return created;
  }

  async setTransactionClear(input: InsertTransactionClear): Promise<TransactionClear> {
    const [existing] = await db.select().from(transactionClears).where(and(
      eq(transactionClears.bankStatementId, input.bankStatementId),
      eq(transactionClears.transactionId, input.transactionId)
    ));

    if (existing) {
      const [updated] = await db
        .update(transactionClears)
        .set({ cleared: input.cleared })
        .where(eq(transactionClears.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(transactionClears).values(input).returning();
    return created;
  }

  async getTransactionClearsForStatement(bankStatementId: string): Promise<TransactionClear[]> {
    return await db
      .select()
      .from(transactionClears)
      .where(eq(transactionClears.bankStatementId, bankStatementId));
  }

  async getUnclearedTransactions(ownerUserId: string, bankAccountId: string, statementEndDate: Date): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(and(
        eq(transactions.userId, ownerUserId),
        eq(transactions.accountId, bankAccountId),
        lte(transactions.date, statementEndDate)
      ))
      .orderBy(desc(transactions.date));
  }

  async getBookEndingBalance(ownerUserId: string, bankAccountId: string, statementEndDate: Date): Promise<number> {
    const result = await db
      .select({
        sum: sql<string>`COALESCE(SUM(CAST(${transactions.amount} AS numeric)), 0)`,
      })
      .from(transactions)
      .where(and(
        eq(transactions.userId, ownerUserId),
        eq(transactions.accountId, bankAccountId),
        lte(transactions.date, statementEndDate)
      ));

    const raw = result[0]?.sum ?? "0";
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  // Structured review
  async createReviewItem(input: InsertReviewItem): Promise<ReviewItem> {
    const [row] = await db.insert(reviewItems).values(input).returning();
    return row;
  }

  async updateReviewItem(id: string, updates: Partial<ReviewItem>): Promise<ReviewItem> {
    const [row] = await db
      .update(reviewItems)
      .set(updates)
      .where(eq(reviewItems.id, id))
      .returning();
    return row;
  }

  async getOpenReviewItems(ownerUserId: string): Promise<ReviewItem[]> {
    return await db
      .select()
      .from(reviewItems)
      .where(and(
        eq(reviewItems.ownerUserId, ownerUserId),
        eq(reviewItems.status, "open")
      ))
      .orderBy(desc(reviewItems.createdAt));
  }

  async createReviewMessage(input: InsertReviewMessage): Promise<ReviewMessage> {
    const [row] = await db.insert(reviewMessages).values(input).returning();
    return row;
  }

  async getReviewMessages(reviewItemId: string): Promise<ReviewMessage[]> {
    return await db
      .select()
      .from(reviewMessages)
      .where(eq(reviewMessages.reviewItemId, reviewItemId))
      .orderBy(reviewMessages.createdAt);
  }

  // Chart of Accounts methods
  async getChartOfAccounts(userId: string): Promise<ChartOfAccount[]> {
    return await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.userId, userId));
  }

  async createChartOfAccountsEntry(userId: string, account: InsertChartOfAccount): Promise<ChartOfAccount> {
    const [created] = await db
      .insert(chartOfAccounts)
      .values({
        ...account,
        userId
      })
      .returning();
    
    return created;
  }

  async getBankAccountsForChartOfAccounts(userId: string): Promise<any[]> {
    const connections = await db
      .select()
      .from(bankConnections)
      .where(and(
        eq(bankConnections.userId, userId),
        eq(bankConnections.isActive, true)
      ))
      .orderBy(desc(bankConnections.createdAt));

    // Deduplicate: one entry per unique Plaid account_id, falling back to accountName
    // (handles cases where the same bank account was reconnected and got a new Plaid ID)
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const unique = connections.filter(conn => {
      if (conn.accountId && seenIds.has(conn.accountId)) return false;
      const nameKey = `${conn.bankName}::${conn.accountName}`;
      if (seenNames.has(nameKey)) return false;
      if (conn.accountId) seenIds.add(conn.accountId);
      seenNames.add(nameKey);
      return true;
    });

    return unique.map((conn, index) => ({
      id: `bank-${conn.id}`,
      name: `${conn.bankName} ${conn.accountName}`,
      category: conn.accountType === 'credit' ? 'LIABILITY' : 'ASSET',
      subcategory: conn.accountType === 'credit' ? 'Current Liabilities' : 'Current Assets',
      code: `${conn.accountType === 'credit' ? '2' : '1'}${String(index + 10).padStart(3, '0')}`,
      description: `${conn.accountType} account at ${conn.bankName}`,
      isActive: true,
      isBankAccount: true,
      bankConnectionId: conn.id,
      plaidAccountId: conn.accountId,
      taxSettings: { taxable: false, exempt: true, zeroRated: false },
      balance: 0,
    }));
  }

  // Get expense breakdown by category
  async getExpenseBreakdown(userId: string): Promise<any[]> {
    const expenseData = await db
      .select({
        category: transactions.category,
        amount: sql<number>`sum(cast(${transactions.amount} as decimal))`.as('amount'),
        count: sql<number>`count(*)`.as('count')
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.isExpense, true),
          eq(transactions.isTransfer, false)
        )
      )
      .groupBy(transactions.category)
      .orderBy(sql`sum(cast(${transactions.amount} as decimal)) desc`);

    const total = expenseData.reduce((sum, t) => sum + t.amount, 0);
    
    return expenseData.map(t => ({
      category: t.category || 'Uncategorized',
      amount: t.amount,
      count: t.count,
      percentage: total > 0 ? (t.amount / total) * 100 : 0
    }));
  }

  // Get monthly trends
  async getMonthlyTrends(userId: string): Promise<any[]> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await db
      .select({
        month: sql<string>`to_char(${transactions.date}, 'Mon YYYY')`.as('month'),
        yearMonth: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`.as('year_month'),
        revenue: sql<number>`sum(case when ${transactions.isExpense} = false and ${transactions.isTransfer} = false then cast(${transactions.amount} as decimal) else 0 end)`.as('revenue'),
        expenses: sql<number>`sum(case when ${transactions.isExpense} = true and ${transactions.isTransfer} = false then cast(${transactions.amount} as decimal) else 0 end)`.as('expenses')
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, sixMonthsAgo)
        )
      )
      .groupBy(sql`to_char(${transactions.date}, 'YYYY-MM')`, sql`to_char(${transactions.date}, 'Mon YYYY')`)
      .orderBy(sql`to_char(${transactions.date}, 'YYYY-MM')`);

    return monthlyData.map(m => ({
      month: m.month,
      revenue: m.revenue,
      expenses: m.expenses,
      profit: m.revenue - m.expenses
    }));
  }

  // Get AI insights
  async getAIInsights(userId: string): Promise<any[]> {
    // Get recent transactions and analyze patterns
    const recentTransactions = await this.getTransactions(userId, 50);
    const insights = [];

    // Calculate expense trends
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
    const thisMonthExpenses = recentTransactions
      .filter(t => t.isExpense && new Date(t.date) >= lastMonth)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const prevMonthExpenses = recentTransactions
      .filter(t => t.isExpense && new Date(t.date) < lastMonth)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    // Expense increase warning
    const safeExpensePct = (curr: number, prev: number): string => {
      if (!prev || !isFinite(curr / prev)) return 'significantly';
      return `${((curr - prev) / prev * 100).toFixed(1)}%`;
    };
    if (prevMonthExpenses > 0 && thisMonthExpenses > prevMonthExpenses * 1.2) {
      insights.push({
        type: 'warning',
        title: 'Expense Increase Alert',
        description: `Your expenses increased by ${safeExpensePct(thisMonthExpenses, prevMonthExpenses)} compared to the previous period.`,
        impact: 'high',
        confidence: 0.9,
        category: 'Expense Management'
      });
    } else if (prevMonthExpenses === 0 && thisMonthExpenses > 0) {
      insights.push({
        type: 'trend',
        title: 'New Expenses Recorded',
        description: `You have $${thisMonthExpenses.toFixed(2)} in expenses this period with no prior-period data to compare against.`,
        impact: 'low',
        confidence: 0.8,
        category: 'Expense Management'
      });
    }

    // Categorization opportunity
    const uncategorized = recentTransactions.filter(t => !t.category && !t.aiCategory).length;
    if (uncategorized > 5) {
      insights.push({
        type: 'opportunity',
        title: 'Improve Categorization',
        description: `You have ${uncategorized} uncategorized transactions. Better categorization improves tax compliance.`,
        impact: 'medium',
        confidence: 0.95,
        category: 'Tax Compliance'
      });
    }

    // Revenue achievement
    const revenue = recentTransactions
      .filter(t => !t.isExpense && !t.isTransfer)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    if (revenue > 10000) {
      insights.push({
        type: 'achievement',
        title: 'Strong Revenue Performance',
        description: `Great job! You've generated $${revenue.toLocaleString()} in revenue recently.`,
        impact: 'high',
        confidence: 1.0,
        category: 'Business Growth'
      });
    }

    return insights;
  }
}

export const storage = new DatabaseStorage();
