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

  const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const actor = req.user as User;
      const collaborator = await storage.getActiveCollaboratorForUser(actor.id);
      const subscriptionUser = collaborator ? await storage.getUser(collaborator.ownerUserId) : actor;
      if (!subscriptionUser) {
        return res.status(403).json({ message: "Subscription required", trialExpired: true, readOnly: true });
      }

      if (!checkSubscriptionAccess(subscriptionUser)) {
        const method = (req.method || "GET").toUpperCase();
        const isReadMethod = method === "GET" || method === "HEAD" || method === "OPTIONS";
        const isExportRoute = req.path.includes("/export/");
        if (isReadMethod && !isExportRoute) {
          // Read-only access after trial expiry: allow data viewing, block writes and exports.
          return next();
        }
        return res.status(403).json({
          message: "Subscription required",
          trialExpired: true,
          readOnly: true,
        });
      }
      next();
    } catch (error) {
      console.error("Subscription check failed:", error);
      return res.status(500).json({ message: "Subscription check failed" });
    }
  };

  const requireOwnerAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as User | undefined;
      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const hasCollaboratorAccess = await storage.hasActiveCollaboratorAccess(user.id);
      if (hasCollaboratorAccess) {
        return res.status(403).json({
          message: "Owner permissions required for this action",
        });
      }
      next();
    } catch (error) {
      console.error("Owner permission check failed:", error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };

  const requireOwnerOrCollaboratorRoles = (allowedRoles: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = req.user as User | undefined;
        if (!user) {
          return res.status(401).json({ message: "Authentication required" });
        }
        const collaborator = await storage.getActiveCollaboratorForUser(user.id);
        // Owner account (not a collaborator) always allowed.
        if (!collaborator) return next();
        if (allowedRoles.includes(collaborator.role)) return next();
        return res.status(403).json({
          message: "Insufficient collaborator role permissions",
          requiredRoles: allowedRoles,
          role: collaborator.role,
        });
      } catch (error) {
        console.error("Role permission check failed:", error);
        return res.status(500).json({ message: "Permission check failed" });
      }
    };
  };

  const generateToken = (size = 32) => crypto.randomBytes(size).toString("hex");

  const getDataOwnerUserId = async (user: User): Promise<string> => {
    const collaborator = await storage.getActiveCollaboratorForUser(user.id);
    return collaborator?.ownerUserId || user.id;
  };

  const deriveTxnKind = (input: {
    txnKind?: string | null;
    isTransfer?: boolean | null;
    isExpense?: boolean | null;
  }): string => {
    if (input.txnKind) return input.txnKind;
    if (input.isTransfer) return "transfer";
    if (input.isExpense === false) return "income";
    return "expense";
  };

  const mapTxnKindToLegacyFlags = (txnKind: string, currentIsExpense?: boolean, currentIsTransfer?: boolean) => {
    if (txnKind === "transfer") {
      return { isTransfer: true, isExpense: false };
    }
    if (txnKind === "income") {
      return { isTransfer: false, isExpense: false };
    }
    if (txnKind === "expense") {
      return { isTransfer: false, isExpense: true };
    }
    // For equity, keep transfer false and keep expense flag as-is for compatibility.
    if (txnKind === "equity") {
      return { isTransfer: false, isExpense: currentIsExpense ?? true };
    }
    return {
      isTransfer: currentIsTransfer ?? false,
      isExpense: currentIsExpense ?? true,
    };
  };

  const isSameStatementMonth = (a: Date, statementMonth: Date) => (
    a.getUTCFullYear() === statementMonth.getUTCFullYear() &&
    a.getUTCMonth() === statementMonth.getUTCMonth()
  );

  const toStatementMonthUtc = (d: Date): Date =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));

  const isPeriodLockedError = (error: unknown): boolean =>
    error instanceof Error && error.message === "PERIOD_LOCKED";

  const upsertOpenReviewItem = async (
    ownerUserId: string,
    kind: "txn_kind" | "category" | "receipt_match" | "reconciliation",
    entityType: "transaction" | "receipt" | "bank_statement",
    entityId: string,
    prompt: string,
    optionsJson?: any,
    modelSuggestionJson?: any
  ) => {
    const openItems = await storage.getOpenReviewItems(ownerUserId);
    const existing = openItems.find((item) =>
      item.kind === kind &&
      item.entityType === entityType &&
      item.entityId === entityId
    );
    if (existing) return existing;
    return storage.createReviewItem({
      ownerUserId,
      status: "open",
      kind,
      entityType,
      entityId,
      prompt,
      optionsJson: optionsJson ?? null,
      modelSuggestionJson: modelSuggestionJson ?? null,
      resolvedAt: null,
    });
  };

  const resolveOpenReviewItemsForEntity = async (
    ownerUserId: string,
    entityType: "transaction" | "receipt" | "bank_statement",
    entityId: string
  ) => {
    const openItems = await storage.getOpenReviewItems(ownerUserId);
    const matching = openItems.filter((item) => item.entityType === entityType && item.entityId === entityId);
    for (const item of matching) {
      await storage.updateReviewItem(item.id, {
        status: "resolved",
        resolvedAt: new Date(),
      });
    }
  };

  const reviewKindPriority: Record<string, number> = {
    txn_kind: 0,
    reconciliation: 1,
    receipt_match: 2,
    category: 3,
  };

  const getReviewKindPriority = (kind: string): number => {
    const value = reviewKindPriority[kind];
    return Number.isFinite(value) ? value : 99;
  };

  const enrichReviewItem = async (ownerUserId: string, item: any) => {
    if (item.entityType === "transaction") {
      const txn = await storage.getTransaction(item.entityId);
      if (!txn || txn.userId !== ownerUserId) return item;
      return {
        ...item,
        context: {
          amount: txn.amount,
          date: txn.date,
          merchant: txn.vendor || txn.description || "",
          account_id: txn.accountId || null,
          txn_kind: txn.txnKind || deriveTxnKind(txn as any),
          category: txn.category || null,
        },
      };
    }
    if (item.entityType === "receipt") {
      const receipt = await storage.getReceiptById(item.entityId);
      if (!receipt || receipt.userId !== ownerUserId) return item;
      return {
        ...item,
        context: {
          amount: receipt.extractedAmount || null,
          date: receipt.extractedDate || null,
          merchant: receipt.extractedVendor || "",
          status: receipt.status,
          is_matched: Boolean(receipt.isMatched),
        },
      };
    }
    if (item.entityType === "bank_statement") {
      const meta = (item.modelSuggestionJson as any) || {};
      return {
        ...item,
        context: {
          statement_difference: meta?.difference ?? null,
          statement_ending_balance: meta?.endingBalance ?? null,
          book_ending_balance: meta?.bookEndingBalance ?? null,
        },
      };
    }
    return item;
  };

  const getPeriodBoundsUtc = (periodMonth: Date) => {
    const start = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth(), 1, 0, 0, 0));
    const end = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, 0, 23, 59, 59));
    return { start, end };
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
          ...(process.env.NODE_ENV !== "production" ? { verifyToken: emailVerificationToken } : {})
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
    const send = async () => {
      const collaborator = await storage.getActiveCollaboratorForUser(user.id);
      const subscriptionUser = collaborator ? await storage.getUser(collaborator.ownerUserId) : user;
      const effectiveSubscriptionStatus = subscriptionUser?.subscriptionStatus || user.subscriptionStatus;
      const effectiveTrialDaysRemaining = subscriptionUser ? getTrialDaysRemaining(subscriptionUser) : getTrialDaysRemaining(user);
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
          subscriptionStatus: effectiveSubscriptionStatus,
          trialDaysRemaining: effectiveTrialDaysRemaining
        } 
      });
    };
    send().catch((err) => {
      console.error("Auth me failed:", err);
      res.status(500).json({ message: "Failed to load auth state" });
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
      message: "If that email exists, a reset link has been generated.",
      ...(process.env.NODE_ENV !== "production" ? { resetToken: token, expiresAt: expires } : {}),
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
    const ownerUserId = await getDataOwnerUserId(user);
    const profileUser = ownerUserId === user.id ? user : await storage.getUser(ownerUserId);
    if (!profileUser) return res.status(404).json({ message: "Profile not found" });
    res.json({
      legalName: profileUser.businessName || "",
      firstName: profileUser.firstName || "",
      lastName: profileUser.lastName || "",
      email: profileUser.email,
      province: profileUser.province || "",
      address: profileUser.address || "",
      fiscalYearStart: profileUser.fiscalYearStart,
      gstRegistered: Boolean(profileUser.gstRegistered),
      gstNumber: profileUser.gstNumber || "",
      gstFilingFrequency: profileUser.gstFilingFrequency || "annual",
    });
  });

  app.put("/api/profile", requireAuth, requireOwnerOrCollaboratorRoles(["accountant"]), async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const targetUser = ownerUserId === user.id ? user : await storage.getUser(ownerUserId);
      if (!targetUser) return res.status(404).json({ message: "Profile not found" });
      const updates: Partial<User> = {
        businessName: req.body?.legalName ?? req.body?.businessName ?? targetUser.businessName,
        firstName: req.body?.firstName ?? targetUser.firstName,
        lastName: req.body?.lastName ?? targetUser.lastName,
        province: req.body?.province ?? targetUser.province,
        address: req.body?.address ?? targetUser.address,
        gstRegistered: typeof req.body?.gstRegistered === "boolean" ? req.body.gstRegistered : targetUser.gstRegistered,
        gstNumber: req.body?.gstNumber ?? targetUser.gstNumber,
        gstFilingFrequency: req.body?.gstFilingFrequency ?? targetUser.gstFilingFrequency,
      };

      if (req.body?.fiscalYearStart) {
        updates.fiscalYearStart = new Date(req.body.fiscalYearStart);
      }

      const updated = await storage.updateUserProfile(ownerUserId, updates);
      const beforeSnapshot = {
        businessName: targetUser.businessName,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        province: targetUser.province,
        address: targetUser.address,
        gstRegistered: targetUser.gstRegistered,
        gstNumber: targetUser.gstNumber,
        gstFilingFrequency: targetUser.gstFilingFrequency,
        fiscalYearStart: targetUser.fiscalYearStart,
      };
      const afterSnapshot = {
        businessName: updated.businessName,
        firstName: updated.firstName,
        lastName: updated.lastName,
        province: updated.province,
        address: updated.address,
        gstRegistered: updated.gstRegistered,
        gstNumber: updated.gstNumber,
        gstFilingFrequency: updated.gstFilingFrequency,
        fiscalYearStart: updated.fiscalYearStart,
      };
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "profile.updated", "user", ownerUserId, {
        actorUserId: user.id,
        ownerUserId,
        before: beforeSnapshot,
        after: afterSnapshot,
      });
      res.json({ ok: true, data: { user: updated }, user: updated });
    } catch (error) {
      console.error("Profile update failed:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Collaborator access
  app.post("/api/access/invite", requireAuth, requireOwnerAccount, async (req, res) => {
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

      const existing = (await storage.getCollaboratorsByOwner(owner.id)).find((c) =>
        c.invitedEmail.toLowerCase() === email && (c.status === "invited" || c.status === "active")
      );
      if (existing) {
        return res.status(409).json({ message: "ALREADY_INVITED" });
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

      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(owner.id, "access.invite_created", "collaborator", collaborator.id, {
        invitedEmail: email,
        role,
        status: "invited",
      });

      res.json({
        ok: true,
        data: {
          collaboratorId: collaborator.id,
          inviteToken,
          expiresAt: inviteExpiresAt,
        },
        collaboratorId: collaborator.id,
        inviteToken,
        expiresAt: inviteExpiresAt,
      });
    } catch (error) {
      console.error("Invite collaborator failed:", error);
      res.status(500).json({ message: "Failed to create invite" });
    }
  });

  app.post("/api/access/collaborators/:id/resend", requireAuth, requireOwnerAccount, async (req, res) => {
    try {
      const owner = req.user as User;
      const items = await storage.getCollaboratorsByOwner(owner.id);
      const target = items.find((item) => item.id === req.params.id);
      if (!target) {
        return res.status(404).json({ message: "Collaborator invite not found" });
      }
      if (target.status !== "invited") {
        return res.status(400).json({ message: "Only invited collaborators can be resent" });
      }

      const inviteToken = generateToken(24);
      const inviteExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      const updated = await storage.updateCollaborator(owner.id, target.id, {
        inviteToken,
        inviteExpiresAt,
      });

      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(owner.id, "access.invite_resent", "collaborator", target.id, {
        invitedEmail: target.invitedEmail,
      });

      res.json({
        ok: true,
        data: {
          collaborator: updated,
          inviteToken,
          expiresAt: inviteExpiresAt,
        },
        collaborator: updated,
        inviteToken,
        expiresAt: inviteExpiresAt,
      });
    } catch (error) {
      console.error("Resend collaborator invite failed:", error);
      res.status(500).json({ message: "Failed to resend invite" });
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
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(user.id, "access.invite_accepted", "collaborator", invite.id, {
        ownerUserId: invite.ownerUserId,
      });
      res.json({ ok: true, data: { accepted: true } });
    } catch (error) {
      console.error("Accept invite failed:", error);
      res.status(500).json({ message: "Failed to accept invite" });
    }
  });

  app.get("/api/access/collaborators", requireAuth, requireOwnerAccount, async (req, res) => {
    try {
      const owner = req.user as User;
      const items = await storage.getCollaboratorsByOwner(owner.id);
      res.json({ ok: true, data: { items }, items });
    } catch (error) {
      console.error("Get collaborators failed:", error);
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  app.delete("/api/access/collaborators/:id", requireAuth, requireOwnerAccount, async (req, res) => {
    try {
      const owner = req.user as User;
      const items = await storage.getCollaboratorsByOwner(owner.id);
      const target = items.find((item) => item.id === req.params.id);
      await storage.deleteCollaborator(owner.id, req.params.id);
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(owner.id, "access.collaborator_removed", "collaborator", req.params.id, {
        invitedEmail: target?.invitedEmail,
      });
      res.json({ ok: true, data: { removed: true } });
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
      const ownerUserId = await getDataOwnerUserId(user);
      const conns = await storage.getBankConnections(ownerUserId);
      const dedup = new Map<string, any>();
      for (const c of conns) {
        if (!dedup.has(c.accountId)) {
          dedup.set(c.accountId, {
            bank_account_id: c.accountId,
            name: `${c.bankName} ${c.accountName}`,
          });
        }
      }
      const accounts = Array.from(dedup.values());
      res.json({ ok: true, data: { accounts }, accounts });
    } catch (error) {
      console.error("Reconciliation accounts failed:", error);
      res.status(500).json({ message: "Failed to load reconciliation accounts" });
    }
  });

  app.get("/api/reconciliation/:bank_account_id/:statement_month", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }

      let statement = await storage.getBankStatement(ownerUserId, bankAccountId, statementMonth);
      const statementEndDate = statement?.statementEndDate
        ? new Date(statement.statementEndDate)
        : new Date(Date.UTC(statementMonth.getUTCFullYear(), statementMonth.getUTCMonth() + 1, 0, 23, 59, 59));

      const bookEndingBalance = await storage.getBookEndingBalance(ownerUserId, bankAccountId, statementEndDate);
      const unclearedBase = await storage.getUnclearedTransactions(ownerUserId, bankAccountId, statementEndDate);

      let clearedIds = new Set<string>();
      if (statement) {
        const clears = await storage.getTransactionClearsForStatement(statement.id);
        clearedIds = new Set(clears.filter(c => c.cleared).map(c => c.transactionId));
      }
      const unclearedTransactions = unclearedBase.filter(t => !clearedIds.has(t.id));
      const clearedTransactions = unclearedBase.filter(t => clearedIds.has(t.id));

      const endingBal = statement ? Number(statement.endingBalance) : 0;
      const difference = statement ? endingBal - bookEndingBalance : 0;

      res.json({
        ok: true,
        data: {
          statement: statement || null,
          book_ending_balance: bookEndingBalance,
          difference,
          uncleared_transactions: unclearedTransactions,
          cleared_transactions: clearedTransactions,
        },
        statement: statement || null,
        book_ending_balance: bookEndingBalance,
        difference,
        uncleared_transactions: unclearedTransactions,
        cleared_transactions: clearedTransactions,
      });
    } catch (error) {
      console.error("Reconciliation fetch failed:", error);
      res.status(500).json({ message: "Failed to fetch reconciliation data" });
    }
  });

  app.put("/api/reconciliation/:bank_account_id/:statement_month", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const existingClose = await storage.getPeriodClose(ownerUserId, bankAccountId, statementMonth);
      if (existingClose?.status === "closed") {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before editing reconciliation." });
      }
      const statementEndDate = req.body?.statement_end_date ? new Date(req.body.statement_end_date) : null;
      const endingBalance = req.body?.ending_balance;
      if (!statementEndDate || endingBalance === undefined || endingBalance === null) {
        return res.status(400).json({ message: "statement_end_date and ending_balance are required" });
      }
      if (!isSameStatementMonth(statementEndDate, statementMonth)) {
        return res.status(400).json({ message: "statement_end_date must be within the selected statement month" });
      }

      const statement = await storage.upsertBankStatement({
        ownerUserId,
        bankAccountId,
        statementMonth,
        statementEndDate,
        endingBalance: String(endingBalance),
        currency: "CAD",
      });

      const bookEndingBalance = await storage.getBookEndingBalance(ownerUserId, bankAccountId, statementEndDate);
      const difference = Number(endingBalance) - bookEndingBalance;

      if (Math.abs(difference) > 0.005) {
        await upsertOpenReviewItem(
          ownerUserId,
          "reconciliation",
          "bank_statement",
          statement.id,
          "Statement ending balance does not match books. Confirm missing/uncleared transactions.",
          [
            { label: "Recheck uncleared items", value: "recheck_uncleared" },
            { label: "Adjust statement balance", value: "adjust_statement" },
          ],
          { difference, bookEndingBalance, endingBalance: Number(endingBalance) }
        );
      } else {
        await resolveOpenReviewItemsForEntity(ownerUserId, "bank_statement", statement.id);
      }

      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "reconciliation.statement_saved", "bank_statement", statement.id, {
        statementMonth: req.params.statement_month,
        bankAccountId,
        endingBalance: Number(endingBalance),
        difference,
      });

      res.json({
        ok: true,
        data: { statement, book_ending_balance: bookEndingBalance, difference },
        statement,
        book_ending_balance: bookEndingBalance,
        difference,
      });
    } catch (error) {
      console.error("Reconciliation save failed:", error);
      res.status(500).json({ message: "Failed to save statement" });
    }
  });

  app.post("/api/reconciliation/:bank_account_id/:statement_month/auto-clear", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const existingClose = await storage.getPeriodClose(ownerUserId, bankAccountId, statementMonth);
      if (existingClose?.status === "closed") {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before changing clear flags." });
      }
      const statement = await storage.getBankStatement(ownerUserId, bankAccountId, statementMonth);
      if (!statement) {
        return res.status(400).json({ message: "Create statement first" });
      }

      const clearTo = req.body?.clear_up_to_date ? new Date(req.body.clear_up_to_date) : new Date(statement.statementEndDate);
      const txns = await storage.getUnclearedTransactions(ownerUserId, bankAccountId, clearTo);
      let count = 0;
      for (const t of txns) {
        await storage.setTransactionClear({
          ownerUserId,
          bankStatementId: statement.id,
          transactionId: t.id,
          cleared: true,
        });
        count += 1;
      }
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "reconciliation.auto_clear", "bank_statement", statement.id, {
        clearedCount: count,
        clearTo: clearTo.toISOString(),
      });
      res.json({ ok: true, data: { cleared_count: count }, cleared_count: count });
    } catch (error) {
      console.error("Reconciliation auto-clear failed:", error);
      res.status(500).json({ message: "Failed to auto-clear transactions" });
    }
  });

  app.post("/api/reconciliation/:bank_account_id/:statement_month/clear", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const existingClose = await storage.getPeriodClose(ownerUserId, bankAccountId, statementMonth);
      if (existingClose?.status === "closed") {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before changing clear flags." });
      }
      const statement = await storage.getBankStatement(ownerUserId, bankAccountId, statementMonth);
      if (!statement) {
        return res.status(400).json({ message: "Create statement first" });
      }

      const transactionId = String(req.body?.transaction_id || "");
      const cleared = Boolean(req.body?.cleared);
      if (!transactionId) {
        return res.status(400).json({ message: "transaction_id is required" });
      }
      await storage.setTransactionClear({
        ownerUserId,
        bankStatementId: statement.id,
        transactionId,
        cleared,
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "reconciliation.clear_toggled", "transaction", transactionId, {
        bankStatementId: statement.id,
        cleared,
      });
      res.json({ ok: true, data: { updated: true } });
    } catch (error) {
      console.error("Reconciliation clear toggle failed:", error);
      res.status(500).json({ message: "Failed to set clear status" });
    }
  });

  app.post("/api/reconciliation/:bank_account_id/:statement_month/finish", requireAuth, requireSubscription, requireOwnerAccount, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const statementMonth = parseMonth(req.params.statement_month);
      if (!statementMonth) {
        return res.status(400).json({ message: "Invalid statement month, use YYYY-MM" });
      }
      const existingClose = await storage.getPeriodClose(ownerUserId, bankAccountId, statementMonth);
      if (existingClose?.status === "closed") {
        return res.json({
          ok: true,
          data: {
            finished: true,
            already_closed: true,
          },
          finished: true,
          already_closed: true,
        });
      }

      const statement = await storage.getBankStatement(ownerUserId, bankAccountId, statementMonth);
      if (!statement) {
        return res.status(400).json({ message: "Create and save statement first" });
      }

      const statementEndDate = new Date(statement.statementEndDate);
      const { start: periodStart, end: periodEnd } = getPeriodBoundsUtc(statementMonth);

      const [bookEndingBalance, transactions, openItems] = await Promise.all([
        storage.getBookEndingBalance(ownerUserId, bankAccountId, statementEndDate),
        storage.getTransactions(ownerUserId),
        storage.getOpenReviewItems(ownerUserId),
      ]);

      const difference = Number(statement.endingBalance) - bookEndingBalance;
      const tolerance = 0.005;
      const isBalanced = Math.abs(difference) <= tolerance;

      const periodTransactions = transactions.filter((t) => {
        if (t.accountId !== bankAccountId) return false;
        const d = new Date(t.date);
        return d >= periodStart && d <= periodEnd;
      });
      const periodTxnIds = new Set(periodTransactions.map((t) => t.id));

      const unresolvedCritical = openItems.filter((item) =>
        (item.kind === "reconciliation" && item.entityType === "bank_statement" && item.entityId === statement.id) ||
        (item.kind === "txn_kind" && item.entityType === "transaction" && periodTxnIds.has(item.entityId))
      );

      const uncategorizedExpenseCount = periodTransactions.filter((t) => {
        const kind = deriveTxnKind(t as any);
        return kind === "expense" && !t.category;
      }).length;

      const checklist = {
        balanced: isBalanced,
        unresolved_critical_review_items: unresolvedCritical.length,
        uncategorized_expense_transactions: uncategorizedExpenseCount,
      };

      if (!isBalanced || unresolvedCritical.length > 0 || uncategorizedExpenseCount > 0) {
        return res.status(409).json({
          ok: false,
          message: "Reconciliation cannot be finished yet.",
          difference,
          checklist,
        });
      }

      await resolveOpenReviewItemsForEntity(ownerUserId, "bank_statement", statement.id);
      await storage.upsertPeriodClose({
        ownerUserId,
        bankAccountId,
        periodMonth: statementMonth,
        status: "closed",
        closedAt: new Date(),
        closedBy: user.id,
        reopenReason: null,
      });

      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "reconciliation.finished", "bank_statement", statement.id, {
        actorUserId: user.id,
        statementMonth: req.params.statement_month,
        bankAccountId,
        difference,
        checklist,
      });

      res.json({
        ok: true,
        data: {
          finished: true,
          status: "closed",
          difference,
          checklist,
        },
        finished: true,
        status: "closed",
        difference,
        checklist,
      });
    } catch (error) {
      console.error("Reconciliation finish failed:", error);
      res.status(500).json({ message: "Failed to finish reconciliation" });
    }
  });

  app.get("/api/period-close/:bank_account_id/:period_month", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const periodMonth = parseMonth(req.params.period_month);
      if (!periodMonth) {
        return res.status(400).json({ message: "Invalid period month, use YYYY-MM" });
      }
      const row = await storage.getPeriodClose(ownerUserId, bankAccountId, periodMonth);
      res.json({
        ok: true,
        data: {
          status: row?.status || "open",
          closed_at: row?.closedAt || null,
          closed_by: row?.closedBy || null,
          reopen_reason: row?.reopenReason || null,
        },
        status: row?.status || "open",
        closed_at: row?.closedAt || null,
        closed_by: row?.closedBy || null,
        reopen_reason: row?.reopenReason || null,
      });
    } catch (error) {
      console.error("Period close status failed:", error);
      res.status(500).json({ message: "Failed to fetch period close status" });
    }
  });

  app.post("/api/period-close/:bank_account_id/:period_month/close", requireAuth, requireSubscription, requireOwnerAccount, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const periodMonth = parseMonth(req.params.period_month);
      if (!periodMonth) {
        return res.status(400).json({ message: "Invalid period month, use YYYY-MM" });
      }

      const existingClose = await storage.getPeriodClose(ownerUserId, bankAccountId, periodMonth);
      if (existingClose?.status === "closed") {
        return res.json({ ok: true, data: { status: "closed", already_closed: true }, status: "closed", already_closed: true });
      }

      const statement = await storage.getBankStatement(ownerUserId, bankAccountId, periodMonth);
      if (!statement) {
        return res.status(400).json({ message: "A saved statement is required before closing this period" });
      }
      const statementEndDate = new Date(statement.statementEndDate);
      const bookEndingBalance = await storage.getBookEndingBalance(ownerUserId, bankAccountId, statementEndDate);
      const difference = Number(statement.endingBalance) - bookEndingBalance;
      const { start: periodStart, end: periodEnd } = getPeriodBoundsUtc(periodMonth);
      const [openItems, txns] = await Promise.all([
        storage.getOpenReviewItems(ownerUserId),
        storage.getTransactions(ownerUserId),
      ]);
      const periodTransactions = txns.filter((t) => t.accountId === bankAccountId && new Date(t.date) >= periodStart && new Date(t.date) <= periodEnd);
      const txnIds = new Set(periodTransactions
        .filter((t) => t.accountId === bankAccountId && new Date(t.date) >= periodStart && new Date(t.date) <= periodEnd)
        .map((t) => t.id));
      const unresolvedCriticalCount = openItems.filter((item) =>
        (item.kind === "reconciliation" && item.entityType === "bank_statement" && item.entityId === statement.id) ||
        (item.kind === "txn_kind" && item.entityType === "transaction" && txnIds.has(item.entityId))
      ).length;
      const uncategorizedExpenseCount = periodTransactions.filter((t) => {
        const kind = deriveTxnKind(t as any);
        return kind === "expense" && !t.category;
      }).length;
      const checklist = {
        balanced: Math.abs(difference) <= 0.005,
        unresolved_critical_review_items: unresolvedCriticalCount,
        uncategorized_expense_transactions: uncategorizedExpenseCount,
      };
      if (!checklist.balanced || checklist.unresolved_critical_review_items > 0 || checklist.uncategorized_expense_transactions > 0) {
        return res.status(409).json({
          ok: false,
          message: "Cannot close period yet.",
          difference,
          checklist,
        });
      }

      const closed = await storage.upsertPeriodClose({
        ownerUserId,
        bankAccountId,
        periodMonth,
        status: "closed",
        closedAt: new Date(),
        closedBy: user.id,
        reopenReason: null,
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "period.closed", "period_close", closed.id, {
        actorUserId: user.id,
        bankAccountId,
        periodMonth: req.params.period_month,
      });

      res.json({ ok: true, data: { status: "closed", closed_at: closed.closedAt, closed_by: closed.closedBy }, status: "closed", closed_at: closed.closedAt, closed_by: closed.closedBy });
    } catch (error) {
      console.error("Period close failed:", error);
      res.status(500).json({ message: "Failed to close period" });
    }
  });

  app.post("/api/period-close/:bank_account_id/:period_month/reopen", requireAuth, requireSubscription, requireOwnerAccount, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const bankAccountId = req.params.bank_account_id;
      const periodMonth = parseMonth(req.params.period_month);
      if (!periodMonth) {
        return res.status(400).json({ message: "Invalid period month, use YYYY-MM" });
      }
      const reason = String(req.body?.reason || "").trim();
      if (!reason) {
        return res.status(400).json({ message: "reason is required" });
      }

      const opened = await storage.upsertPeriodClose({
        ownerUserId,
        bankAccountId,
        periodMonth,
        status: "open",
        closedAt: null,
        closedBy: null,
        reopenReason: reason,
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "period.reopened", "period_close", opened.id, {
        actorUserId: user.id,
        bankAccountId,
        periodMonth: req.params.period_month,
        reason,
      });

      res.json({ ok: true, data: { status: "open", reopen_reason: reason }, status: "open", reopen_reason: reason });
    } catch (error) {
      console.error("Period reopen failed:", error);
      res.status(500).json({ message: "Failed to reopen period" });
    }
  });

  // Chart of Accounts routes
  app.get("/api/chart-of-accounts", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);

      const [userAccounts, bankAccounts] = await Promise.all([
        storage.getChartOfAccounts(ownerUserId),
        storage.getBankAccountsForChartOfAccounts(ownerUserId),
      ]);

      // Always start with the standard defaults
      const defaultAccounts = CHART_OF_ACCOUNTS.map(account => ({
        ...account,
        userId: ownerUserId,
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
      const ownerUserId = await getDataOwnerUserId(user);
      const accountData = req.body;
      
      const account = await storage.createChartOfAccountsEntry(ownerUserId, accountData);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { id } = req.params;
      
      // Verify transaction belongs to user
      const transaction = await storage.getTransaction(id);
      if (!transaction || transaction.userId !== ownerUserId) {
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
      const ownerUserId = await getDataOwnerUserId(user);
      console.log(`Fetching transactions for owner context: ${ownerUserId}`);
      const transactions = await storage.getTransactions(ownerUserId);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { transactionIds, force = false } = req.body;
      
      let transactions;
      if (transactionIds && Array.isArray(transactionIds)) {
        // Categorize specific transactions - filter by user for security
        const allTransactions = await storage.getTransactions(ownerUserId);
        transactions = allTransactions.filter(t => transactionIds.includes(t.id));
      } else {
        // Categorize all uncategorized transactions
        const allTransactions = await storage.getTransactions(ownerUserId);
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
          if (isPeriodLockedError(error)) {
            results.push({
              id: transaction.id,
              status: 'locked',
              error: 'This period is closed. Reopen it before updating this transaction.',
            });
            continue;
          }
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
        await logBulkCat(ownerUserId, 'transaction.bulk_categorized', 'transaction', undefined, {
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
      const ownerUserId = await getDataOwnerUserId(user);
      const transactions = await storage.getTransactions(ownerUserId);
      const openItems = await storage.getOpenReviewItems(ownerUserId);
      const transactionItemIds = new Set(
        openItems
          .filter((item) => item.entityType === "transaction")
          .map((item) => item.entityId)
      );
      const reviewQueue = transactions.filter(t => t.needsReview || transactionItemIds.has(t.id));
      res.json(reviewQueue);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch review queue" });
    }
  });

  app.get("/api/review/items", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const openItems = await storage.getOpenReviewItems(ownerUserId);
      const sorted = [...openItems].sort((a, b) => {
        const p = getReviewKindPriority(a.kind) - getReviewKindPriority(b.kind);
        if (p !== 0) return p;
        const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTs - bTs;
      });
      const items = await Promise.all(sorted.map((item) => enrichReviewItem(ownerUserId, item)));
      res.json({ ok: true, data: { items }, items });
    } catch (error) {
      console.error("Failed fetching review items:", error);
      res.status(500).json({ message: "Failed to fetch review items" });
    }
  });

  app.post("/api/review/items", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { kind, entityType, entityId, prompt, optionsJson, modelSuggestionJson } = req.body || {};
      if (!kind || !entityType || !entityId || !prompt) {
        return res.status(400).json({ message: "kind, entityType, entityId, prompt are required" });
      }

      const item = await storage.createReviewItem({
        ownerUserId,
        status: "open",
        kind,
        entityType,
        entityId,
        prompt,
        optionsJson: optionsJson ?? null,
        modelSuggestionJson: modelSuggestionJson ?? null,
        resolvedAt: null,
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "review.item_created", "review_item", item.id, {
        kind,
        entityType,
        entityId,
      });
      res.json({ ok: true, data: { item }, item });
    } catch (error) {
      console.error("Failed creating review item:", error);
      res.status(500).json({ message: "Failed to create review item" });
    }
  });

  app.get("/api/review/items/:id/messages", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const item = await storage.getReviewItemById(req.params.id);
      if (!item || item.ownerUserId !== ownerUserId) {
        return res.status(404).json({ message: "Review item not found" });
      }
      const messages = await storage.getReviewMessages(req.params.id);
      res.json({ ok: true, data: { messages }, messages });
    } catch (error) {
      console.error("Failed fetching review messages:", error);
      res.status(500).json({ message: "Failed to fetch review messages" });
    }
  });

  app.post("/api/review/items/:id/messages", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const item = await storage.getReviewItemById(req.params.id);
      if (!item || item.ownerUserId !== ownerUserId) {
        return res.status(404).json({ message: "Review item not found" });
      }
      const payload = insertReviewMessageSchema.parse({
        reviewItemId: req.params.id,
        role: req.body?.role || "user",
        content: req.body?.content || "",
      });
      if (!payload.content.trim()) {
        return res.status(400).json({ message: "content is required" });
      }
      const message = await storage.createReviewMessage(payload);
      res.json({ ok: true, data: { message }, message });
    } catch (error) {
      console.error("Failed creating review message:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create review message" });
    }
  });

  app.post("/api/review/items/:id/resolve", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const openItems = await storage.getOpenReviewItems(ownerUserId);
      const item = openItems.find((i) => i.id === req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Open review item not found" });
      }
      const selectedOption = req.body?.selectedOption ? String(req.body.selectedOption) : null;
      if (selectedOption) {
        await storage.createReviewMessage({
          reviewItemId: item.id,
          role: "user",
          content: `Selected option: ${selectedOption}`,
        });
      }

      let requiresFollowUp = false;
      let followUpMessage: string | null = null;

      // Apply structured side-effects for known review item types/options.
      if (item.entityType === "transaction" && (item.kind === "txn_kind" || item.kind === "category")) {
        const transaction = await storage.getTransaction(item.entityId);
        if (!transaction || transaction.userId !== ownerUserId) {
          return res.status(404).json({ message: "Transaction not found for review item" });
        }

        const updates: Record<string, any> = {};

        if (item.kind === "txn_kind" && selectedOption) {
          if (selectedOption === "owner_draw" || selectedOption === "owner_contribution") {
            const flags = mapTxnKindToLegacyFlags(
              "equity",
              transaction.isExpense ?? true,
              transaction.isTransfer ?? false
            );
            updates.txnKind = "equity";
            updates.equityType = selectedOption;
            updates.isExpense = flags.isExpense;
            updates.isTransfer = flags.isTransfer;
          } else if (["expense", "income", "transfer", "equity"].includes(selectedOption)) {
            const flags = mapTxnKindToLegacyFlags(
              selectedOption,
              transaction.isExpense ?? true,
              transaction.isTransfer ?? false
            );
            updates.txnKind = selectedOption;
            updates.isExpense = flags.isExpense;
            updates.isTransfer = flags.isTransfer;
            if (selectedOption !== "equity") {
              updates.equityType = null;
            }
          }
        }

        if (item.kind === "category" && selectedOption) {
          if (selectedOption === "accept_ai") {
            if (transaction.aiCategory) {
              updates.category = transaction.aiCategory;
            }
          } else if (!["choose_other", "mark_reviewed", "edit_classification"].includes(selectedOption)) {
            // Treat option as an explicit category value.
            updates.category = selectedOption;
          } else if (selectedOption === "choose_other" || selectedOption === "edit_classification") {
            requiresFollowUp = true;
            followUpMessage = "Pick a specific category in Transactions, then resolve this review item.";
          }
        }

        if (!requiresFollowUp) {
          updates.needsReview = false;
          updates.isReviewed = true;
          await storage.updateTransaction(transaction.id, updates);
        }
      }

      if (item.entityType === "receipt" && item.kind === "receipt_match") {
        const receipt = await storage.getReceiptById(item.entityId);
        if (selectedOption === "manual_link" || selectedOption === "create_transaction") {
          requiresFollowUp = true;
          followUpMessage =
            selectedOption === "manual_link"
              ? "Open Receipts and link this receipt manually to a transaction."
              : "Create a matching transaction first, then link this receipt.";
        } else if (selectedOption === "confirm" && receipt && receipt.userId === ownerUserId && !receipt.isMatched) {
          const modelSuggestion = (item.modelSuggestionJson as any) || {};
          const suggestions = Array.isArray(modelSuggestion?.suggestions) ? modelSuggestion.suggestions : [];
          const bestMatch = suggestions[0];
          if (bestMatch?.id) {
            const bestMatchTransaction = await storage.getTransaction(String(bestMatch.id));
            if (!bestMatchTransaction || bestMatchTransaction.userId !== ownerUserId) {
              return res.status(400).json({ message: "Suggested match is invalid for this account" });
            }
            await storage.updateReceipt(receipt.id, {
              isMatched: true,
              matchedTransactionId: String(bestMatch.id),
              matchConfidence: bestMatch.matchScore ? String(Number(bestMatch.matchScore) / 100) : "0.9",
              status: "matched",
              updatedAt: new Date(),
            });
            await storage.updateTransaction(String(bestMatch.id), {
              receiptId: receipt.id,
              receiptAttached: true,
              receiptSource: "upload",
              auditReady: true,
              updatedAt: new Date(),
            });
          }
        }
      }

      if (item.kind === "reconciliation" && (selectedOption === "recheck_uncleared" || selectedOption === "adjust_statement")) {
        requiresFollowUp = true;
        followUpMessage =
          selectedOption === "recheck_uncleared"
            ? "Review uncleared transactions in Reconciliation, then resolve."
            : "Update the statement balance/end date in Reconciliation, then resolve.";
      }

      if (requiresFollowUp) {
        if (followUpMessage) {
          await storage.createReviewMessage({
            reviewItemId: item.id,
            role: "system",
            content: followUpMessage,
          });
        }
        const refreshed = await storage.getReviewItemById(item.id);
        return res.json({
          ok: true,
          requires_follow_up: true,
          follow_up_message: followUpMessage,
          data: { item: refreshed || item },
          item: refreshed || item,
        });
      }

      const updated = await storage.updateReviewItem(item.id, {
        status: "resolved",
        resolvedAt: new Date(),
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "review.item_resolved", "review_item", item.id, {
        kind: item.kind,
        entityType: item.entityType,
        entityId: item.entityId,
        selectedOption,
      });
      res.json({ ok: true, data: { item: updated }, item: updated });
    } catch (error) {
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before resolving this item." });
      }
      console.error("Failed resolving review item:", error);
      res.status(500).json({ message: "Failed to resolve review item" });
    }
  });

  app.post("/api/review/items/:id/skip", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const openItems = await storage.getOpenReviewItems(ownerUserId);
      const item = openItems.find((i) => i.id === req.params.id);
      if (!item) {
        return res.status(404).json({ message: "Open review item not found" });
      }
      const updated = await storage.updateReviewItem(item.id, {
        status: "skipped",
        resolvedAt: new Date(),
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "review.item_skipped", "review_item", item.id, {
        kind: item.kind,
        entityType: item.entityType,
        entityId: item.entityId,
      });
      res.json({ ok: true, data: { item: updated }, item: updated });
    } catch (error) {
      console.error("Failed skipping review item:", error);
      res.status(500).json({ message: "Failed to skip review item" });
    }
  });

  app.post("/api/review/items/:id/reopen", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const existing = await storage.getReviewItemById(req.params.id);
      if (!existing || existing.ownerUserId !== ownerUserId) {
        return res.status(404).json({ message: "Review item not found" });
      }
      const item = await storage.updateReviewItem(req.params.id, {
        status: "open",
        resolvedAt: null,
      });
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "review.item_reopened", "review_item", item.id, {
        actorUserId: user.id,
      });
      res.json({ ok: true, data: { item }, item });
    } catch (error) {
      console.error("Failed reopening review item:", error);
      res.status(500).json({ message: "Failed to reopen review item" });
    }
  });

  app.post("/api/transactions", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const transactionData = insertTransactionSchema.parse({
        ...req.body,
        userId: ownerUserId,
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
            userId: ownerUserId,
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
      
      const txnKind = deriveTxnKind({
        txnKind: req.body?.txnKind,
        isTransfer: transactionData.isTransfer,
        isExpense: transactionData.isExpense,
      });
      const equityType = req.body?.equityType || null;
      if (txnKind === "equity" && !equityType) {
        return res.status(400).json({ message: "equityType is required when txnKind is equity" });
      }
      const legacyFlags = mapTxnKindToLegacyFlags(
        txnKind,
        transactionData.isExpense ?? undefined,
        transactionData.isTransfer ?? undefined
      );

      if (transactionData.accountId) {
        const statementMonth = toStatementMonthUtc(new Date(transactionData.date));
        const existingClose = await storage.getPeriodClose(ownerUserId, transactionData.accountId, statementMonth);
        if (existingClose?.status === "closed") {
          return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before creating transactions in this month." });
        }
      }

      const transaction = await storage.createTransaction({
        ...transactionData,
        txnKind,
        equityType,
        isExpense: legacyFlags.isExpense,
        isTransfer: legacyFlags.isTransfer,
        aiCategory,
        aiConfidence,
        aiExplanation,
        needsReview,
        category: transactionData.category || aiCategory,
      });

      if (needsReview) {
        await upsertOpenReviewItem(
          ownerUserId,
          "category",
          "transaction",
          transaction.id,
          "Category confidence is low. Please confirm the best category.",
          [
            { label: "Accept AI category", value: "accept_ai" },
            { label: "Choose another category", value: "choose_other" },
          ],
          { aiCategory, aiConfidence }
        );
      }

      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "transaction.created", "transaction", transaction.id, {
        actorUserId: user.id,
        ownerUserId,
        txnKind,
        equityType,
        needsReview,
        after: {
          id: transaction.id,
          userId: transaction.userId,
          date: transaction.date,
          amount: transaction.amount,
          description: transaction.description,
          vendor: transaction.vendor,
          category: transaction.category,
          txnKind: transaction.txnKind,
          equityType: transaction.equityType,
          isExpense: transaction.isExpense,
          isTransfer: transaction.isTransfer,
          needsReview: transaction.needsReview,
          isReviewed: transaction.isReviewed,
        },
      });
      
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Transaction validation error:", error.errors);
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before editing transactions." });
      }
      console.error("Transaction creation error:", error);
      res.status(500).json({ message: "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const existing = await storage.getTransaction(req.params.id);
      if (!existing || existing.userId !== ownerUserId) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const updates: any = { ...req.body };
      const beforeSnapshot = {
        id: existing.id,
        userId: existing.userId,
        date: existing.date,
        amount: existing.amount,
        description: existing.description,
        vendor: existing.vendor,
        category: existing.category,
        txnKind: existing.txnKind,
        equityType: existing.equityType,
        isExpense: existing.isExpense,
        isTransfer: existing.isTransfer,
        needsReview: existing.needsReview,
        isReviewed: existing.isReviewed,
      };
      const hadOpenReviewsBefore = existing.needsReview;
      if (existing.isTransfer && updates.bankConnectionId) {
        return res.status(400).json({
          message: "Cannot change account for transfer transactions as it would break the transfer relationship",
        });
      }
      if (updates.txnKind) {
        const flags = mapTxnKindToLegacyFlags(
          updates.txnKind,
          existing.isExpense ?? true,
          existing.isTransfer ?? false
        );
        updates.isExpense = flags.isExpense;
        updates.isTransfer = flags.isTransfer;
      }

      if (updates.txnKind && updates.txnKind !== "equity") {
        updates.equityType = null;
      }
      if (updates.txnKind === "equity" && !updates.equityType && !existing.equityType) {
        return res.status(400).json({ message: "equityType is required when txnKind is equity" });
      }

      const transaction = await storage.updateTransaction(req.params.id, updates);
      const nextKind = updates.txnKind || existing.txnKind || deriveTxnKind(existing as any);
      const nextEquityType = updates.equityType ?? existing.equityType ?? null;
      const nextNeedsReview = updates.needsReview ?? existing.needsReview ?? false;

      if (nextNeedsReview) {
        await upsertOpenReviewItem(
          ownerUserId,
          "category",
          "transaction",
          transaction.id,
          "This transaction still needs review. Confirm kind/category.",
          [
            { label: "Mark reviewed", value: "mark_reviewed" },
            { label: "Edit classification", value: "edit_classification" },
          ]
        );
      } else if (hadOpenReviewsBefore || updates.isReviewed || updates.category || updates.txnKind || updates.equityType) {
        await resolveOpenReviewItemsForEntity(ownerUserId, "transaction", transaction.id);
      }

      if (nextKind === "equity" && !nextEquityType) {
        await upsertOpenReviewItem(
          ownerUserId,
          "txn_kind",
          "transaction",
          transaction.id,
          "Select owner equity type for this transaction.",
          [
            { label: "Owner Draw", value: "owner_draw" },
            { label: "Owner Contribution", value: "owner_contribution" },
          ]
        );
      }

      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "transaction.updated", "transaction", transaction.id, {
        actorUserId: user.id,
        ownerUserId,
        changedFields: Object.keys(updates),
        before: beforeSnapshot,
        after: {
          id: transaction.id,
          userId: transaction.userId,
          date: transaction.date,
          amount: transaction.amount,
          description: transaction.description,
          vendor: transaction.vendor,
          category: transaction.category,
          txnKind: transaction.txnKind,
          equityType: transaction.equityType,
          isExpense: transaction.isExpense,
          isTransfer: transaction.isTransfer,
          needsReview: transaction.needsReview,
          isReviewed: transaction.isReviewed,
        },
      });
      res.json(transaction);
    } catch (error) {
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before editing transactions." });
      }
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const existing = await storage.getTransaction(req.params.id);
      if (!existing || existing.userId !== ownerUserId) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      const beforeSnapshot = {
        id: existing.id,
        userId: existing.userId,
        date: existing.date,
        amount: existing.amount,
        description: existing.description,
        vendor: existing.vendor,
        category: existing.category,
        txnKind: existing.txnKind,
        equityType: existing.equityType,
        isExpense: existing.isExpense,
        isTransfer: existing.isTransfer,
        needsReview: existing.needsReview,
        isReviewed: existing.isReviewed,
      };
      await storage.deleteTransaction(req.params.id);
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "transaction.deleted", "transaction", req.params.id, {
        actorUserId: user.id,
        ownerUserId,
        before: beforeSnapshot,
      });
      res.json({ message: "Transaction deleted" });
    } catch (error) {
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before deleting transactions." });
      }
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Bulk operations endpoint
  app.post("/api/transactions/bulk", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { action, transactionIds } = req.body;
      
      if (!action || !transactionIds || !Array.isArray(transactionIds)) {
        return res.status(400).json({ message: "Invalid bulk action request" });
      }

      // Validate that all transactions belong to the user
      const userTransactions = await storage.getTransactions(ownerUserId);
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
            await logReview(ownerUserId, 'transaction.reviewed', 'transaction', id);
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
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "One or more selected transactions are in a closed period." });
      }
      console.error("Bulk action error:", error);
      res.status(500).json({ message: "Failed to perform bulk action" });
    }
  });

  // Receipt routes
  app.get("/api/receipts", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const receipts = await storage.getReceipts(ownerUserId);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  // Financial summary route
  app.get("/api/financial-summary", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const summary = await storage.getFinancialSummary(ownerUserId, start, end);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  // Expense breakdown endpoint
  app.get("/api/expense-breakdown", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const breakdown = await storage.getExpenseBreakdown(ownerUserId);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const trends = await storage.getMonthlyTrends(ownerUserId);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const insights = await storage.getAIInsights(ownerUserId);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Save user message
      await storage.createChatMessage({
        userId: ownerUserId,
        message,
        isFromUser: true,
      });

      // Get financial context
      const summary = await storage.getFinancialSummary(
        ownerUserId,
        new Date(new Date().getFullYear(), 0, 1), // Start of year
        new Date()
      );

      // Process with AI
      const aiResponse = await processFinancialQuery(message, ownerUserId, summary);

      // Save AI response
      await storage.createChatMessage({
        userId: ownerUserId,
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
      const ownerUserId = await getDataOwnerUserId(user);
      const history = await storage.getChatHistory(ownerUserId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat history" });
    }
  });

  // Stripe subscription routes  
  app.post("/api/create-subscription", requireAuth, requireOwnerAccount, async (req, res) => {
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

  app.post("/api/billing/portal", requireAuth, requireOwnerAccount, async (req, res) => {
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
  app.post("/api/plaid/create-link-token", requireAuth, requireOwnerAccount, async (req, res) => {
    try {
      const user = req.user as User;
      const linkToken = await createLinkToken(user.id);
      res.json({ link_token: linkToken });
    } catch (error) {
      console.error("Error creating link token:", error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });

  app.post("/api/plaid/exchange-public-token", requireAuth, requireOwnerAccount, async (req, res) => {
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
  app.post("/api/plaid/sync-transactions", requireAuth, requireSubscription, requireOwnerAccount, async (req, res) => {
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
      const ownerUserId = await getDataOwnerUserId(user);
      const connections = await storage.getBankConnections(ownerUserId);
      res.json(connections);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bank connections" });
    }
  });

  app.delete("/api/bank-connections/:id", requireAuth, requireSubscription, requireOwnerAccount, async (req, res) => {
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
      const ownerUserId = await getDataOwnerUserId(user);
      const clients = await storage.getClients(ownerUserId);
      res.json(clients);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const clientData = insertClientSchema.parse({
        ...req.body,
        userId: ownerUserId,
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
      const ownerUserId = await getDataOwnerUserId(user);
      const [invoices, clientList] = await Promise.all([
        storage.getInvoices(ownerUserId),
        storage.getClients(ownerUserId),
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { invoice: invoiceData, items } = req.body;
      
      // Generate invoice number
      const invoiceCount = await storage.getInvoices(ownerUserId);
      const invoiceNumber = `INV-${String(invoiceCount.length + 1).padStart(4, '0')}`;
      
      const parsedInvoice = insertInvoiceSchema.parse({
        ...invoiceData,
        userId: ownerUserId,
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
      const ownerUserId = await getDataOwnerUserId(user);
      const receipts = await storage.getReceipts(ownerUserId);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.get("/api/receipts/unmatched", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const unmatchedReceipts = await storage.getUnmatchedReceipts(ownerUserId);
      
      // For each unmatched receipt, find suggested transaction matches
      const receiptsWithSuggestions = await Promise.all(
        unmatchedReceipts.map(async (receipt) => {
          const suggestions = await findTransactionMatches(receipt, ownerUserId);
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
      const ownerUserId = await getDataOwnerUserId(user);
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
            userId: ownerUserId,
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
                const matches = await findTransactionMatches(updatedReceipt, ownerUserId);
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
                    try {
                      await storage.updateTransaction(topMatch.id, {
                        receiptAttached: true,
                        receiptId: receipt.id,
                      });
                      await resolveOpenReviewItemsForEntity(user.id, "receipt", receipt.id);
                    } catch (error) {
                      if (isPeriodLockedError(error)) {
                        await storage.updateReceipt(receipt.id, {
                          isMatched: false,
                          matchedTransactionId: null,
                          status: "unmatched",
                          updatedAt: new Date(),
                        });
                        await upsertOpenReviewItem(
                          user.id,
                          "receipt_match",
                          "receipt",
                          receipt.id,
                          "Suggested match is in a closed period. Reopen that period to attach this receipt.",
                          [
                            { label: "Reopen period", value: "reopen_period" },
                            { label: "Link manually", value: "manual_link" },
                          ],
                          { suggestions: matches.slice(0, 3) }
                        );
                      } else {
                        throw error;
                      }
                    }
                  } else {
                    await storage.updateReceipt(receipt.id, {
                      suggestedMatches: matches,
                      status: "unmatched",
                      updatedAt: new Date()
                    });
                    await upsertOpenReviewItem(
                      user.id,
                      "receipt_match",
                      "receipt",
                      receipt.id,
                      "Multiple possible transaction matches found. Confirm the correct transaction.",
                      [
                        { label: "Confirm best match", value: "confirm" },
                        { label: "Skip for now", value: "skip" },
                      ],
                      { suggestions: matches.slice(0, 3) }
                    );
                  }
                } else {
                  await storage.updateReceipt(receipt.id, {
                    status: "unmatched",
                    updatedAt: new Date()
                  });
                  await upsertOpenReviewItem(
                    user.id,
                    "receipt_match",
                    "receipt",
                    receipt.id,
                    "No reliable transaction match found for this receipt.",
                    [
                      { label: "Link manually", value: "manual_link" },
                      { label: "Create transaction", value: "create_transaction" },
                    ]
                  );
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
      const ownerUserId = await getDataOwnerUserId(user);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== ownerUserId) {
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
      const ownerUserId = await getDataOwnerUserId(user);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== ownerUserId) {
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
      const ownerUserId = await getDataOwnerUserId(user);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== ownerUserId) {
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { transactionId, action } = req.body;
      const receiptId = req.params.id;

      const receipt = await storage.getReceiptById(receiptId);
      if (!receipt || receipt.userId !== ownerUserId) {
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
        await resolveOpenReviewItemsForEntity(ownerUserId, "receipt", receiptId);
        const { logAuditEvent } = await import("./services/audit-log");
        await logAuditEvent(ownerUserId, "receipt.match_confirmed", "receipt", receiptId, {
          transactionId,
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
        const { logAuditEvent } = await import("./services/audit-log");
        await logAuditEvent(ownerUserId, "receipt.match_rejected", "receipt", receiptId, {
          transactionId,
        });

        res.json({ message: "Match suggestion rejected" });
      } else {
        res.status(400).json({ message: "Invalid action" });
      }

    } catch (error) {
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before matching receipts." });
      }
      res.status(500).json({ message: "Failed to process match" });
    }
  });

  app.delete("/api/receipts/:id", requireAuth, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const receipt = await storage.getReceiptById(req.params.id);
      
      if (!receipt || receipt.userId !== ownerUserId) {
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
      const { logAuditEvent } = await import("./services/audit-log");
      await logAuditEvent(ownerUserId, "receipt.deleted", "receipt", req.params.id);

      res.json({ message: "Receipt deleted successfully" });
    } catch (error) {
      if (isPeriodLockedError(error)) {
        return res.status(409).json({ code: "PERIOD_LOCKED", message: "This period is closed. Reopen it before unlinking receipts." });
      }
      res.status(500).json({ message: "Failed to delete receipt" });
    }
  });

  // Financial Reports Routes
  app.get("/api/reports/profit-loss", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;
      
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      
      const { generateProfitLossReport } = await import('./services/reports');
      const report = await generateProfitLossReport(ownerUserId, startDate, endDate);
      
      res.json(report);
    } catch (error) {
      console.error("P&L report error:", error);
      res.status(500).json({ message: "Failed to generate profit & loss report" });
    }
  });

  app.get("/api/reports/balance-sheet", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { asOf } = req.query;
      
      const asOfDate = asOf ? new Date(asOf as string) : new Date();
      
      const { generateBalanceSheetReport } = await import('./services/reports');
      const report = await generateBalanceSheetReport(ownerUserId, asOfDate);
      
      res.json(report);
    } catch (error) {
      console.error("Balance sheet report error:", error);
      res.status(500).json({ message: "Failed to generate balance sheet report" });
    }
  });

  app.get("/api/reports/tax-summary", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;
      
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      
      const { generateTaxSummaryReport } = await import('./services/reports');
      const report = await generateTaxSummaryReport(ownerUserId, startDate, endDate);
      
      res.json(report);
    } catch (error) {
      console.error("Tax summary report error:", error);
      res.status(500).json({ message: "Failed to generate tax summary report" });
    }
  });

  app.get("/api/reports/trial-balance", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { asOf } = req.query;
      
      const asOfDate = asOf ? new Date(asOf as string) : new Date();
      
      const { generateTrialBalanceReport } = await import('./services/reports');
      const report = await generateTrialBalanceReport(ownerUserId, asOfDate);
      
      res.json(report);
    } catch (error) {
      console.error("Trial balance report error:", error);
      res.status(500).json({ message: "Failed to generate trial balance report" });
    }
  });

  app.get("/api/reports/general-ledger", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;
      
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      
      const { generateGeneralLedgerReport } = await import('./services/reports');
      const report = await generateGeneralLedgerReport(ownerUserId, startDate, endDate);
      
      res.json(report);
    } catch (error) {
      console.error("General ledger report error:", error);
      res.status(500).json({ message: "Failed to generate general ledger report" });
    }
  });

  app.get("/api/reports/transfers-summary", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateTransferSummaryReport } = await import("./services/reports");
      const report = await generateTransferSummaryReport(ownerUserId, startDate, endDate);

      res.json(report);
    } catch (error) {
      console.error("Transfers summary report error:", error);
      res.status(500).json({ message: "Failed to generate transfers summary report" });
    }
  });

  app.get("/api/reports/owner-equity-summary", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateOwnerEquitySummaryReport } = await import("./services/reports");
      const report = await generateOwnerEquitySummaryReport(ownerUserId, startDate, endDate);

      res.json(report);
    } catch (error) {
      console.error("Owner equity summary report error:", error);
      res.status(500).json({ message: "Failed to generate owner equity summary report" });
    }
  });

  app.get("/api/reports/transfers-summary/export/csv", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      const { generateTransferSummaryReport, transferSummaryToCSV } = await import("./services/reports");
      const report = await generateTransferSummaryReport(ownerUserId, startDate, endDate);
      const csv = transferSummaryToCSV(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="TransfersSummary_${report.period.startDate}_${report.period.endDate}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Transfers summary CSV export error:", error);
      res.status(500).json({ message: "Failed to export transfers summary CSV" });
    }
  });

  app.get("/api/reports/owner-equity-summary/export/csv", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();
      const { generateOwnerEquitySummaryReport, ownerEquitySummaryToCSV } = await import("./services/reports");
      const report = await generateOwnerEquitySummaryReport(ownerUserId, startDate, endDate);
      const csv = ownerEquitySummaryToCSV(report);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="OwnerEquitySummary_${report.period.startDate}_${report.period.endDate}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Owner equity summary CSV export error:", error);
      res.status(500).json({ message: "Failed to export owner equity summary CSV" });
    }
  });

  // Monthly P&L breakdown
  app.get("/api/reports/profit-loss/monthly", requireAuth, requireSubscription, async (req, res) => {
    try {
      const user = req.user as User;
      const ownerUserId = await getDataOwnerUserId(user);
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      const { generateMonthlyPLReport } = await import('./services/reports');
      const report = await generateMonthlyPLReport(ownerUserId, year);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;
      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateGeneralLedgerReport, generalLedgerToCSV } = await import('./services/reports');
      const report = await generateGeneralLedgerReport(ownerUserId, startDate, endDate);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const { db } = await import('./db');
      const { auditLogs } = await import('@shared/schema');
      const { eq, desc } = await import('drizzle-orm');

      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, ownerUserId))
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateT2125Report } = await import('./services/t2125-report');
      const report = await generateT2125Report(ownerUserId, startDate, endDate);

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
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateT2125Report, reportToCSV } = await import('./services/t2125-report');
      const report = await generateT2125Report(ownerUserId, startDate, endDate);
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
      const ownerUserId = await getDataOwnerUserId(user);
      const { from, to } = req.query;

      const startDate = from ? new Date(from as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = to ? new Date(to as string) : new Date();

      const { generateT2125Report } = await import('./services/t2125-report');
      const report = await generateT2125Report(ownerUserId, startDate, endDate);

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
      const ownerUserId = await getDataOwnerUserId(user);
      const [estimateList, clientList] = await Promise.all([
        storage.getEstimates(ownerUserId),
        storage.getClients(ownerUserId),
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
      const ownerUserId = await getDataOwnerUserId(user);
      const period = req.params.period || 'current-month';
      
      // Get transactions for the user
      const transactions = await storage.getTransactions(ownerUserId);
      
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
        const rawAmount = parseFloat(transaction.amount) || 0;
        const amount = Math.abs(rawAmount);
        if (transaction.isExpense) {
          totalExpenses += amount;
          const category = transaction.category || 'Other';
          expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
        } else {
          totalRevenue += rawAmount;
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
            const rawAmount = parseFloat(t.amount) || 0;
            const amount = Math.abs(rawAmount);
            if (t.isExpense) {
              monthExpenses += amount;
            } else {
              monthRevenue += rawAmount;
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
