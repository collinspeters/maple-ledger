import { User } from "@shared/schema";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  subscriptionStatus: string;
  trialDaysRemaining?: number;
}

export function checkSubscriptionAccess(user: AuthUser | null): boolean {
  if (!user) return false;
  
  if (user.subscriptionStatus === "active") {
    return true;
  }
  
  // Demo accounts have extended access
  if (user.email === "demo@bookkeepai.com") {
    return true;
  }
  
  if (user.subscriptionStatus === "trial" && user.trialDaysRemaining && user.trialDaysRemaining > 0) {
    return true;
  }
  
  return false;
}
