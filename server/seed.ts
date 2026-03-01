import { db } from "./db";
import { users, clients, invoices, invoiceItems, transactions } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./services/auth";

export async function seedDemoData() {
  try {
    const existing = await db.select().from(users).where(eq(users.email, "demo@bookkeepai.com")).limit(1);
    if (existing.length > 0) {
      const hashedPwCheck = await hashPassword("demo123");
      await db.update(users)
        .set({ password: hashedPwCheck, subscriptionStatus: "active" })
        .where(eq(users.email, "demo@bookkeepai.com"));
      console.log("[seed] Demo account credentials refreshed.");
      return;
    }

    const hashedPw = await hashPassword("demo123");
    const trialEnd = new Date();
    trialEnd.setFullYear(trialEnd.getFullYear() + 1);

    const [demoUser] = await db.insert(users).values({
      username: "demo",
      email: "demo@bookkeepai.com",
      password: hashedPw,
      businessName: "Acme Consulting Inc.",
      firstName: "Demo",
      lastName: "User",
      subscriptionStatus: "active",
      trialEndsAt: trialEnd,
    }).returning();

    const userId = demoUser.id;

    const [client1] = await db.insert(clients).values({
      userId,
      businessName: "Maple Tech Solutions",
      contactName: "Alice Tran",
      email: "alice@mapletech.ca",
      phone: "416-555-0101",
      city: "Toronto",
      province: "ON",
      country: "Canada",
      currency: "CAD",
      paymentTerms: 30,
      isActive: true,
    }).returning();

    const [client2] = await db.insert(clients).values({
      userId,
      businessName: "Northern Creative Studio",
      contactName: "Ben Park",
      email: "ben@northerncreative.ca",
      phone: "604-555-0202",
      city: "Vancouver",
      province: "BC",
      country: "Canada",
      currency: "CAD",
      paymentTerms: 15,
      isActive: true,
    }).returning();

    const [inv1] = await db.insert(invoices).values({
      userId,
      invoiceNumber: "INV-0001",
      clientId: client1.id,
      status: "paid",
      issueDate: new Date("2025-03-01"),
      dueDate: new Date("2025-03-31"),
      subtotal: "3500.00",
      taxAmount: "455.00",
      totalAmount: "3955.00",
      currency: "CAD",
      paidAt: new Date("2025-03-28"),
      notes: "Q1 consulting services",
    }).returning();

    await db.insert(invoiceItems).values({
      invoiceId: inv1.id,
      description: "Strategy consulting – March",
      quantity: "35",
      unitPrice: "100.00",
      totalPrice: "3500.00",
    });

    const [inv2] = await db.insert(invoices).values({
      userId,
      invoiceNumber: "INV-0002",
      clientId: client2.id,
      status: "sent",
      issueDate: new Date("2025-07-15"),
      dueDate: new Date("2025-07-30"),
      subtotal: "2000.00",
      taxAmount: "260.00",
      totalAmount: "2260.00",
      currency: "CAD",
      notes: "Brand identity package",
    }).returning();

    await db.insert(invoiceItems).values({
      invoiceId: inv2.id,
      description: "Brand identity design",
      quantity: "1",
      unitPrice: "2000.00",
      totalPrice: "2000.00",
    });

    const [inv3] = await db.insert(invoices).values({
      userId,
      invoiceNumber: "INV-0003",
      clientId: client1.id,
      status: "draft",
      issueDate: new Date("2025-08-01"),
      dueDate: new Date("2025-08-31"),
      subtotal: "4500.00",
      taxAmount: "585.00",
      totalAmount: "5085.00",
      currency: "CAD",
      notes: "August consulting – pending review",
    }).returning();

    await db.insert(invoiceItems).values({
      invoiceId: inv3.id,
      description: "Consulting – August",
      quantity: "45",
      unitPrice: "100.00",
      totalPrice: "4500.00",
    });

    const txBase = [
      { description: "Office rent – July", amount: "-1800.00", category: "RENT", date: new Date("2025-07-01") },
      { description: "Client payment – Maple Tech", amount: "3955.00", category: "REVENUE", date: new Date("2025-07-05") },
      { description: "Software subscriptions", amount: "-299.00", category: "SOFTWARE", date: new Date("2025-07-10") },
      { description: "Business insurance premium", amount: "-450.00", category: "INSURANCE", date: new Date("2025-07-15") },
      { description: "Office supplies", amount: "-87.50", category: "OFFICE_SUPPLIES", date: new Date("2025-07-18") },
      { description: "Client payment – Northern Creative", amount: "2260.00", category: "REVENUE", date: new Date("2025-08-02") },
      { description: "Internet & phone", amount: "-145.00", category: "UTILITIES", date: new Date("2025-08-05") },
      { description: "Meal – client entertainment", amount: "-123.45", category: "MEALS_ENTERTAINMENT", date: new Date("2025-08-12") },
    ];

    await db.insert(transactions).values(
      txBase.map(tx => ({
        userId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        aiCategory: tx.category,
        vendor: tx.description.split("–")[0].trim(),
        needsReview: false,
        isExpense: parseFloat(tx.amount) < 0,
        isReviewed: true,
        userOverride: false,
        receiptAttached: false,
      }))
    );

    console.log("[seed] Demo account created: demo@bookkeepai.com / demo123");
  } catch (err) {
    console.error("[seed] Error seeding demo data:", err);
  }
}
