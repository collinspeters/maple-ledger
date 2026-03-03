import { User } from "@shared/schema";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  province?: string;
  address?: string;
  fiscalYearStart?: string;
  gstRegistered?: boolean;
  gstNumber?: string;
  gstFilingFrequency?: string;
  emailVerifiedAt?: string;
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
  
  // Trial users get access only while trial is active
  if (user.subscriptionStatus === "trial") {
    return (user.trialDaysRemaining ?? 0) > 0;
  }
  
  return false;
}
