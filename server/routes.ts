import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { storage } from "./storage";
import { hashPassword, verifyPassword, checkSubscriptionAccess, getTrialDaysRemaining } from "./services/auth";
import { categorizeTransaction, processFinancialQuery, extractReceiptData, parseNaturalLanguageTransaction } from "./services/openai";
import { enrichMerchantDescription, getCachedEnrichment, setCachedEnrichment } from "./services/merchant-enrichment";
import { createLinkToken, exchangePublicToken, getAccounts, syncTransactions, getInstitutionName } from "./services/plaid";
import { categorizeTransactionHybrid } from "./services/hybrid-categorization";
import { syncAllConnections, syncEventEmitter } from "./services/bank-sync";
import { processReceiptOCR, findTransactionMatches } from "./services/ocr";
import { doubleEntryService } from "./services/double-entry";
import { getDashboardData } from "./routes/dashboard";
import { 
  insertUserSchema, 
  insertTransactionSchema, 
  insertBankConnectionSchema,
  insertReceiptSchema,
  insertClientSchema,
  insertInvoiceSchema,
  insertInvoiceItemSchema,
  insertEstimateSchema,
  insertEstimateItemSchema,
  insertReviewMessageSchema,
  type User,
  type Receipt,
  type InsertReceipt,
  type Client,
  type Invoice,
  type Estimate
} from "@shared/schema";
import { CHART_OF_ACCOUNTS } from "@shared/chart-of-accounts";
import { z } from "zod";

// Extend Express Request to include authenticated user
interface AuthenticatedRequest extends Request {
  user: User;
}

// Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY || "default_key");

// Multer setup for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Session setup — use PostgreSQL store so sessions survive server restarts
  const PgSession = connectPgSimple(session);
  const sessionSecret = process.env.SESSION_SECRET || "dev-secret-do-not-use-in-production";
  if (!process.env.SESSION_SECRET) {
    console.warn("WARNING: SESSION_SECRET environment variable is not set. Using insecure default.");
  }
  app.use(session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      createTableIfMissing: true,
      pruneSessionInterval: 60 * 15, // prune expired sessions every 15 minutes
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    }
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // Passport configuration
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  ));

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated() && req.user) {
      return next();
    }
    res.status(401).json({ message: "Authentication required" });
  };

  const requireSubscription = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!checkSubscriptionAccess(req.user as User)) {
      return res.status(403).json({ 
        message: "Subscription required", 
        trialExpired: true 
      });
    }
    
    next();
  };

  const generateToken = (size = 32) => crypto.randomBytes(size).toString("hex");

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password and create user with trial period
      const hashedPassword = await hashPassword(userData.password);
      const emailVerificationToken = generateToken(24);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        emailVerificationToken,
      });
      
      // Log in the user
      req.login(user, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after registration" });
        }
        res.json({ 
          user: { 
            id: user.id, 
            email: user.email, 
            username: user.username,
            businessName: user.businessName,
            subscriptionStatus: user.subscriptionStatus 
          },
          verifyToken: emailVerificationToken
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Registration failed", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/auth/login", passport.authenticate('local'), (req, res) => {
    const user = req.user as User;
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        businessName: user.businessName,
        subscriptionStatus: user.subscriptionStatus 
      } 
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = req.user as User;
    res.json({ 
      user: { 
        id: user.id, 
        email: user.email, 
        username: user.username,
        businessName: user.businessName,
        firstName: user.firstName,
        lastName: user.lastName,
        province: user.province,
        address: user.address,
        fiscalYearStart: user.fiscalYearStart,
        gstRegistered: user.gstRegistered,
        gstNumber: user.gstNumber,
        gstFilingFrequency: user.gstFilingFrequency,
        emailVerifiedAt: user.emailVerifiedAt,
        subscriptionStatus: user.subscriptionStatus,
        trialDaysRemaining: getTrialDaysRemaining(user)
      } 
    });
  });

  app.post("/api/auth/request-password-reset", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await storage.getUserByEmail(email);
    // Keep response generic to avoid account enumeration
    if (!user) {
      return res.json({ message: "If that email exists, a reset link has been generated." });
    }

    const token = generateToken(24);
    const expires = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    await storage.updateUserProfile(user.id, {
      resetPasswordToken: token,
      resetPasswordExpiresAt: expires,
    } as Partial<User>);

    // v1 placeholder: return token for manual email wiring
    return res.json({
      message: "Password reset token generated.",
      resetToken: token,
      expiresAt: expires,
    });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!token || !password || password.length < 8) {
      return res.status(400).json({ message: "Token and password (min 8 chars) are required" });
    }

    const user = await storage.getUserByResetToken(token);
    if (!user || !user.resetPasswordExpiresAt || new Date(user.resetPasswordExpiresAt) < new Date()) {
      return res.status(400).json({ message: "Reset token is invalid or expired" });
    }

    const hashedPassword = await hashPassword(password);
    await storage.updateUserProfile(user.id, {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null,
    } as Partial<User>);

    return res.json({ message: "Password reset successful" });
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    const token = String(req.query.token || "");
    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }
    const user = await storage.getUserByEmailVerificationToken(token);
    if (!user) {
      return res.status(400).json({ message: "Invalid verification token" });
    }

    await storage.updateUserProfile(user.id, {
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
    } as Partial<User>);

    return res.json({ message: "Email verified" });
  });

  app.get("/api/profile", requireAuth, async (req, res) => {
    const user = req.user as User;
    res.json({
      legalName: user.businessName || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email,
      province: user.province || "",
      address: user.address || "",
      fiscalYearStart: user.fiscalYearStart,
      gstRegistered: Boolean(user.gstRegistered),
      gstNumber: user.gstNumber || "",
      gstFilingFrequency: user.gstFilingFrequency || "annual",
    });
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const updates: Partial<User> = {
        businessName: req.body?.legalName ?? req.body?.businessName ?? user.businessName,
        firstName: req.body?.firstName ?? user.firstName,
        lastName: req.body?.lastName ?? user.lastName,
        province: req.body?.province ?? user.province,
        address: req.body?.address ?? user.address,
        gstRegistered: typeof req.body?.gstRegistered === "boolean" ? req.body.gstRegistered : user.gstRegistered,
        gstNumber: req.body?.gstNumber ?? user.gstNumber,
        gstFilingFrequency: req.body?.gstFilingFrequency ?? user.gstFilingFrequency,
      };

      if (req.body?.fiscalYearStart) {
        updates.fiscalYearStart = new Date(req.body.fiscalYearStart);
      }

      const updated = await storage.updateUserProfile(user.id, updates);
      res.json({ user: updated });
    } catch (error) {
      console.error("Profile update failed:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Collaborator access
  app.post("/api/access/invite", requireAuth, async (req, res) => {
    try {
      const owner = req.user as User;
      const email = String(req.body?.email || "").trim().toLowerCase();
      const role = String(req.body?.role || "").trim().toLowerCase();
      if (!email || !["accountant", "bookkeeper"].includes(role)) {
        return res.status(400).json({ message: "Valid email and role are required" });
      }
      if (email === owner.email.toLowerCase()) {
        return res.status(400).json({ message: "Cannot invite yourself" });
      }

      const inviteToken = generateToken(24);
      const inviteExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

      const collaborator = await storage.createCollaborator({
        ownerUserId: owner.id,
        collaboratorUserId: null,
        role,
        status: "invited",
        invitedEmail: email,
        inviteToken,
        inviteExpiresAt,
      });

      res.json({
        ok: true,
        collaboratorId: collaborator.id,
        inviteToken,
        expiresAt: inviteExpiresAt,
      });
    } catch (error) {
      console.error("Invite collaborator failed:", error);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.post("/api/access/accept", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const inviteToken = String(req.body?.invite_token || "").trim();
      if (!inviteToken) {
        return res.status(400).json({ message: "invite_token is required" });
      }

      const invite = await storage.getCollaboratorByInviteToken(inviteToken);
      if (!invite || !invite.inviteExpiresAt || new Date(invite.inviteExpiresAt) < new Date()) {
        return res.status(400).json({ message: "TOKEN_INVALID_OR_EXPIRED" });
      }
      if (invite.invitedEmail.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(403).json({ message: "Invite email does not match current user" });
      }

      await storage.acceptCollaboratorInvite(inviteToken, user.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Accept invite failed:", error);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.get("/api/access/collaborators", requireAuth, async (req, res) => {
    try {
      const owner = req.user as User;
      const items = await storage.getCollaboratorsByOwner(owner.id);
      res.json({ items });
    } catch (error) {
      console.error("Get collaborators failed:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  app.delete("/api/access/collaborators/:id", requireAuth, async (req, res) => {
    try {
      const owner = req.user as User;
      await storage.deleteCollaborator(owner.id, req.params.id);
      res.json({ ok: true });
    } catch (error) {
      console.error("Delete collaborator failed:", error);
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  // Reconciliation
  const parseMonth = (statementMonth: string) => {
    const [y, m] = statementMonth.split("-").map(Number);
    if (!y || !m || m < 1 || m > 12) return null;
    return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  };

  app.get("/api/reconciliation/accounts", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const conns = await storage.getBankConnections(user.id);
      const dedup = new Map<string, any>();
      for (const c of conns) {
        if (!dedup.has(c.accountId)) {
          dedup.set(c.accountId, {
            bank_account_id: c.accountId,
            name: `${c.bankName} ${c.accountName}`,
          });
        }
      }
      res.json({ accounts: Array.from(dedup.values()) });
    } catch (error) {
      console.error("Reconciliation accounts failed:", error);
      res.status(500).json({ message: "Failed to load reconciliation accounts" });
    }
  });

  app.get("/api/reconciliation/:bank_account_id/:statement_month", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }

      let statement = await storage.getBankStatement(user.id, bankAccountId, statementMonth);
      const statementEndDate = statement?.statementEndDate
        ? new Date(statement.statementEndDate)
        : new Date(Date.UTC(statementMonth.getUTCFullYear(), statementMonth.getUTCMonth() + 1, 0, 23, 59, 59));

      const bookEndingBalance = await storage.getBookEndingBalance(user.id, bankAccountId, statementEndDate);
      const unclearedBase = await storage.getUnclearedTransactions(user.id, bankAccountId, statementEndDate);

      let clearedIds = new Set<string>();
      if (statement) {
        const clears = await storage.getTransactionClearsForStatement(statement.id);
        clearedIds = new Set(clears.filter(c => c.cleared).map(c => c.transactionId));
      }
      const unclearedTransactions = unclearedBase.filter(t => !clearedIds.has(t.id));

      const endingBal = statement ? Number(statement.endingBalance) : 0;
      const difference = statement ? endingBal - bookEndingBalance : 0;

      res.json({
        statement: statement || null,
        book_ending_balance: bookEndingBalance,
        difference,
        uncleared_transactions: unclearedTransactions,
      });
    } catch (error) {
      console.error("Reconciliation fetch failed:", error);
      res.status(500).json({ message: "Failed to fetch reconciliation data" });
    }
  });

  app.put("/api/reconciliation/:bank_account_id/:statement_month", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const statementEndDate = req.body?.statement_end_date ? new Date(req.body.statement_end_date) : null;
      const endingBalance = req.body?.ending_balance;
      if (!statementEndDate || endingBalance === undefined || endingBalance === null) {
        return res.status(400).json({ message: "statement_end_date and ending_balance are required" });
      }

      const statement = await storage.upsertBankStatement({
        ownerUserId: user.id,
        bankAccountId,
        statementMonth,
        statementEndDate,
        endingBalance: String(endingBalance),
        currency: "CAD",
      });

      res.json({ statement });
    } catch (error) {
      console.error("Reconciliation save failed:", error);
      res.status(500).json({ message: "Failed to save statement" });
    }
  });

  app.post("/api/reconciliation/:bank_account_id/:statement_month/auto-clear", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const statement = await storage.getBankStatement(user.id, bankAccountId, statementMonth);
      if (!statement) {
        return res.status(400).json({ message: "Create statement first" });
      }

      const clearTo = req.body?.clear_up_to_date ? new Date(req.body.clear_up_to_date) : new Date(statement.statementEndDate);
      const txns = await storage.getUnclearedTransactions(user.id, bankAccountId, clearTo);
      let count = 0;
      for (const t of txns) {
        await storage.setTransactionClear({
          ownerUserId: user.id,
          bankStatementId: statement.id,
          transactionId: t.id,
          cleared: true,
        });
        count += 1;
      }
      res.json({ cleared_count: count });
    } catch (error) {
      console.error("Reconciliation auto-clear failed:", error);
      res.status(500).json({ message: "Failed to auto-clear transactions" });
    }
  });

  app.post("/api/reconciliation/:bank_account_id/:statement_month/clear", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const statement = await storage.getBankStatement(user.id, bankAccountId, statementMonth);
      if (!statement) {
        return res.status(400).json({ message: "Create statement first" });
      }

      const transactionId = String(req.body?.transaction_id || "");
      const cleared = Boolean(req.body?.cleared);
      if (!transactionId) {
        return res.status(400).json({ message: "transaction_id is required" });
      }
      await storage.setTransactionClear({
        ownerUserId: user.id,
        bankStatementId: statement.id,
        transactionId,
        cleared,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Reconciliation clear toggle failed:", error);
      res.status(500).json({ message: "Failed to set clear status" });
    }
  });

  // Chart of Accounts routes
  app.get("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;

      const [userAccounts, bankAccounts] = await Promise.all([
        storage.getChartOfAccounts(user.id),
        storage.getBankAccountsForChartOfAccounts(user.id),
      ]);

      // Always start with the standard defaults
      const defaultAccounts = CHART_OF_ACCOUNTS.map(account => ({
        ...account,
        userId: user.id,
      }));

      // Only surface user-created custom accounts (not auto-generated bank entries,
      // which are already represented by the live bankAccounts query above)
      const userCustomAccounts = userAccounts.filter(a => !a.isBankAccount);

      res.json([...defaultAccounts, ...userCustomAccounts, ...bankAccounts]);
    } catch (error) {
      console.error("Error fetching chart of accounts:", error);
      res.status(500).json({ message: "Failed to fetch chart of accounts" });
    }
  });

  app.post("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const accountData = req.body;
      
      const account = await storage.createChartOfAccountsEntry(user.id, accountData);
      res.json(account);
    } catch (error) {
      console.error("Error creating account:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Double-entry posting endpoint
  app.post("/api/transactions/:id/post", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      
      // Verify transaction belongs to user
      const transaction = await storage.getTransaction(id);
      if (!transaction || transaction.userId !== user.id) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.isPosted) {
        return res.status(400).json({ message: "Transaction already posted" });
      }

      // Process for double-entry posting
      const journalEntryId = await doubleEntryService.processTransactionForPosting(id);
      
      res.json({ 
        message: "Transaction posted successfully",
        journalEntryId,
        transactionId: id 
      });
    } catch (error) {
      console.error("Error posting transaction:", error);
      res.status(500).json({ message: "Failed to post transaction" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      console.log(`Fetching transactions for user: ${user.id}`);
      const transactions = await storage.getTransactions(user.id);
      console.log(`Found ${transactions.length} transactions`);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Bulk AI categorization for existing transactions
  app.post("/api/transactions/bulk-categorize", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { transactionIds, force = false } = req.body;
      
      let transactions;
      if (transactionIds && Array.isArray(transactionIds)) {
        // Categorize specific transactions - filter by user for security
        const allTransactions = await storage.getTransactions(user.id);
        transactions = allTransactions.filter(t => transactionIds.includes(t.id));
      } else {
        // Categorize all uncategorized transactions
        const allTransactions = await storage.getTransactions(user.id);
        transactions = allTransactions.filter(t => 
          !t.aiCategory && !t.isTransfer && t.isExpense && (t.vendor || t.description)
        );
      }
      
      console.log(`Starting bulk categorization for ${transactions.length} transactions`);
      
      const results = [];
      for (const transaction of transactions) {
        try {
          if (transaction.aiCategory && !force) {
            results.push({ id: transaction.id, status: 'skipped', reason: 'already categorized' });
            continue;
          }
          
          const aiResult = await categorizeTransaction(
            transaction.vendor || transaction.description,
            parseFloat(transaction.amount),
            transaction.description
          );
          
          await storage.updateTransaction(transaction.id, {
            aiCategory: aiResult.category,
            aiConfidence: aiResult.confidence.toString(),
            aiExplanation: aiResult.explanation,
            needsReview: aiResult.confidence < 0.7
          });
          
          results.push({ 
            id: transaction.id, 
            status: 'success', 
            category: aiResult.category,
            confidence: aiResult.confidence 
          });
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to categorize transaction ${transaction.id}:`, error);
          results.push({ 
            id: transaction.id, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      const { logAuditEvent: logBulkCat } = await import('./services/audit-log');
      const successCount = results.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        await logBulkCat(user.id, 'transaction.bulk_categorized', 'transaction', undefined, {
          total: results.length,
          success: successCount,
          errors: results.filter(r => r.status === 'error').length,
        });
      }

      res.json({ 
        message: `Processed ${results.length} transactions`,
        results: results,
        summary: {
          total: results.length,
          success: results.filter(r => r.status === 'success').length,
          errors: results.filter(r => r.status === 'error').length,
          skipped: results.filter(r => r.status === 'skipped').length
        }
      });
    } catch (error) {
      console.error("Error in bulk categorization:", error);
      res.status(500).json({ message: "Failed to bulk categorize transactions" });
    }
  });

  // Review queue endpoint for transactions needing manual review
  app.get("/api/transactions/review-queue", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const transactions = await storage.getTransactions(user.id);
      const reviewQueue = transactions.filter(t => t.needsReview);
      res.json(reviewQueue);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review queue" });
    }
  });

  app.get("/api/review/items", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const items = await storage.getOpenReviewItems(user.id);
      res.json({ items });
    } catch (error) {
      console.error("Failed fetching review items:", error);
      res.status(500).json({ message: "Failed to fetch review items" });
    }
  });

  app.post("/api/review/items", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { kind, entityType, entityId, prompt, optionsJson, modelSuggestionJson } = req.body || {};
      if (!kind || !entityType || !entityId || !prompt) {
        return res.status(400).json({ message: "kind, entityType, entityId, prompt are required" });
      }

      const item = await storage.createReviewItem({
        ownerUserId: user.id,
        status: "open",
        kind,
        entityType,
        entityId,
        prompt,
        optionsJson: optionsJson ?? null,
        modelSuggestionJson: modelSuggestionJson ?? null,
        resolvedAt: null,
      });
      res.json({ item });
    } catch (error) {
      console.error("Failed creating review item:", error);
      res.status(500).json({ message: "Failed to create review item" });
    }
  });

  app.get("/api/review/items/:id/messages", requireAuth, requireSubscription, async (req, res) => {
    try {
      const messages = await storage.getReviewMessages(req.params.id);
      res.json({ messages });
    } catch (error) {
      console.error("Failed fetching review messages:", error);
      res.status(500).json({ message: "Failed to fetch review messages" });
    }
  });

  app.post("/api/review/items/:id/messages", requireAuth, requireSubscription, async (req, res) => {
    try {
      const payload = insertReviewMessageSchema.parse({
        reviewItemId: req.params.id,
        role: req.body?.role || "user",
        content: req.body?.content || "",
      });
      if (!payload.content.trim()) {
        return res.status(400).json({ message: "content is required" });
      }
      const message = await storage.createReviewMessage(payload);
      res.json({ message });
    } catch (error) {
      console.error("Failed creating review message:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create review message" });
    }
  });

  app.post("/api/transactions", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId: user.id,
      });
      
      // Enhanced AI categorization with merchant enrichment
      let aiCategory = null;
      let aiConfidence = null;
      let aiExplanation = null;
      let needsReview = false;
      
      if (!transactionData.category && (transactionData.vendor || transactionData.description)) {
        try {
          let enrichedContext = '';
          
          // Check cache first
          const description = transactionData.description || transactionData.vendor || '';
          const cachedEnrichment = await getCachedEnrichment(description);
          
          if (cachedEnrichment) {
            enrichedContext = cachedEnrichment.enrichedContext;
          } else {
            // Enrich merchant information via web search
            const enrichment = await enrichMerchantDescription(
              description,
              parseFloat(transactionData.amount)
            );
            enrichedContext = enrichment.enrichedContext;
            
            // Cache the result
            setCachedEnrichment(description, enrichment);
          }
          
          // Perform AI categorization with enriched context
          const aiResult = await categorizeTransaction(
            transactionData.vendor || 'Unknown',
            parseFloat(transactionData.amount),
            transactionData.description || '',
            enrichedContext
          );
          
          aiCategory = aiResult.category;
          aiConfidence = aiResult.confidence.toString();
          aiExplanation = aiResult.explanation;
          
          // Auto-assign if high confidence (>80%), otherwise flag for review
          if (aiResult.confidence > 0.8) {
            needsReview = false;
          } else {
            needsReview = true;
          }
          
          // Store AI suggestion with enriched context
          await storage.createAiSuggestion({
            userId: user.id,
            suggestionType: "categorization",
            originalPrompt: `${transactionData.vendor} - ${transactionData.description}`,
            aiResponse: {
              ...aiResult,
              enrichedContext
            },
            confidence: aiResult.confidence.toString(),
          });
        } catch (error) {
          console.error("Enhanced categorization failed:", error);
          needsReview = true;
          aiExplanation = "Categorization failed - manual review required";
        }
      }
      
      const transaction = await storage.createTransaction({
        ...transactionData,
        aiCategory,
        aiConfidence,
        aiExplanation,
        needsReview,
        category: transactionData.category || aiCategory,
      });
      
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Transaction validation error:", error.errors);
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Transaction creation error:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", requireAuth, requireSubscription, async (req, res) => {
    try {
      const transaction = await storage.updateTransaction(req.params.id, req.body);
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, requireSubscription, async (req, res) => {
    try {
      await storage.deleteTransaction(req.params.id);
      res.json({ message: "Transaction deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Bulk operations endpoint
  app.post("/api/transactions/bulk", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { action, transactionIds } = req.body;
      
      if (!action || !transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({ message: "Invalid bulk action request" });
      }

      // Validate that all transactions belong to the user
      const userTransactions = await storage.getTransactions(user.id);
      const userTransactionIds = new Set(userTransactions.map(t => t.id));
      const invalidIds = transactionIds.filter(id => !userTransactionIds.has(id));
      
      if (invalidIds.length > 0) {
        return res.status(403).json({ message: "Some transactions don't belong to this user" });
      }

      let results = [];

      switch (action.type) {
        case 'category':
          if (!action.newValue) {
            return res.status(400).json({ message: "Category value required" });
          }
          for (const id of transactionIds) {
            const transaction = await storage.updateTransaction(id, { 
              category: action.newValue,
              needsReview: false,
              isReviewed: true
            });
            results.push(transaction);
          }
          break;

        case 'account':
          if (!action.newValue) {
            return res.status(400).json({ message: "Account value required" });
          }
          for (const id of transactionIds) {
            const transaction = await storage.updateTransaction(id, { 
              bankConnectionId: action.newValue
            });
            results.push(transaction);
          }
          break;

        case 'salesTax':
          if (!action.newValue) {
            return res.status(400).json({ message: "Sales tax value required" });
          }
          const taxRate = parseFloat(action.newValue) / 100;
          for (const id of transactionIds) {
            const currentTransaction = userTransactions.find(t => t.id === id);
            if (currentTransaction) {
              const amount = parseFloat(currentTransaction.amount);
              const taxAmount = amount * taxRate;
              const transaction = await storage.updateTransaction(id, { 
                amount: (amount + taxAmount).toString()
              });
              results.push(transaction);
            }
          }
          break;

        case 'review': {
          const { logAuditEvent: logReview } = await import('./services/audit-log');
          for (const id of transactionIds) {
            const transaction = await storage.updateTransaction(id, { 
              isReviewed: true,
              needsReview: false
            });
            results.push(transaction);
            await logReview(user.id, 'transaction.reviewed', 'transaction', id);
          }
          break;
        }

        case 'delete':
          for (const id of transactionIds) {
            await storage.deleteTransaction(id);
          }
          results.push({ deletedCount: transactionIds.length });
          break;

        default:
          return res.status(400).json({ message: "Invalid bulk action type" });
      }

      res.json({ 
        success: true, 
        affectedCount: transactionIds.length,
        results 
      });
    } catch (error) {
      console.error("Bulk action error:", error);
      res.status(500).json({ message: "Failed to perform bulk action" });
    }
  });

  // Enhanced transaction update endpoint with transfer detection
  app.patch("/api/transactions/:id", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { id } = req.params;
      
      // Verify transaction belongs to user
      const existingTransaction = await storage.getTransaction(id);
      if (!existingTransaction || existingTransaction.userId !== user.id) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Prevent editing restricted transaction types
      if (existingTransaction.isTransfer && req.body.bankConnectionId) {
        return res.status(400).json({ 
          message: "Cannot change account for transfer transactions as it would break the transfer relationship" 
        });
      }

      const updates = req.body;
      
      // If updating category and it was previously AI-suggested, mark as reviewed
      if (updates.category && existingTransaction.aiCategory && !existingTransaction.category) {
        updates.isReviewed = true;
        updates.needsReview = false;
      }

      const transaction = await storage.updateTransaction(id, updates);

      // Emit audit event
      const { logAuditEvent: logPatch } = await import('./services/audit-log');
      if (updates.isReviewed) {
        await logPatch(user.id, 'transaction.reviewed', 'transaction', id);
      } else if (updates.category || updates.aiCategory) {
        await logPatch(user.id, 'transaction.categorized', 'transaction', id, {
          category: updates.category ?? updates.aiCategory,
        });
      }

      res.json(transaction);
    } catch (error) {
      console.error("Transaction update error:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // Receipt routes
  app.get("/api/receipts", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const receipts = await storage.getReceipts(user.id);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  // Financial summary route
  app.get("/api/financial-summary", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const summary = await storage.getFinancialSummary(user.id, start, end);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  // Expense breakdown endpoint
  app.get("/api/expense-breakdown", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const breakdown = await storage.getExpenseBreakdown(user.id);
      res.json(breakdown);
    } catch (error) {
      console.error("Error fetching expense breakdown:", error);
      res.status(500).json({ message: "Failed to fetch expense breakdown" });
    }
  });

  // Monthly trends endpoint
  app.get("/api/monthly-trends", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const trends = await storage.getMonthlyTrends(user.id);
      res.json(trends);
    } catch (error) {
      console.error("Error fetching monthly trends:", error);
      res.status(500).json({ message: "Failed to fetch monthly trends" });
    }
  });

  // AI insights endpoint
  app.get("/api/ai-insights", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const insights = await storage.getAIInsights(user.id);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({ message: "Failed to fetch AI insights" });
    }
  });

  // AI Chat route
  app.post("/api/chat", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Save user message
      await storage.createChatMessage({
        userId: user.id,
        message,
        isFromUser: true,
      });

      // Get financial context
      const summary = await storage.getFinancialSummary(
        user.id,
        new Date(new Date().getFullYear(), 0, 1), // Start of year
        new Date()
      );

      // Process with AI
      const aiResponse = await processFinancialQuery(message, user.id, summary);

      // Save AI response
      await storage.createChatMessage({
        userId: user.id,
        message: aiResponse.response,
        isFromUser: false,
      });

      res.json({ response: aiResponse.response });
    } catch (error) {
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  app.get("/api/chat/history", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const history = await storage.getChatHistory(user.id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Stripe subscription routes  
  app.post("/api/create-subscription", requireAuth, async (req, res) => {
    try {
      let user = req.user as User;

      // For demo purposes, if no valid Stripe configuration, simulate successful subscription
      if (!process.env.STRIPE_PRICE_ID || process.env.STRIPE_PRICE_ID === "price_default") {
        console.log("Demo mode: Simulating successful subscription for user", user.id);
        
        // Update user to active subscription status for demo
        await storage.updateUserSubscriptionStatus(user.id, "active");
        
        return res.json({
          demo: true,
          message: "Demo subscription activated - no payment required",
          subscriptionId: "demo_subscription_" + user.id,
        });
      }

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        return res.json({
          subscriptionId: subscription.id,
          clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        });
      }

      if (!user.email) {
        return res.status(400).json({ message: 'No user email on file' });
      }

      // First, let's verify the price exists
      try {
        await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!);
      } catch (priceError: any) {
        console.error("Stripe price validation error:", priceError);
        return res.status(400).json({ 
          message: `Invalid Stripe price ID: ${process.env.STRIPE_PRICE_ID}. Please check your Stripe Dashboard and ensure the price ID is correct and from the same environment (test/live) as your API keys.`,
          error: priceError.message 
        });
      }

      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username,
      });

      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: process.env.STRIPE_PRICE_ID!,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      await storage.updateUserStripeInfo(user.id, customer.id, subscription.id);

      res.json({
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error("Subscription creation error:", error);
      res.status(400).json({ 
        message: error.message,
        details: "Please check your Stripe configuration and ensure all API keys and price IDs are correct."
      });
    }
  });

  app.post("/api/billing/portal", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: "No Stripe customer found for user" });
      }
      const returnUrl = req.body?.returnUrl || `${req.protocol}://${req.get("host")}/settings`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl,
      });
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Billing portal error:", error);
      res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const sig = req.headers["stripe-signature"] as string | undefined;
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      let event: Stripe.Event;

      if (sig && secret && Buffer.isBuffer(req.body)) {
        event = stripe.webhooks.constructEvent(req.body, sig, secret);
      } else {
        // Fallback for local/dev environments without webhook signature verification.
        event = req.body as Stripe.Event;
      }

      const obj: any = event.data?.object || {};
      if (event.type.startsWith("customer.subscription.")) {
        const subscriptionId = obj.id as string | undefined;
        const status = obj.status as string | undefined;
        if (subscriptionId && status) {
          const user = await storage.getUserByStripeSubscriptionId(subscriptionId);
          if (user) {
            let mapped = "inactive";
            if (status === "trialing") mapped = "trial";
            else if (status === "active") mapped = "active";
            else if (status === "past_due") mapped = "inactive";
            else if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") mapped = "cancelled";
            await storage.updateUserSubscriptionStatus(user.id, mapped);
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook error:", error);
      res.status(400).json({ message: "Webhook error", error: error.message });
    }
  });

  // Plaid Bank Integration Routes
  app.post("/api/plaid/create-link-token", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const linkToken = await createLinkToken(user.id);
      res.json({ link_token: linkToken });
    } catch (error) {
      console.error("Error creating link token:", error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });

  app.post("/api/plaid/exchange-public-token", requireAuth, async (req, res) => {
    try {
      const { public_token } = req.body;
      
      if (!public_token) {
        return res.status(400).json({ message: "Public token is required" });
      }

      // Exchange public token for access token using enhanced quickstart method
      const tokenData = await exchangePublicToken(public_token);
      
      // Get account information using enhanced quickstart method
      const accountsData = await getAccounts(tokenData.accessToken);
      
      // Store bank connections for each account (upsert by Plaid account_id)
      const connections = [];
      const user = req.user as User;
      const bankName = await getInstitutionName(accountsData.item.institution_id || "") || "Unknown Bank";

      for (const account of accountsData.accounts) {
        const connectionData = {
          userId: user.id,
          plaidItemId: tokenData.itemId,
          plaidAccessToken: tokenData.accessToken,
          bankName,
          accountType: account.type,
          accountId: account.account_id,
          accountName: account.name,
          accountMask: account.mask || null,
          lastSyncAt: new Date(),
        };

        // Upsert: update existing connection if same Plaid account_id, else create
        const existing = await storage.getBankConnectionByAccountId(user.id, account.account_id);
        let connection;
        if (existing) {
          connection = await storage.updateBankConnection(existing.id, {
            plaidItemId: connectionData.plaidItemId,
            plaidAccessToken: connectionData.plaidAccessToken,
            bankName: connectionData.bankName,
            accountName: connectionData.accountName,
            accountMask: connectionData.accountMask,
            lastSyncAt: connectionData.lastSyncAt,
          });
        } else {
          connection = await storage.createBankConnection(connectionData);
        }
        connections.push(connection);
      }

      // AUTOMATED PROCESS 2: Trigger initial transaction sync
      console.log(`Starting initial transaction sync for ${connections.length} accounts...`);
      
      try {
        // Sync transactions immediately after connecting
        const syncData = await syncTransactions(tokenData.accessToken);
        let syncedCount = 0;
        
        // Process added transactions using hybrid categorization system
        for (const transaction of syncData.added) {
          try {
            // Get user's account IDs for transfer detection
            const userAccountIds = connections.map(conn => conn.accountId);
            
            // Use hybrid categorization system
            const categorizationResult = await categorizeTransactionHybrid(transaction, userAccountIds);
            
            const transactionData = {
              userId: (req.user as User).id,
              description: transaction.name,
              vendor: transaction.merchant_name || transaction.name,
              amount: Math.abs(transaction.amount).toString(),
              date: new Date(transaction.date),
              category: categorizationResult.category,
              isExpense: categorizationResult.isExpense,
              isTransfer: categorizationResult.isTransfer,
              transferType: categorizationResult.transferType || null,
              bankTransactionId: transaction.transaction_id,
              bankConnectionId: connections.find(c => c.accountId === transaction.account_id)?.id,
              aiCategory: categorizationResult.category,
              aiConfidence: categorizationResult.confidence.toString(),
              aiExplanation: categorizationResult.explanation || null,
              needsReview: categorizationResult.confidence < 0.8,
              isReviewed: categorizationResult.confidence >= 0.8,
              plaidCategory: transaction.category?.[0] || null,
              paymentChannel: transaction.payment_channel || null,
              location: transaction.location ? JSON.stringify(transaction.location) : null,
              categorizationMethod: categorizationResult.method,
            };

            await storage.createTransaction(transactionData);
            syncedCount++;
          } catch (error) {
            console.log("Skipping duplicate transaction:", transaction.transaction_id);
          }
        }
        
        console.log(`Initial sync completed: ${syncedCount} transactions imported`);
      } catch (syncError) {
        console.error("Initial transaction sync failed:", syncError);
      }

      res.json({ 
        message: "Bank accounts connected successfully", 
        connections: connections.length,
        itemId: tokenData.itemId,
        requestId: tokenData.requestId,
        chartAccountsCreated: connections.length,
        initialSyncTriggered: true
      });
    } catch (error) {
      console.error("Error exchanging public token:", error);
      res.status(500).json({ message: "Failed to connect bank account" });
    }
  });

  // Bank feed sync endpoint — triggers delta sync pipeline with cursor advancement and de-dup
  app.post("/api/plaid/sync-transactions", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const connections = await storage.getBankConnections(user.id);

      if (connections.length === 0) {
        return res.status(400).json({ message: "No bank connections found. Please connect a bank account first." });
      }

      // Use mock data when Plaid is not configured or when explicitly requested
      const useMock = req.body?.useMock !== false;

      const { logAuditEvent } = await import('./services/audit-log');
      await logAuditEvent(user.id, 'sync.started', 'bank_connection', undefined, { connections: connections.length });

      const summary = await syncAllConnections(user.id, useMock);

      await logAuditEvent(user.id, 'sync.completed', 'bank_connection', undefined, {
        added: summary.totalAdded,
        modified: summary.totalModified,
        duplicatesSkipped: summary.totalDuplicatesSkipped,
      });

      res.json({
        message: `Sync complete: ${summary.totalAdded} new, ${summary.totalModified} updated, ${summary.totalDuplicatesSkipped} duplicates skipped`,
        totalAdded: summary.totalAdded,
        totalModified: summary.totalModified,
        totalRemoved: summary.totalRemoved,
        totalDuplicatesSkipped: summary.totalDuplicatesSkipped,
        results: summary.results,
        completedAt: summary.completedAt,
      });
    } catch (error) {
      console.error("Error syncing transactions:", error);
      res.status(500).json({ message: "Failed to sync transactions" });
    }
  });

  // SSE endpoint for real-time transactions.synced events
  app.get("/api/events/transactions", requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const user = req.user as User;

    const listener = (payload: any) => {
      if (payload.userId === user.id) {
        res.write(`event: transactions.synced\ndata: ${JSON.stringify(payload)}\n\n`);
      }
    };

    syncEventEmitter.on('transactions.synced', listener);

    req.on('close', () => {
      syncEventEmitter.off('transactions.synced', listener);
    });
  });

  // Bank connections management
  app.get("/api/bank-connections", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const connections = await storage.getBankConnections(user.id);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bank connections" });
    }
  });

  app.delete("/api/bank-connections/:id", requireAuth, requireSubscription, async (req, res) => {
    try {
      await storage.deleteBankConnection(req.params.id);
      res.json({ message: "Bank connection removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove bank connection" });
    }
  });

  // Wave-inspired Invoicing & Client Management Routes
  
  // Client management routes
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const clients = await storage.getClients(user.id);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const clientData = insertClientSchema.parse({
        ...req.body,
        userId: user.id,
      });
      const client = await storage.createClient(clientData);
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Invoice management routes
  app.get("/api/invoices", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const [invoices, clientList] = await Promise.all([
        storage.getInvoices(user.id),
        storage.getClients(user.id),
      ]);
      const clientMap = new Map(clientList.map(c => [c.id, c]));
      const enriched = invoices.map(inv => ({
        ...inv,
        client: clientMap.get(inv.clientId) ?? null,
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { invoice: invoiceData, items } = req.body;
      
      // Generate invoice number
      const invoiceCount = await storage.getInvoices(user.id);
      const invoiceNumber = `INV-${String(invoiceCount.length + 1).padStart(4, '0')}`;
      
      const parsedInvoice = insertInvoiceSchema.parse({
        ...invoiceData,
        userId: user.id,
        invoiceNumber,
      });
      
      const parsedItems = items.map((item: any) => 
        insertInvoiceItemSchema.parse(item)
      );
      
      const invoice = await storage.createInvoice(parsedInvoice, parsedItems);
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Receipt Management Routes
  app.get("/api/receipts", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const receipts = await storage.getReceipts(user.id);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.get("/api/receipts/unmatched", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const unmatchedReceipts = await storage.getUnmatchedReceipts(user.id);
      
      // For each unmatched receipt, find suggested transaction matches
      const receiptsWithSuggestions = await Promise.all(
        unmatchedReceipts.map(async (receipt) => {
          const suggestions = await findTransactionMatches(receipt, user.id);
          return {
            ...receipt,
            suggestedMatches: suggestions
          };
        })
      );
      
      res.json(receiptsWithSuggestions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch unmatched receipts" });
    }
  });

  app.post("/api/receipts/upload", requireAuth, requireSubscription, upload.array('receipts', 10), async (req, res) => {
    try {
      const user = req.user as User;
      const files = req.files as Express.Multer.File[];
      const { notes, tags } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedReceipts = [];
      const tagArray = tags ? tags.split(',').map((tag: string) => tag.trim()) : [];

      for (const file of files) {
        try {
          // Create receipt record
          const receiptData = {
            userId: user.id,
            fileName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            notes: notes || null,
            tags: tagArray.length > 0 ? tagArray : null,
            status: "processing"
          };

          const receipt = await storage.createReceipt(receiptData);
          uploadedReceipts.push(receipt);

          // Start OCR processing asynchronously
          processReceiptOCR(receipt.id, file.path, file.mimetype)
            .then(async (ocrData) => {
              // Update receipt with extracted data
              await storage.updateReceipt(receipt.id, {
                ocrData,
                extractedAmount: ocrData.amount,
                extractedVendor: ocrData.vendor,
                extractedDate: ocrData.date ? new Date(ocrData.date) : null,
                extractedTax: ocrData.tax,
                extractedCurrency: ocrData.currency || "CAD",
                extractedLineItems: ocrData.lineItems,
                status: "processed",
                updatedAt: new Date()
              });

              // Find and suggest transaction matches
              const updatedReceipt = await storage.getReceiptById(receipt.id);
              if (updatedReceipt) {
                const matches = await findTransactionMatches(updatedReceipt, user.id);
                if (matches.length > 0) {
                  const topMatch = matches[0] as any;
                  if (topMatch.__autoLink) {
                    // High-confidence auto-link: mark receipt matched and link to transaction
                    await storage.updateReceipt(receipt.id, {
                      suggestedMatches: matches,
                      isMatched: true,
                      matchedTransactionId: topMatch.id,
                      matchConfidence: String(topMatch.matchScore / 100),
                      status: "matched",
                      updatedAt: new Date(),
                    });
                    await storage.updateTransaction(topMatch.id, {
                      receiptAttached: true,
                      receiptId: receipt.id,
                    });
                  } else {
                    await storage.updateReceipt(receipt.id, {
                      suggestedMatches: matches,
                      status: "unmatched",
                      updatedAt: new Date()
                    });
                  }
                } else {
                  await storage.updateReceipt(receipt.id, {
                    status: "unmatched",
                    updatedAt: new Date()
                  });
                }
              }
            })
            .catch(async (error) => {
              console.error(`OCR processing failed for receipt ${receipt.id}:`, error);
              await storage.updateReceipt(receipt.id, {
                status: "failed",
                processingError: error.message,
                updatedAt: new Date()
              });
            });

        } catch (error) {
          console.error("Error creating receipt record:", error);
        }
      }

      res.json({
        message: "Receipts uploaded successfully",
        uploadedCount: uploadedReceipts.length,
        receipts: uploadedReceipts
      });

    } catch (error) {
      console.error("Receipt upload error:", error);
      res.status(500).json({ message: "Failed to upload receipts" });
    }
  });

  app.get("/api/receipts/:id/preview", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== user.id) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      // Serve the file
      res.sendFile(path.resolve(receipt.filePath));
    } catch (error) {
      res.status(500).json({ message: "Failed to load receipt preview" });
    }
  });

  app.get("/api/receipts/:id/thumbnail", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== user.id) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      // For images, serve a smaller version (you could implement thumbnail generation here)
      if (receipt.mimeType?.startsWith('image/')) {
        res.sendFile(path.resolve(receipt.filePath));
      } else {
        // For PDFs, return a default icon or generate thumbnail
        res.status(404).json({ message: "Thumbnail not available" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to load receipt thumbnail" });
    }
  });

  app.get("/api/receipts/:id/download", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== user.id) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      res.download(receipt.filePath, receipt.fileName);
    } catch (error) {
      res.status(500).json({ message: "Failed to download receipt" });
    }
  });

  app.post("/api/receipts/:id/match", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { transactionId, action } = req.body;
      const receiptId = req.params.id;

      const receipt = await storage.getReceiptById(receiptId);
      if (!receipt || receipt.userId !== user.id) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      if (action === 'confirm') {
        // Link receipt to transaction
        await storage.updateReceipt(receiptId, {
          isMatched: true,
          matchedTransactionId: transactionId,
          matchConfidence: "1.0", // User confirmed match
          isAuditReady: true,
          updatedAt: new Date()
        });

        // Update transaction to show receipt is attached
        await storage.updateTransaction(transactionId, {
          receiptId: receiptId,
          receiptAttached: true,
          receiptSource: "upload",
          auditReady: true,
          updatedAt: new Date()
        });

        res.json({ message: "Receipt matched successfully" });

      } else if (action === 'reject') {
        // Remove this transaction from suggested matches
        const currentSuggestions = Array.isArray(receipt.suggestedMatches) ? receipt.suggestedMatches : [];
        const filteredSuggestions = currentSuggestions.filter((match: any) => match.id !== transactionId);
        
        await storage.updateReceipt(receiptId, {
          suggestedMatches: filteredSuggestions,
          updatedAt: new Date()
        });

        res.json({ message: "Match suggestion rejected" });
      } else {
        res.status(400).json({ message: "Invalid action" });
      }

    } catch (error) {
      res.status(500).json({ message: "Failed to process match" });
    }
  });

  app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== user.id) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      // Remove file from filesystem
      try {
        if (fs.existsSync(receipt.filePath)) {
          fs.unlinkSync(receipt.filePath);
        }
      } catch (error) {
        console.error("Error deleting receipt file:", error);
      }

      // If receipt was matched, update the transaction
      if (receipt.isMatched && receipt.matchedTransactionId) {
        await storage.updateTransaction(receipt.matchedTransactionId, {
          receiptId: null,
          receiptAttached: false,
          receiptSource: null,
          auditReady: false,
          updatedAt: new Date()
        });
      }

      // Delete receipt record
      await storage.deleteReceipt(req.params.id);

      res.json({ message: "Receipt deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete receipt" });
    }
  });

  // Financial Reports Routes
  app.get("/api/reports/profit-loss", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;  
      const { from, to } = req.query;
      
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      
      const { generateProfitLossReport } = await import('./services/reports');
      const report = await generateProfitLossReport(user.id, startDate, endDate);
      
      res.json(report);
    } catch (error) {
      console.error("P&L report error:", error);
      res.status(500).json({ message: "Failed to generate profit & loss report" });
    }
  });

  app.get("/api/reports/balance-sheet", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { asOf } = req.query;
      
      const asOfDate = asOf ? new Date(asOf as string) : new Date();
      
      const { generateBalanceSheetReport } = await import('./services/reports');
      const report = await generateBalanceSheetReport(user.id, asOfDate);
      
      res.json(report);
    } catch (error) {
      console.error("Balance sheet report error:", error);
      res.status(500).json({ message: "Failed to generate balance sheet report" });
    }
  });

  app.get("/api/reports/tax-summary", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { from, to } = req.query;
      
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      
      const { generateTaxSummaryReport } = await import('./services/reports');
      const report = await generateTaxSummaryReport(user.id, startDate, endDate);
      
      res.json(report);
    } catch (error) {
      console.error("Tax summary report error:", error);
      res.status(500).json({ message: "Failed to generate tax summary report" });
    }
  });

  app.get("/api/reports/trial-balance", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { asOf } = req.query;
      
      const asOfDate = asOf ? new Date(asOf as string) : new Date();
      
      const { generateTrialBalanceReport } = await import('./services/reports');
      const report = await generateTrialBalanceReport(user.id, asOfDate);
      
      res.json(report);
    } catch (error) {
      console.error("Trial balance report error:", error);
      res.status(500).json({ message: "Failed to generate trial balance report" });
    }
  });

  app.get("/api/reports/general-ledger", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { from, to } = req.query;
      
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      
      const { generateGeneralLedgerReport } = await import('./services/reports');
      const report = await generateGeneralLedgerReport(user.id, startDate, endDate);
      
      res.json(report);
    } catch (error) {
      console.error("General ledger report error:", error);
      res.status(500).json({ message: "Failed to generate general ledger report" });
    }
  });

  // Monthly P&L breakdown
  app.get("/api/reports/profit-loss/monthly", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const { generateMonthlyPLReport } = await import('./services/reports');
      const report = await generateMonthlyPLReport(user.id, year);
      res.json(report);
    } catch (error) {
      console.error("Monthly P&L report error:", error);
      res.status(500).json({ message: "Failed to generate monthly P&L report" });
    }
  });

  // General Ledger CSV export
  app.get("/api/reports/general-ledger/export/csv", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { from, to } = req.query;
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateGeneralLedgerReport, generalLedgerToCSV } = await import('./services/reports');
      const report = await generateGeneralLedgerReport(user.id, startDate, endDate);
      const csv = generalLedgerToCSV(report);

      const filename = `GeneralLedger_${report.period.startDate}_${report.period.endDate}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("General ledger CSV export error:", error);
      res.status(500).json({ message: "Failed to export general ledger as CSV" });
    }
  });

  // Audit log read endpoint
  app.get("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const { db } = await import('./db');
      const { auditLogs } = await import('@shared/schema');
      const { eq, desc } = await import('drizzle-orm');

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, user.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit);

      res.json(logs);
    } catch (error) {
      console.error("Audit log error:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // T2125 CRA export — JSON
  app.get("/api/reports/t2125", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateT2125Report } = await import('./services/t2125-report');
      const report = await generateT2125Report(user.id, startDate, endDate);

      res.json(report);
    } catch (error) {
      console.error("T2125 report error:", error);
      res.status(500).json({ message: "Failed to generate T2125 report" });
    }
  });

  // T2125 CSV download
  app.get("/api/reports/t2125/export/csv", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateT2125Report, reportToCSV } = await import('./services/t2125-report');
      const report = await generateT2125Report(user.id, startDate, endDate);
      const csv = reportToCSV(report);

      const filename = `T2125_${report.taxYear}_${report.period.startDate}_${report.period.endDate}.csv`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      console.error("T2125 CSV export error:", error);
      res.status(500).json({ message: "Failed to export T2125 as CSV" });
    }
  });

  // T2125 JSON download
  app.get("/api/reports/t2125/export/json", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateT2125Report } = await import('./services/t2125-report');
      const report = await generateT2125Report(user.id, startDate, endDate);

      const filename = `T2125_${report.taxYear}_${report.period.startDate}_${report.period.endDate}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(report);
    } catch (error) {
      console.error("T2125 JSON export error:", error);
      res.status(500).json({ message: "Failed to export T2125 as JSON" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.markInvoicePaid(id);
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }  
  });

  // Estimate management routes
  app.get("/api/estimates", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const [estimateList, clientList] = await Promise.all([
        storage.getEstimates(user.id),
        storage.getClients(user.id),
      ]);
      const clientMap = new Map(clientList.map(c => [c.id, c]));
      const enriched = estimateList.map(est => ({
        ...est,
        client: clientMap.get(est.clientId) ?? null,
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/estimates/:id/convert-to-invoice", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const invoice = await storage.convertEstimateToInvoice(id);
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // AI-powered natural language processing
  app.post("/api/ai/parse-transaction", requireAuth, requireSubscription, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text input is required" });
      }

      const parsed = await parseNaturalLanguageTransaction(text);
      res.json({ parsed });
    } catch (error: any) {
      console.error("Natural language parsing error:", error);
      res.status(500).json({ message: "Failed to process natural language input" });
    }
  });

  // Enhanced Financial Reports API
  app.get("/api/reports/financial-summary/:period?", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;  
      const period = req.params.period || 'current-month';
      
      // Get transactions for the user
      const transactions = await storage.getTransactions(user.id);
      
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      let endDate = now;
      
      switch (period) {
        case 'current-month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last-month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'current-quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'current-year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      // Filter transactions by date range
      const filteredTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
      
      // Calculate financial summary
      let totalRevenue = 0;
      let totalExpenses = 0;
      const expensesByCategory: { [key: string]: number } = {};
      
      filteredTransactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        if (transaction.isExpense) {
          totalExpenses += amount;
          const category = transaction.category || 'Other';
          expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
        } else {
          totalRevenue += amount;
        }
      });
      
      const netIncome = totalRevenue - totalExpenses;
      
      // Convert expenses by category to array format
      const totalExpensesForPercentage = totalExpenses || 1; // Avoid division by zero
      const expensesByCategoryArray = Object.entries(expensesByCategory).map(([category, amount]) => ({
        category,
        amount,
        percentage: Math.round((amount / totalExpensesForPercentage) * 100)
      }));
      
      // Generate monthly data for cash flow (simplified)
      const monthlyData = [];
      if (period === 'current-year') {
        for (let month = 0; month < 12; month++) {
          const monthStart = new Date(now.getFullYear(), month, 1);
          const monthEnd = new Date(now.getFullYear(), month + 1, 0);
          const monthTransactions = filteredTransactions.filter(t => {
            const date = new Date(t.date);
            return date >= monthStart && date <= monthEnd;
          });
          
          let monthRevenue = 0;
          let monthExpenses = 0;
          
          monthTransactions.forEach(t => {
            const amount = parseFloat(t.amount);
            if (t.isExpense) {
              monthExpenses += amount;
            } else {
              monthRevenue += amount;
            }
          });
          
          monthlyData.push({
            month: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            revenue: monthRevenue,
            expenses: monthExpenses,
            profit: monthRevenue - monthExpenses
          });
        }
      }
      
      const summary = {
        totalRevenue,
        totalExpenses,
        netIncome,
        expensesByCategory: expensesByCategoryArray,
        monthlyData
      };
      
      res.json(summary);
    } catch (error: any) {
      console.error("Financial summary error:", error);
      res.status(500).json({ message: "Failed to generate financial summary" });
    }
  });

  // Real-time Dashboard Summary
  app.get("/api/reports/dashboard", requireAuth, getDashboardData);

  const httpServer = createServer(app);
  return httpServer;
}
