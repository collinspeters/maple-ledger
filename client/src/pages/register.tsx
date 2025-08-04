import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brain } from "lucide-react";

export default function Register() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
    businessName: "",
    firstName: "",
    lastName: "",
  });
  const { register, isRegisterLoading } = useAuth();

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return;
    }
    
    if (formData.email && formData.password && formData.username) {
      const { confirmPassword, ...userData } = formData;
      register(userData);
    }
  };

  const isValid = formData.email && 
                  formData.password && 
                  formData.confirmPassword && 
                  formData.username &&
                  formData.password === formData.confirmPassword;

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
          <CardTitle>Start Your Free Trial</CardTitle>
          <CardDescription>
            Get 14 days free to experience AI-powered bookkeeping
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={handleChange("firstName")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={handleChange("lastName")}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={handleChange("email")}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="username"
                value={formData.username}
                onChange={handleChange("username")}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name (Optional)</Label>
              <Input
                id="businessName"
                placeholder="Your Business Name"
                value={formData.businessName}
                onChange={handleChange("businessName")}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a password"
                value={formData.password}
                onChange={handleChange("password")}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange("confirmPassword")}
                required
              />
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-sm text-error">Passwords do not match</p>
              )}
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-md"
              disabled={isRegisterLoading || !isValid}
              style={{ visibility: 'visible', display: 'block' }}
            >
              {isRegisterLoading ? "Creating Account..." : "Start Free Trial"}
            </Button>
            
            <p className="text-xs text-center text-gray-500">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
            
            <p className="text-sm text-center text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:text-primary-dark font-medium">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
