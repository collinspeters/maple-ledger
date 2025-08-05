import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import Stripe from "stripe";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { hashPassword, verifyPassword, checkSubscriptionAccess, getTrialDaysRemaining } from "./services/auth";
import { categorizeTransaction, processFinancialQuery, extractReceiptData, parseNaturalLanguageTransaction } from "./services/openai";
import { enrichMerchantDescription, getCachedEnrichment, setCachedEnrichment } from "./services/merchant-enrichment";
import { createLinkToken, exchangePublicToken, getAccounts, syncTransactions } from "./services/plaid";
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
  // Session setup
  app.use(session({
    secret: process.env.SESSION_SECRET || "default-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { 
      secure: false, // Set to false for development, true for production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
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
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
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
          } 
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
        subscriptionStatus: user.subscriptionStatus,
        trialDaysRemaining: getTrialDaysRemaining(user)
      } 
    });
  });

  // Chart of Accounts routes
  app.get("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Get user's chart of accounts from database
      const userAccounts = await storage.getChartOfAccounts(user.id);
      
      // If user has no custom accounts, return default + their bank accounts
      if (!userAccounts || userAccounts.length === 0) {
        const bankAccounts = await storage.getBankAccountsForChartOfAccounts(user.id);
        const defaultAccounts = CHART_OF_ACCOUNTS.map(account => ({
          ...account,
          userId: user.id
        }));
        
        res.json([...defaultAccounts, ...bankAccounts]);
      } else {
        res.json(userAccounts);
      }
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

        case 'review':
          for (const id of transactionIds) {
            const transaction = await storage.updateTransaction(id, { 
              isReviewed: true,
              needsReview: false
            });
            results.push(transaction);
          }
          break;

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

  app.post("/api/receipts/upload", requireAuth, requireSubscription, upload.single('receipt'), async (req, res) => {
    try {
      const user = req.user as User;
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Create receipt record
      const receipt = await storage.createReceipt({
        userId: user.id,
        fileName: req.file.originalname,
        filePath: req.file.path,
        status: "processing",
      });

      // TODO: Process with OCR service (Mindee)
      // For now, we'll simulate OCR processing
      setTimeout(async () => {
        try {
          // Simulate OCR text extraction
          const mockOcrText = `${req.file!.originalname} - Receipt processing simulation`;
          
          const extractedData = await extractReceiptData(mockOcrText);
          
          await storage.updateReceipt(receipt.id, {
            ocrData: { text: mockOcrText },
            extractedAmount: extractedData.amount?.toString(),
            extractedVendor: extractedData.vendor,
            extractedDate: extractedData.date ? new Date(extractedData.date) : null,
            status: "processed",
          });
        } catch (error) {
          console.error("Receipt processing error:", error);
          await storage.updateReceipt(receipt.id, {
            status: "error",
          });
        }
      }, 2000);

      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to upload receipt" });
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

  // Financial Reports routes
  app.get("/api/reports/profit-loss", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const report = await financialReportsService.generateIncomeStatement(user.id, {
        startDate: start,
        endDate: end
      });
      
      res.json({
        ...report,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        }
      });
    } catch (error) {
      console.error("Error generating P&L report:", error);
      res.status(500).json({ message: "Failed to generate P&L report" });
    }
  });

  app.get("/api/reports/balance-sheet", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { asOfDate } = req.query;
      
      const asOf = asOfDate ? new Date(asOfDate as string) : new Date();
      const transactions = await storage.getTransactionsByDateRange(user.id, new Date(2020, 0, 1), asOf);
      
      // Calculate cash position from all non-transfer transactions
      const cashPosition = transactions
        .filter(t => !t.isTransfer)
        .reduce((sum, t) => {
          return t.isExpense ? sum - parseFloat(t.amount) : sum + parseFloat(t.amount);
        }, 0);
      
      // Simple balance sheet structure
      const assets = {
        total: Math.max(cashPosition, 0),
        current: [
          { account: 'Cash and Bank Accounts', amount: Math.max(cashPosition, 0) }
        ],
        fixed: []
      };
      
      const liabilities = {
        total: Math.max(-cashPosition, 0),
        current: cashPosition < 0 ? [
          { account: 'Accounts Payable', amount: Math.max(-cashPosition, 0) }
        ] : [],
        longTerm: []
      };
      
      const equity = {
        total: Math.max(cashPosition, 0),
        ownersEquity: Math.max(cashPosition, 0),
        retainedEarnings: 0
      };
      
      res.json({
        assets,
        liabilities,
        equity,
        asOfDate: asOf.toISOString()
      });
    } catch (error) {
      console.error("Error generating balance sheet:", error);
      res.status(500).json({ message: "Failed to generate balance sheet" });
    }
  });

  app.get("/api/reports/tax-summary", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const transactions = await storage.getTransactionsByDateRange(user.id, start, end);
      
      // Estimate GST/HST from transaction data
      const gstHstRate = 0.13; // Ontario HST rate - should be dynamic based on province
      const taxableRevenue = transactions
        .filter(t => !t.isTransfer && !t.isExpense)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const taxableExpenses = transactions
        .filter(t => !t.isTransfer && t.isExpense)
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const taxCollected = taxableRevenue * gstHstRate;
      const taxPaid = taxableExpenses * gstHstRate;
      const netTaxOwing = taxCollected - taxPaid;
      
      res.json({
        taxCollected,
        taxPaid,
        netTaxOwing,
        gstHstBreakdown: [
          {
            province: 'Ontario',
            rate: gstHstRate,
            collected: taxCollected,
            paid: taxPaid
          }
        ],
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        }
      });
    } catch (error) {
      console.error("Error generating tax summary:", error);
      res.status(500).json({ message: "Failed to generate tax summary" });
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
      
      // Store bank connections for each account
      const connections = [];
      for (const account of accountsData.accounts) {
        const user = req.user as User;
        const connectionData = {
          userId: user.id,
          plaidItemId: tokenData.itemId,
          plaidAccessToken: tokenData.accessToken,
          bankName: accountsData.item.institution_id || "Unknown Bank",
          accountType: account.type,
          accountId: account.account_id,
          accountName: account.name,
          accountMask: account.mask || null,
          lastSyncAt: new Date(),
        };

        const connection = await storage.createBankConnection(connectionData);
        connections.push(connection);
      }

      res.json({ 
        message: "Bank accounts connected successfully", 
        connections: connections.length,
        itemId: tokenData.itemId,
        requestId: tokenData.requestId
      });
    } catch (error) {
      console.error("Error exchanging public token:", error);
      res.status(500).json({ message: "Failed to connect bank account" });
    }
  });

  app.post("/api/plaid/sync-transactions", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const connections = await storage.getBankConnections(user.id);
      
      if (connections.length === 0) {
        return res.status(400).json({ message: "No bank connections found" });
      }

      let totalSynced = 0;
      const syncResults = [];
      
      for (const connection of connections) {
        try {
          // Use new sync method that follows Plaid's quickstart pattern
          const syncData = await syncTransactions(connection.plaidAccessToken);
          
          // Process added transactions
          for (const transaction of syncData.added) {
            try {
              const transactionData = {
                userId: user.id,
                description: transaction.name,
                vendor: transaction.merchant_name || transaction.name,
                amount: Math.abs(transaction.amount).toString(),
                date: new Date(transaction.date),
                category: transaction.category?.[0] || 'Other',
                isExpense: transaction.amount > 0, // Plaid uses positive for outflows
                bankTransactionId: transaction.transaction_id,
                bankConnectionId: connection.id,
                needsReview: false,
                isReviewed: true,
              };

              await storage.createTransaction(transactionData);
              totalSynced++;
            } catch (error) {
              // Skip duplicates (likely existing transactions)
              console.log("Skipping duplicate transaction:", transaction.transaction_id);
            }
          }

          // Process modified transactions
          for (const transaction of syncData.modified) {
            try {
              // Update existing transaction if it exists
              const existingTransaction = await storage.getTransactionByPlaidId(transaction.transaction_id);
              if (existingTransaction) {
                const updatedData = {
                  description: transaction.name,
                  amount: Math.abs(transaction.amount).toString(),
                  date: new Date(transaction.date),
                  category: transaction.category?.[0] || 'Other',
                  isExpense: transaction.amount > 0,
                };
                await storage.updateTransaction(existingTransaction.id, updatedData);
              }
            } catch (error) {
              console.log("Error updating transaction:", transaction.transaction_id, error);
            }
          }

          // Update last sync date
          await storage.updateBankConnection(connection.id, {
            lastSyncAt: new Date()
          });

          syncResults.push({
            connectionId: connection.id,
            bankName: connection.bankName,
            added: syncData.added.length,
            modified: syncData.modified.length,
            removed: syncData.removed.length,
            hasMore: syncData.hasMore
          });

        } catch (error) {
          console.error(`Error syncing transactions for connection ${connection.id}:`, error);
          syncResults.push({
            connectionId: connection.id,
            bankName: connection.bankName,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({ 
        message: `Successfully synced ${totalSynced} new transactions`,
        syncedCount: totalSynced,
        results: syncResults
      });
    } catch (error) {
      console.error("Error syncing transactions:", error);
      res.status(500).json({ message: "Failed to sync transactions" });
    }
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
      const invoices = await storage.getInvoices(user.id);
      res.json(invoices);
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
                  await storage.updateReceipt(receipt.id, {
                    suggestedMatches: matches,
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
      const estimates = await storage.getEstimates(user.id);
      res.json(estimates);
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
