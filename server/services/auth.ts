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
  
  if (user.subscriptionStatus === "trial" && user.trialEndsAt) {
    return new Date() < new Date(user.trialEndsAt);
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
