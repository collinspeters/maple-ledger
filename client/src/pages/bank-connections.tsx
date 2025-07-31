import { useState, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trash2, Plus, RefreshCw, Building2, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BankConnection {
  id: string;
  bankName: string;
  accountName: string;
  accountType: string;
  accountMask: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
}

export default function BankConnections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch bank connections
  const { data: connections = [], isLoading } = useQuery<BankConnection[]>({
    queryKey: ["/api/bank-connections"],
  });

  // Fetch link token for Plaid Link
  const { data: linkTokenData } = useQuery({
    queryKey: ["/api/plaid/create-link-token"],
    enabled: false, // Only fetch when needed
  });

  // Delete bank connection mutation
  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      fetch(`/api/bank-connections/${connectionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-connections"] });
      toast({
        title: "Bank Connection Removed",
        description: "Your bank account has been disconnected successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove bank connection. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Sync transactions mutation
  const syncMutation = useMutation({
    mutationFn: () => fetch("/api/plaid/sync-transactions", { method: "POST" }),
    onSuccess: async (response) => {
      const data = await response.json() as { syncedCount: number };
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-connections"] });
      toast({
        title: "Transactions Synced",
        description: `Successfully imported ${data.syncedCount} new transactions.`,
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed",
        description: "Failed to sync transactions. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Handle successful Plaid Link connection
  const onSuccess = async (public_token: string) => {
    try {
      setIsConnecting(true);
      const response = await fetch("/api/plaid/exchange-public-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token })
      }).then(res => res.json()) as { connections: number };

      queryClient.invalidateQueries({ queryKey: ["/api/bank-connections"] });
      
      toast({
        title: "Bank Connected!",
        description: `Successfully connected ${response.connections} bank account(s).`,
      });
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect your bank account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // State for Plaid link token
  const [currentLinkToken, setCurrentLinkToken] = useState<string | null>(null);

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: currentLinkToken,
    onSuccess,
    onExit: (err) => {
      if (err) {
        console.error("Plaid Link Error:", err);
        toast({
          title: "Connection Cancelled", 
          description: "Bank connection was cancelled.",
          variant: "destructive",
        });
      }
      setIsConnecting(false);
    },
  });

  // Debug effect to monitor ready state
  useEffect(() => {
    console.log("Plaid Link state:", { ready, hasToken: !!currentLinkToken, isConnecting });
  }, [ready, currentLinkToken, isConnecting]);

  // Start connection process
  const startConnection = async () => {
    try {
      setIsConnecting(true);
      console.log("Starting bank connection process...");
      
      const response = await fetch("/api/plaid/create-link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const tokenResponse = await response.json() as { link_token: string };
      console.log("Received link token:", tokenResponse.link_token?.substring(0, 20) + "...");
      
      // Set the token which will trigger usePlaidLink to update
      setCurrentLinkToken(tokenResponse.link_token);
      
      // Wait for the hook to initialize with the new token, then open
      setTimeout(() => {
        console.log("Opening Plaid Link... ready:", ready, "token:", !!tokenResponse.link_token);
        if (tokenResponse.link_token) {
          open();
        }
      }, 500);
    } catch (error) {
      console.error("Failed to start connection:", error);
      setIsConnecting(false);
      toast({
        title: "Error",
        description: `Failed to initialize bank connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const formatLastSync = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return "Never";
    return new Date(lastSyncAt).toLocaleDateString();
  };

  const getAccountTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "checking":
      case "savings":
        return <Building2 className="h-4 w-4" />;
      case "credit":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Building2 className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bank Connections</h1>
          <p className="text-gray-600 mt-2">
            Connect your Canadian bank accounts for automatic transaction import
          </p>
        </div>
        <div className="flex space-x-3">
          {connections.length > 0 && (
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              variant="outline"
              className="shadow-sm border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? "Syncing..." : "Sync Transactions"}
            </Button>
          )}
          <Button
            onClick={startConnection}
            disabled={isConnecting}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isConnecting ? "Connecting..." : "Connect Bank Account"}
          </Button>
        </div>
      </div>

      {connections.length === 0 ? (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
          <CardContent className="pt-8">
            <div className="text-center py-12">
              <div className="bg-primary/10 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <Building2 className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">No Bank Accounts Connected</h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                Connect your Canadian bank accounts to automatically import transactions
                and keep your books up to date.
              </p>
              <Button 
                onClick={startConnection} 
                disabled={isConnecting}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5 px-8 py-3"
              >
                <Plus className="h-5 w-5 mr-2" />
                {isConnecting ? "Connecting..." : "Connect Your First Bank Account"}
              </Button>
              <div className="mt-6 text-sm text-gray-500">
                🔒 Bank-level security • Instant synchronization • Canadian banks supported
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {connections.map((connection: BankConnection) => (
            <Card key={connection.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-1 bg-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-gradient-to-r from-gray-50 to-white">
                <CardTitle className="text-lg font-semibold flex items-center text-gray-900">
                  <div className="bg-primary/10 p-2 rounded-full mr-3">
                    {getAccountTypeIcon(connection.accountType)}
                  </div>
                  <div>
                    <span>{connection.accountName}</span>
                    {connection.accountMask && (
                      <span className="ml-3 text-gray-500 font-normal">
                        ****{connection.accountMask}
                      </span>
                    )}
                  </div>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(connection.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Bank</p>
                    <p className="font-medium text-gray-900">{connection.bankName}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Account Type</p>
                    <p className="font-medium text-gray-900">
                      {connection.accountType.charAt(0).toUpperCase() + connection.accountType.slice(1)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Last Sync</p>
                    <p className="font-medium text-gray-900">{formatLastSync(connection.lastSyncAt)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">Status</p>
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full mr-2 ${
                        connection.isActive ? "bg-green-500" : "bg-red-500"
                      }`} />
                      <span className={`font-medium ${
                        connection.isActive ? "text-green-700" : "text-red-700"
                      }`}>
                        {connection.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            Supported Canadian Banks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              "Royal Bank of Canada (RBC)",
              "TD Canada Trust", 
              "Bank of Nova Scotia",
              "Bank of Montreal (BMO)",
              "CIBC",
              "National Bank of Canada",
              "Desjardins",
              "And many more..."
            ].map((bank, index) => (
              <div key={index} className="flex items-center space-x-2 p-2 bg-white rounded-lg shadow-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-gray-700">{bank}</span>
              </div>
            ))}
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600 flex items-center">
              <span className="text-lg mr-2">🔒</span>
              Your banking credentials are securely handled by Plaid and never stored on our servers.
              All connections use bank-level encryption and security protocols.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}