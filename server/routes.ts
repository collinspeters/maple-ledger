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
import { categorizeTransaction, processFinancialQuery, extractReceiptData } from "./services/openai";
import { createLinkToken, exchangePublicToken, getAccounts, syncTransactions } from "./services/plaid";
import { insertUserSchema, insertTransactionSchema, insertBankConnectionSchema, type User } from "@shared/schema";
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
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
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
      
      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Registration failed" });
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

  // Transaction routes
  app.get("/api/transactions", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const transactions = await storage.getTransactions(user.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId: user.id,
      });
      
      // Get AI categorization if no category provided
      let aiCategory = null;
      let aiConfidence = null;
      
      if (!transactionData.category && transactionData.vendor) {
        const aiResult = await categorizeTransaction(
          transactionData.vendor,
          parseFloat(transactionData.amount),
          transactionData.description
        );
        
        aiCategory = aiResult.category;
        aiConfidence = aiResult.confidence.toString();
        
        // Store AI suggestion
        await storage.createAiSuggestion({
          userId: user.id,
          suggestionType: "categorization",
          originalPrompt: `${transactionData.vendor} - ${transactionData.description}`,
          aiResponse: aiResult,
          confidence: aiResult.confidence.toString(),
        });
      }
      
      const transaction = await storage.createTransaction({
        ...transactionData,
        aiCategory,
        aiConfidence,
        category: transactionData.category || aiCategory,
      });
      
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
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

      // Exchange public token for access token
      const accessToken = await exchangePublicToken(public_token);
      
      // Get account information
      const accountsData = await getAccounts(accessToken);
      
      // Store bank connections for each account
      const connections = [];
      for (const account of accountsData.accounts) {
        const user = req.user as User;
        const connectionData = {
          userId: user.id,
          plaidItemId: accountsData.item.item_id,
          plaidAccessToken: accessToken,
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
        connections: connections.length 
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
      
      for (const connection of connections) {
        try {
          // Sync transactions from the last sync date
          const newTransactions = await syncTransactions(
            connection.plaidAccessToken, 
            user.id, 
            connection.lastSyncAt || undefined
          );

          // Create transactions in database
          for (const transactionData of newTransactions) {
            try {
              await storage.createTransaction(transactionData);
              totalSynced++;
            } catch (error) {
              // Skip duplicates (likely existing transactions)
              console.log("Skipping duplicate transaction:", transactionData.plaidTransactionId);
            }
          }

          // Update last sync date
          await storage.updateBankConnection(connection.id, {
            lastSyncAt: new Date()
          });
        } catch (error) {
          console.error(`Error syncing transactions for connection ${connection.id}:`, error);
        }
      }

      res.json({ 
        message: `Successfully synced ${totalSynced} new transactions`,
        syncedCount: totalSynced 
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

  const httpServer = createServer(app);
  return httpServer;
}
