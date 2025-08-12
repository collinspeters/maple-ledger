import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("demo@bookkeepai.com");
  const [password, setPassword] = useState("password123");
  const { login, isLoginLoading } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      login({ email, password });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-card-lg border-0 rounded-xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">BookkeepAI</h1>
              <p className="text-sm text-gray-600">Smart Bookkeeping</p>
            </div>
          </div>
          <CardTitle>Welcome Back</CardTitle>
          <CardDescription>
            Sign in to your account to continue managing your business finances
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full btn-modern bg-primary hover:bg-primary-dark text-white shadow-md login-button"
              disabled={isLoginLoading}
              data-testid="login-button"
              id="login-button"
            >
              {isLoginLoading ? "Signing In..." : "Sign In"}
            </Button>
            
            <p className="text-sm text-center text-gray-600">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary hover:text-primary-dark font-medium">
                Start your free trial
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
