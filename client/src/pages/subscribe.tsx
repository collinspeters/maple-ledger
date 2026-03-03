import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Check, CreditCard, Shield, Zap, TrendingUp } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const SubscribeForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    if (!stripe || !elements) {
      setIsProcessing(false);
      return;
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Payment Successful",
        description: "Welcome to BookkeepAI Pro! Your subscription is now active.",
      });
    }
    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <PaymentElement 
          options={{
            layout: "tabs"
          }}
        />
      </div>
      <Button 
        type="submit" 
        disabled={!stripe || !elements || isProcessing}
        className="w-full bg-primary hover:bg-primary-dark text-white py-3 text-lg font-semibold"
      >
        {isProcessing ? (
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Processing...</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Subscribe for $25/month</span>
          </div>
        )}
      </Button>
    </form>
  );
};

export default function Subscribe() {
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create subscription as soon as the page loads
    apiRequest("/api/create-subscription", { method: "POST" })
      .then((data) => {
        setClientSecret(data.clientSecret);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to create subscription:", error);
        setLoading(false);
      });
  }, []);

  const features = [
    {
      icon: Brain,
      title: "AI Transaction Categorization",
      description: "Automatically categorize expenses with 95%+ accuracy using GPT-4"
    },
    {
      icon: Zap,
      title: "Smart Receipt Processing",
      description: "Upload receipts and let AI extract data and match to transactions"
    },
    {
      icon: TrendingUp,
      title: "CRA-Ready Reports",
      description: "Generate compliant P&L, GST/HST, and tax reports instantly"
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Bank-level security with full audit trails for CRA compliance"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-alt">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-alt p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-error mb-4">
              <CreditCard className="h-12 w-12 mx-auto" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Setup Error</h2>
            <p className="text-gray-600 mb-4">
              We couldn't set up your payment. Please try again or contact support.
            </p>
            <Button 
              onClick={() => window.location.reload()}
              className="bg-primary hover:bg-primary-dark"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-alt">
      {/* Header */}
      <div className="bg-surface border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="text-white text-sm" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">BookkeepAI</h1>
            <p className="text-xs text-gray-500">Smart Bookkeeping</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Upgrade to BookkeepAI Pro
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Continue enjoying AI-powered bookkeeping with advanced features
          </p>
          
          {user?.subscriptionStatus === "trial" && user.trialDaysRemaining !== undefined && (
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg">
              <Badge variant="secondary" className="bg-accent text-white">
                Trial Ending
              </Badge>
              <span className="text-sm text-gray-700">
                {user.trialDaysRemaining > 0 
                  ? `${user.trialDaysRemaining} days remaining`
                  : "Trial expired"
                }
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Features */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-8">
              Everything you need for professional bookkeeping
            </h2>
            
            <div className="space-y-6">
              {features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional Benefits */}
            <div className="mt-8 p-6 bg-secondary/5 border border-secondary/20 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-4">What's included:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  "Unlimited transactions",
                  "AI chat assistant", 
                  "Receipt OCR processing",
                  "CRA-compliant reports",
                  "Bank account sync",
                  "Mobile app access",
                  "Priority support",
                  "Data export tools"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-secondary" />
                    <span className="text-sm text-gray-700">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Form */}
          <div className="lg:sticky lg:top-8">
            <Card className="shadow-card-hover">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">BookkeepAI Pro</CardTitle>
                <CardDescription className="text-lg">
                  Professional bookkeeping for Canadian businesses
                </CardDescription>
                <div className="py-4">
                  <div className="text-4xl font-bold text-gray-900">$25</div>
                  <div className="text-gray-600">per month • billed monthly</div>
                </div>
              </CardHeader>
              
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <SubscribeForm />
                </Elements>
              </CardContent>
              
              <CardFooter className="text-center">
                <div className="w-full space-y-3">
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                    <Shield className="h-4 w-4" />
                    <span>Secured by Stripe • Cancel anytime</span>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    By subscribing, you agree to our Terms of Service and Privacy Policy. 
                    Your subscription will automatically renew monthly until cancelled.
                  </p>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
