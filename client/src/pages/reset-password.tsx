import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function useTokenFromQuery(): string {
  return useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("token") || "";
  }, []);
}

export default function ResetPasswordPage() {
  const { toast } = useToast();
  const queryToken = useTokenFromQuery();
  const [token, setToken] = useState(queryToken);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      }),
    onSuccess: () => {
      setDone(true);
      toast({ title: "Password reset", description: "You can now sign in." });
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Could not reset password",
        variant: "destructive",
      });
    },
  });

  const canSubmit = Boolean(token && password.length >= 8 && password === confirm);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-card-lg border-0 rounded-xl">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your reset token and a new password.</CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) resetMutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              {confirm && confirm !== password && (
                <p className="text-sm text-error">Passwords do not match.</p>
              )}
            </div>
            {done && (
              <p className="text-sm text-green-700">Password updated successfully.</p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button className="w-full" disabled={resetMutation.isPending || !canSubmit}>
              {resetMutation.isPending ? "Resetting..." : "Reset password"}
            </Button>
            <Link href="/login" className="text-sm text-primary hover:text-primary-dark">
              Back to login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
