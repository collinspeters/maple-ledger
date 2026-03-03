import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function useTokenFromQuery(): string {
  return useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get("token") || "";
  }, []);
}

export default function VerifyEmailPage() {
  const token = useTokenFromQuery();
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }
    setState("loading");
    apiRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((data) => {
        setState("ok");
        setMessage(data?.message || "Email verified.");
      })
      .catch((err) => {
        setState("error");
        setMessage(err?.message || "Verification failed.");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-card-lg border-0 rounded-xl">
        <CardHeader>
          <CardTitle>Verify Email</CardTitle>
          <CardDescription>Email verification status</CardDescription>
        </CardHeader>
        <CardContent>
          {state === "loading" && <p>Verifying...</p>}
          {state === "ok" && <p className="text-green-700">{message}</p>}
          {state === "error" && <p className="text-error">{message}</p>}
        </CardContent>
        <CardFooter>
          <Link href="/login" className="w-full">
            <Button className="w-full">Go to login</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
