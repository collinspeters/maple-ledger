import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { Building2, Plus, CheckCircle, ArrowRight } from "lucide-react";

interface BankConnection {
  id: string;
  bankName: string;
  accountName: string;
  accountType: string;
  accountMask: string | null;
  isActive: boolean;
}

export default function BankingConnectionCard() {
  const { data: connections = [], isLoading } = useQuery<BankConnection[]>({
    queryKey: ["/api/bank-connections"],
  });

  const hasConnections = connections.length > 0;

  if (isLoading) {
    return (
      <Card className="border-2 border-dashed border-gray-200">
      <ErrorBoundary>
        <CardContent className="p-6">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-gray-200 h-12 w-12"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>
        </CardContent>
      </ErrorBoundary>
    </Card>
    );
  }

  return (
    <Card className={`border-2 transition-all duration-200 hover:shadow-card-lg rounded-xl ${
      hasConnections 
        ? "border-green-200 bg-gradient-to-r from-green-50 to-emerald-50" 
        : "border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50 border-dashed"
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            hasConnections 
              ? "bg-green-100 text-green-600" 
              : "bg-orange-100 text-orange-600"
          }`}>
            <Building2 className="w-5 h-5" />
          </div>
          <span>
            {hasConnections 
              ? `Bank Connection${connections.length > 1 ? 's' : ''} Active` 
              : "Connect Your Bank Account"
            }
          </span>
          {hasConnections && (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
        </CardTitle>
        <CardDescription>
          {hasConnections 
            ? `${connections.length} bank account${connections.length > 1 ? 's' : ''} connected for automatic transaction sync`
            : "Automatically import transactions and streamline your bookkeeping"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {hasConnections ? (
          <div className="space-y-4">
            <div className="space-y-2">
              {connections.slice(0, 2).map((connection) => (
                <div 
                  key={connection.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{connection.bankName}</p>
                      <p className="text-sm text-gray-500">
                        {connection.accountType} •••{connection.accountMask}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-600 font-medium">Active</span>
                  </div>
                </div>
              ))}
              {connections.length > 2 && (
                <p className="text-sm text-gray-500 text-center">
                  +{connections.length - 2} more connection{connections.length > 3 ? 's' : ''}
                </p>
              )}
            </div>
            <div className="flex space-x-3">
              <Link href="/banking">
                <Button o> console.log('Button clicked')} aria-label="Small action button" variant="outline" size="sm" className="flex-1">
                  <Building2 className="w-4 h-4 mr-2" />
                  Manage Banks
                </Button>
              </Link>
              <Link href="/banking">
                <Button o> console.log('Button clicked')} aria-label="Small action button" size="sm" className="flex-1">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Bank
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Ready to Connect Your Bank?
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Securely link your Canadian bank account to automatically import transactions and save hours of manual entry.
              </p>
              <div className="space-y-2 text-xs text-gray-500">
                <p>✓ Bank-level security with Plaid</p>
                <p>✓ Automatic Canadian tax categorization</p>
                <p>✓ Real-time transaction sync</p>
              </div>
            </div>
            <Link href="/banking">
              <Button o> console.log('Button clicked')} aria-label="Button action" className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg">
                <Building2 className="w-4 h-4 mr-2" />
                Connect Bank Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}