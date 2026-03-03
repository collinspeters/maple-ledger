import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    legalName: "",
    province: "",
    address: "",
    fiscalYearStart: "",
    gstRegistered: false,
    gstNumber: "",
    gstFilingFrequency: "annual",
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      legalName: user.businessName || "",
      province: user.province || "",
      address: user.address || "",
      fiscalYearStart: user.fiscalYearStart
        ? new Date(user.fiscalYearStart).toISOString().slice(0, 10)
        : "",
      gstRegistered: Boolean(user.gstRegistered),
      gstNumber: user.gstNumber || "",
      gstFilingFrequency: user.gstFilingFrequency || "annual",
    });
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          businessName: form.legalName,
          fiscalYearStart: form.fiscalYearStart || null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Saved", description: "Profile and tax settings updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error.message || "Could not save settings",
        variant: "destructive",
      });
    },
  });

  const billingPortalMutation = useMutation({
    mutationFn: async () => apiRequest("/api/billing/portal", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Billing unavailable",
        description: error.message || "Could not open billing portal",
        variant: "destructive",
      });
    },
  });

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
                <Input id="firstName" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} disabled />
            </div>
            <div>
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="province">Province</Label>
                <Input id="province" value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
                <Input id="fiscalYearStart" type="date" value={form.fiscalYearStart} onChange={(e) => setForm((f) => ({ ...f, fiscalYearStart: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <Button
              className="bg-primary hover:bg-primary-dark"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Tax Settings</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-700">GST/HST Registered</span>
                <input
                  type="checkbox"
                  checked={form.gstRegistered}
                  onChange={(e) => setForm((f) => ({ ...f, gstRegistered: e.target.checked }))}
                />
              </div>
              <div>
                <Label htmlFor="gstNumber">GST Number</Label>
                <Input id="gstNumber" value={form.gstNumber} onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="gstFrequency">Filing frequency</Label>
                <select
                  id="gstFrequency"
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.gstFilingFrequency}
                  onChange={(e) => setForm((f) => ({ ...f, gstFilingFrequency: e.target.value }))}
                >
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <Button
                className="bg-primary hover:bg-primary-dark"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Saving..." : "Save Tax Settings"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Subscription</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-700">Current Plan</span>
              <span className="font-semibold capitalize">{user?.subscriptionStatus || "Unknown"}</span>
            </div>
            <Button
              className="bg-accent hover:bg-orange-600"
              onClick={() => billingPortalMutation.mutate()}
              disabled={billingPortalMutation.isPending}
            >
              {billingPortalMutation.isPending ? "Opening..." : "Manage Subscription"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
