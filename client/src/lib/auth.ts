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
  
  // Trial users always get access — expiry is shown as a warning, not a hard block
  if (user.subscriptionStatus === "trial") {
    return true;
  }
  
  return false;
}
