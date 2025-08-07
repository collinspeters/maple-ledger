import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>

      <div className="grid gap-6 max-w-2xl">
        <Card className="shadow-card">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" defaultValue={user?.firstName || ""} />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" defaultValue={user?.lastName || ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user?.email || ""} />
            </div>
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" defaultValue={user?.businessName || ""} />
            </div>
            <Button o onClick={() => console.log('Button clicked')}nClick={() => console.log('Button clicked')} aria-label="Button action" className="bg-primary hover:bg-primary-dark">
              Save Changes
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700">Current Plan</span>
                <span className="font-semibold capitalize">
                  {user?.subscriptionStatus || "Unknown"}
                </span>
              </div>
              {user?.subscriptionStatus === "trial" && (
                <div className="flex justify-between">
                  <span className="text-gray-700">Trial Days Remaining</span>
                  <span className="font-semibold text-accent">
                    {user.trialDaysRemaining || 0} days
                  </span>
                </div>
              )}
              <Button o onClick={() => console.log('Button clicked')}nClick={() => console.log('Button clicked')} aria-label="Button action" className="bg-accent hover:bg-orange-600">
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
