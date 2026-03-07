import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function OnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    legalName: user?.businessName || "",
    province: user?.province || "",
    fiscalYearStart: user?.fiscalYearStart ? new Date(user.fiscalYearStart).toISOString().slice(0, 10) : "",
    gstRegistered: Boolean(user?.gstRegistered),
    gstNumber: user?.gstNumber || "",
    gstFilingFrequency: user?.gstFilingFrequency || "annual",
  });

  const { data: bankConnectionsResponse = [] } = useQuery<any>({
    queryKey: ["/api/bank-connections"],
  });
  const bankConnections: any[] = useMemo(() => {
    if (Array.isArray(bankConnectionsResponse)) return bankConnectionsResponse;
    if (Array.isArray(bankConnectionsResponse?.data?.connections)) return bankConnectionsResponse.data.connections;
    if (Array.isArray(bankConnectionsResponse?.connections)) return bankConnectionsResponse.connections;
    if (Array.isArray(bankConnectionsResponse?.data)) return bankConnectionsResponse.data;
    return [];
  }, [bankConnectionsResponse]);

  const saveProfileMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          legalName: form.legalName,
          province: form.province,
          fiscalYearStart: form.fiscalYearStart || null,
          gstRegistered: form.gstRegistered,
          gstNumber: form.gstNumber,
          gstFilingFrequency: form.gstFilingFrequency,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Saved", description: "Onboarding step saved." });
      setStep((s) => Math.min(3, s + 1));
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.message || "Could not save onboarding details.",
        variant: "destructive",
      });
    },
  });

  const finish = () => {
    toast({ title: "Onboarding complete", description: "Taking you to dashboard." });
    navigate("/dashboard");
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Set up your account</h1>
      <p className="text-sm text-gray-600">Step {step} of 3</p>

      {step === 1 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Business basics</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="legalName">Legal/business name</Label>
              <Input
                id="legalName"
                value={form.legalName}
                onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="province">Province</Label>
              <Input
                id="province"
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="fiscalYearStart">Fiscal year start</Label>
              <Input
                id="fiscalYearStart"
                type="date"
                value={form.fiscalYearStart}
                onChange={(e) => setForm((f) => ({ ...f, fiscalYearStart: e.target.value }))}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => saveProfileMutation.mutate()}
                disabled={!form.legalName || !form.province || !form.fiscalYearStart || saveProfileMutation.isPending}
              >
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">GST/HST settings</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="gstRegistered">GST/HST registered</Label>
              <input
                id="gstRegistered"
                type="checkbox"
                checked={form.gstRegistered}
                onChange={(e) => setForm((f) => ({ ...f, gstRegistered: e.target.checked }))}
              />
            </div>
            {form.gstRegistered && (
              <>
                <div>
                  <Label htmlFor="gstNumber">GST/HST number</Label>
                  <Input
                    id="gstNumber"
                    value={form.gstNumber}
                    onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
                  />
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
              </>
            )}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => saveProfileMutation.mutate()} disabled={saveProfileMutation.isPending}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Connect your bank</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Connect a business account to start importing transactions automatically.
            </p>
            <p className="text-sm">
              Connected accounts: <strong>{bankConnections.length}</strong>
            </p>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/banking")}>Connect bank</Button>
                <Button onClick={finish} disabled={bankConnections.length === 0}>
                  Go to dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
