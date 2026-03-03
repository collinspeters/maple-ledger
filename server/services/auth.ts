import bcrypt from "bcrypt";
import { User } from "@shared/schema";

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function checkSubscriptionAccess(user: User): boolean {
  if (user.subscriptionStatus === "active") {
    return true;
  }
  
  // Demo accounts have extended access
  if (user.email === "demo@bookkeepai.com") {
    return true;
  }
  
  // Trial users get access only while trial is active
  if (user.subscriptionStatus === "trial") {
    if (!user.trialEndsAt) return false;
    return new Date(user.trialEndsAt).getTime() > Date.now();
  }
  
  return false;
}

export function getTrialDaysRemaining(user: User): number {
  if (user.subscriptionStatus !== "trial" || !user.trialEndsAt) {
    return 0;
  }
  
  const now = new Date();
  const trialEnd = new Date(user.trialEndsAt);
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}
