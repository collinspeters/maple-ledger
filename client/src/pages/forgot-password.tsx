import { useState } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onSuccess: (data) => {
      setSubmitted(true);
      if (data?.resetToken) {
        toast({
          title: "Reset token generated",
          description: `Dev token: ${data.resetToken}`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Request failed",
        description: error.message || "Could not request password reset",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-card-lg border-0 rounded-xl">
        <CardHeader>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email and we will generate a reset token.
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) requestMutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {submitted && (
              <p className="text-sm text-gray-700">
                If this email exists, a reset token is available.
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button className="w-full" disabled={requestMutation.isPending}>
              {requestMutation.isPending ? "Submitting..." : "Send reset request"}
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
