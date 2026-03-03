import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  businessName: text("business_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  province: text("province"),
  address: text("address"),
  fiscalYearStart: timestamp("fiscal_year_start"),
  gstRegistered: boolean("gst_registered").default(false),
  gstNumber: text("gst_number"),
  gstFilingFrequency: text("gst_filing_frequency").default("annual"),
  emailVerifiedAt: timestamp("email_verified_at"),
  emailVerificationToken: text("email_verification_token"),
  resetPasswordToken: text("reset_password_token"),
  resetPasswordExpiresAt: timestamp("reset_password_expires_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("trial"), // trial, active, inactive, cancelled
  trialEndsAt: timestamp("trial_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  vendor: text("vendor"),
  category: text("category"),
  aiCategory: text("ai_category"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  aiExplanation: text("ai_explanation"),
  needsReview: boolean("needs_review").default(false),
  userOverride: boolean("user_override").default(false),
  isReviewed: boolean("is_reviewed").default(false),
  txnKind: text("txn_kind"), // expense | income | transfer | equity
  equityType: text("equity_type"), // owner_draw | owner_contribution
  isExpense: boolean("is_expense").default(true),
  receiptId: varchar("receipt_id"), // Will reference receipts.id  
  receiptAttached: boolean("receipt_attached").default(false),
  receiptSource: text("receipt_source"), // upload, bank_feed, manual
  bankTransactionId: text("bank_transaction_id"),
  bankConnectionId: varchar("bank_connection_id").references(() => bankConnections.id),
  accountId: text("account_id"), // Plaid account ID for linking
  isTransfer: boolean("is_transfer").default(false),
  transferPairId: varchar("transfer_pair_id"), // Links matching transfer transactions
  transferType: text("transfer_type"), // 'internal', 'external', 'payment'
  extractedTaxData: jsonb("extracted_tax_data"), // GST/HST/PST breakdown
  auditReady: boolean("audit_ready").default(false),
  notes: text("notes"),
  // Additional categorization fields
  plaidCategory: text("plaid_category"), // Original Plaid category
  paymentChannel: text("payment_channel"), // online, in-store, etc.
  location: text("location"), // JSON string of transaction location
  categorizationMethod: text("categorization_method"), // transfer_detection, merchant_mapping, plaid_rules, ai_enhanced, ai_fallback
  // Double-entry accounting fields  
  journalEntryId: varchar("journal_entry_id"), // Will reference journalEntries.id when defined
  isPosted: boolean("is_posted").default(false), // Whether double-entry posting is complete
  // Chart of accounts reference
  chartAccountId: varchar("chart_account_id"), // Reference to chart_of_accounts.id
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  ocrData: jsonb("ocr_data"),
  extractedAmount: decimal("extracted_amount", { precision: 10, scale: 2 }),
  extractedVendor: text("extracted_vendor"),
  extractedDate: timestamp("extracted_date"),
  extractedTax: decimal("extracted_tax", { precision: 10, scale: 2 }),
  extractedCurrency: text("extracted_currency").default("CAD"),
  extractedLineItems: jsonb("extracted_line_items"),
  isMatched: boolean("is_matched").default(false),
  matchedTransactionId: varchar("matched_transaction_id"),
  matchConfidence: decimal("match_confidence", { precision: 3, scale: 2 }),
  suggestedMatches: jsonb("suggested_matches"), // Array of suggested transaction matches
  status: text("status").default("processing"), // processing, processed, matched, unmatched, failed
  processingError: text("processing_error"),
  notes: text("notes"),
  tags: text("tags").array(),
  isAuditReady: boolean("is_audit_ready").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiSuggestions = pgTable("ai_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  receiptId: varchar("receipt_id").references(() => receipts.id),
  suggestionType: text("suggestion_type").notNull(), // categorization, matching, chat_response
  originalPrompt: text("original_prompt"),
  aiResponse: jsonb("ai_response"),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  isAccepted: boolean("is_accepted"),
  userOverride: text("user_override"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bankConnections = pgTable("bank_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plaidItemId: text("plaid_item_id").notNull(),
  plaidAccessToken: text("plaid_access_token").notNull(),
  accessToken: text("access_token"), // Keep existing column
  bankName: text("bank_name").notNull(),
  accountType: text("account_type").notNull(),
  accountId: text("account_id").notNull(),
  accountName: text("account_name").notNull(),
  accountMask: text("account_mask"),
  lastSyncAt: timestamp("last_sync_at"),
  syncCursor: text("sync_cursor"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  response: text("response"),
  isFromUser: boolean("is_from_user").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chartOfAccounts = pgTable("chart_of_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Assets, Liabilities, Equity, Revenue, Expenses
  subcategory: text("subcategory"),
  description: text("description"),
  isDeductible: boolean("is_deductible").default(false),
  deductionRate: decimal("deduction_rate", { precision: 5, scale: 2 }),
  t2125Category: text("t2125_category"),
  isActive: boolean("is_active").default(true),
  parentId: varchar("parent_id"), // For sub-accounts
  isBankAccount: boolean("is_bank_account").default(false),
  bankConnectionId: varchar("bank_connection_id").references(() => bankConnections.id),
  plaidAccountId: text("plaid_account_id"),
  taxable: boolean("taxable").default(false),
  exempt: boolean("exempt").default(false),
  zeroRated: boolean("zero_rated").default(false),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoicing tables - Wave-inspired
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id),
  businessName: text("businessName").notNull(),
  contactName: text("contactName"),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postalCode"),
  country: text("country").default("Canada"),
  currency: text("currency").default("CAD"),
  paymentTerms: integer("paymentTerms").default(30), // days
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id),
  clientId: varchar("clientId").notNull().references(() => clients.id),
  invoiceNumber: text("invoiceNumber").notNull(),
  status: text("status").default("draft"), // draft, sent, paid, overdue, cancelled
  issueDate: timestamp("issueDate").notNull(),
  dueDate: timestamp("dueDate").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  paidAt: timestamp("paidAt"),
  currency: text("currency").default("CAD"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const invoiceItems = pgTable("invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoiceId").notNull().references(() => invoices.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  taxable: boolean("taxable").default(true),
});

export const estimates = pgTable("estimates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull().references(() => users.id),
  clientId: varchar("clientId").notNull().references(() => clients.id),
  estimateNumber: text("estimateNumber").notNull(),
  status: text("status").default("draft"), // draft, sent, accepted, declined, expired
  issueDate: timestamp("issueDate").notNull(),
  expiryDate: timestamp("expiryDate").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("taxAmount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  acceptedAt: timestamp("acceptedAt"),
  convertedInvoiceId: varchar("convertedInvoiceId"),
  currency: text("currency").default("CAD"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

export const estimateItems = pgTable("estimate_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  estimateId: varchar("estimateId").notNull().references(() => estimates.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1"),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).notNull(),
  taxable: boolean("taxable").default(true),
});

// Expense categories for Canadian tax compliance
export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  taxDeductible: boolean("tax_deductible").default(true),
  craCode: text("cra_code"), // Canada Revenue Agency expense code
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Recurring transactions for subscriptions, rent, etc.
export const recurringTransactions = pgTable("recurring_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  vendor: text("vendor"),
  category: text("category"),
  frequency: text("frequency").notNull(), // daily, weekly, monthly, quarterly, yearly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  lastProcessed: timestamp("last_processed"),
  isActive: boolean("is_active").default(true),
  isExpense: boolean("is_expense").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});



// Journal Entries for double-entry accounting
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  entryNumber: text("entry_number").notNull(), // JE-001, JE-002, etc.
  date: timestamp("date").notNull(),
  description: text("description").notNull(),
  reference: text("reference"), // Check number, invoice number, etc.
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  isReversed: boolean("is_reversed").default(false),
  reversalEntryId: varchar("reversal_entry_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Journal Entry Lines for double-entry details
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: varchar("journal_entry_id").notNull().references(() => journalEntries.id),
  accountId: varchar("account_id").notNull().references(() => chartOfAccounts.id),
  debitAmount: decimal("debit_amount", { precision: 15, scale: 2 }).default("0"),
  creditAmount: decimal("credit_amount", { precision: 15, scale: 2 }).default("0"),
  description: text("description"),
  lineNumber: integer("line_number").notNull(),
});

// Audit log — immutable record of user actions on key entities
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  event: text("event").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Collaborator access (owner invites accountant/bookkeeper)
export const collaborators = pgTable("collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  collaboratorUserId: varchar("collaborator_user_id").references(() => users.id),
  role: text("role").notNull(), // accountant | bookkeeper
  status: text("status").notNull().default("invited"), // invited | active
  invitedEmail: text("invited_email").notNull(),
  inviteToken: text("invite_token"),
  inviteExpiresAt: timestamp("invite_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Monthly statement anchor for reconciliation
export const bankStatements = pgTable("bank_statements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  bankAccountId: text("bank_account_id").notNull(), // plaid account id
  statementMonth: timestamp("statement_month").notNull(), // first day of month
  statementEndDate: timestamp("statement_end_date").notNull(),
  endingBalance: decimal("ending_balance", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("CAD"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cleared flags per statement
export const transactionClears = pgTable("transaction_clears", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  bankStatementId: varchar("bank_statement_id").notNull().references(() => bankStatements.id),
  transactionId: varchar("transaction_id").notNull().references(() => transactions.id),
  cleared: boolean("cleared").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Structured review queue (kept additive with existing needsReview flow)
export const reviewItems = pgTable("review_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerUserId: varchar("owner_user_id").notNull().references(() => users.id),
  status: text("status").notNull().default("open"), // open | skipped | resolved
  kind: text("kind").notNull(), // txn_kind | category | receipt_match | reconciliation
  entityType: text("entity_type").notNull(), // transaction | receipt | bank_statement
  entityId: varchar("entity_id").notNull(),
  prompt: text("prompt").notNull(),
  optionsJson: jsonb("options_json"),
  modelSuggestionJson: jsonb("model_suggestion_json"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const reviewMessages = pgTable("review_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewItemId: varchar("review_item_id").notNull().references(() => reviewItems.id),
  role: text("role").notNull(), // system | user
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  receipts: many(receipts),
  aiSuggestions: many(aiSuggestions),
  bankConnections: many(bankConnections),
  chatMessages: many(chatMessages),
  ownedCollaborators: many(collaborators),
  bankStatements: many(bankStatements),
  transactionClears: many(transactionClears),
  reviewItems: many(reviewItems),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  receipt: one(receipts, {
    fields: [transactions.receiptId],
    references: [receipts.id],
  }),
  aiSuggestions: many(aiSuggestions),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  user: one(users, {
    fields: [receipts.userId],
    references: [users.id],
  }),
  matchedTransaction: one(transactions, {
    fields: [receipts.matchedTransactionId],
    references: [transactions.id],
  }),
  aiSuggestions: many(aiSuggestions),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  user: one(users, {
    fields: [clients.userId],
    references: [users.id],
  }),
  invoices: many(invoices),
  estimates: many(estimates),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));

export const estimatesRelations = relations(estimates, ({ one, many }) => ({
  user: one(users, {
    fields: [estimates.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [estimates.clientId],
    references: [clients.id],
  }),
  items: many(estimateItems),
}));

export const estimateItemsRelations = relations(estimateItems, ({ one }) => ({
  estimate: one(estimates, {
    fields: [estimateItems.estimateId],
    references: [estimates.id],
  }),
}));

export const recurringTransactionsRelations = relations(recurringTransactions, ({ one }) => ({
  user: one(users, {
    fields: [recurringTransactions.userId],
    references: [users.id],
  }),
}));

export const collaboratorsRelations = relations(collaborators, ({ one }) => ({
  owner: one(users, {
    fields: [collaborators.ownerUserId],
    references: [users.id],
  }),
  collaborator: one(users, {
    fields: [collaborators.collaboratorUserId],
    references: [users.id],
  }),
}));

export const bankStatementsRelations = relations(bankStatements, ({ one, many }) => ({
  owner: one(users, {
    fields: [bankStatements.ownerUserId],
    references: [users.id],
  }),
  clears: many(transactionClears),
}));

export const transactionClearsRelations = relations(transactionClears, ({ one }) => ({
  owner: one(users, {
    fields: [transactionClears.ownerUserId],
    references: [users.id],
  }),
  statement: one(bankStatements, {
    fields: [transactionClears.bankStatementId],
    references: [bankStatements.id],
  }),
  transaction: one(transactions, {
    fields: [transactionClears.transactionId],
    references: [transactions.id],
  }),
}));

export const reviewItemsRelations = relations(reviewItems, ({ one, many }) => ({
  owner: one(users, {
    fields: [reviewItems.ownerUserId],
    references: [users.id],
  }),
  messages: many(reviewMessages),
}));

export const reviewMessagesRelations = relations(reviewMessages, ({ one }) => ({
  item: one(reviewItems, {
    fields: [reviewMessages.reviewItemId],
    references: [reviewItems.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
  trialEndsAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  date: z.string().transform((str) => new Date(str)),
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiSuggestionSchema = createInsertSchema(aiSuggestions).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertBankConnectionSchema = createInsertSchema(bankConnections).omit({
  id: true,
  createdAt: true,
});

export const insertChartOfAccountsSchema = createInsertSchema(chartOfAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItems).omit({
  id: true,
});

export const insertEstimateSchema = createInsertSchema(estimates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEstimateItemSchema = createInsertSchema(estimateItems).omit({
  id: true,
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
});

export const insertRecurringTransactionSchema = createInsertSchema(recurringTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCollaboratorSchema = createInsertSchema(collaborators).omit({
  id: true,
  createdAt: true,
});

export const insertBankStatementSchema = createInsertSchema(bankStatements).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionClearSchema = createInsertSchema(transactionClears).omit({
  id: true,
  createdAt: true,
});

export const insertReviewItemSchema = createInsertSchema(reviewItems).omit({
  id: true,
  createdAt: true,
});

export const insertReviewMessageSchema = createInsertSchema(reviewMessages).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type AiSuggestion = typeof aiSuggestions.$inferSelect;
export type InsertAiSuggestion = z.infer<typeof insertAiSuggestionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type BankConnection = typeof bankConnections.$inferSelect;
export type InsertBankConnection = z.infer<typeof insertBankConnectionSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type Estimate = typeof estimates.$inferSelect;
export type InsertEstimate = z.infer<typeof insertEstimateSchema>;
export type EstimateItem = typeof estimateItems.$inferSelect;
export type InsertEstimateItem = z.infer<typeof insertEstimateItemSchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type InsertRecurringTransaction = z.infer<typeof insertRecurringTransactionSchema>;
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountsSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Collaborator = typeof collaborators.$inferSelect;
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;
export type BankStatement = typeof bankStatements.$inferSelect;
export type InsertBankStatement = z.infer<typeof insertBankStatementSchema>;
export type TransactionClear = typeof transactionClears.$inferSelect;
export type InsertTransactionClear = z.infer<typeof insertTransactionClearSchema>;
export type ReviewItem = typeof reviewItems.$inferSelect;
export type InsertReviewItem = z.infer<typeof insertReviewItemSchema>;
export type ReviewMessage = typeof reviewMessages.$inferSelect;
export type InsertReviewMessage = z.infer<typeof insertReviewMessageSchema>;
