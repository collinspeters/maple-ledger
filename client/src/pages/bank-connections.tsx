import { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  CreditCard, 
  RefreshCw, 
  Trash2,
  Plus,
  CheckCircle,
  Clock
} from "lucide-react";

type BankConnection = {
  id: string;
  bankName: string;
  accountName: string;
  accountType: string;
  accountMask: string | null;
  lastSyncAt: string | null;
};

export default function BankConnections() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Fetch bank connections
  const { data: connections = [], isLoading } = useQuery<BankConnection[]>({
    queryKey: ["/api/bank-connections"],
  });

  // Delete bank connection mutation
  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) =>
      fetch(`/api/bank-connections/${connectionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-connections"] });
      toast({
        title: "Connection Removed",
        description: "Bank connection has been successfully removed.",
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
        credentials: "include",
        body: JSON.stringify({ public_token })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json() as { connections: number };
      queryClient.invalidateQueries({ queryKey: ["/api/bank-connections"] });
      
      toast({
        title: "Bank Connected!",
        description: `Successfully connected ${result.connections} bank account(s).`,
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

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: linkToken,
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
      
      // Set token and open immediately
      setLinkToken(tokenResponse.link_token);
      
      // Small delay to ensure hook updates, then open
      setTimeout(() => {
        console.log("Opening Plaid Link... ready:", ready);
        open();
      }, 100);
      
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
        <Card className="text-center py-12 shadow-lg border-gray-200 hover:shadow-xl transition-all duration-300">
          <CardContent>
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bank Connections</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Connect your Canadian bank accounts to automatically import and categorize transactions. 
              We support RBC, TD, Scotiabank, BMO, CIBC, and more.
            </p>
            <Button
              onClick={startConnection}
              disabled={isConnecting}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              {isConnecting ? "Connecting..." : "Connect Your First Bank"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection) => (
            <Card key={connection.id} className="shadow-sm border-gray-200 hover:shadow-md transition-all duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getAccountTypeIcon(connection.accountType)}
                    <div>
                      <CardTitle className="text-lg text-gray-900">
                        {connection.bankName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        {connection.accountName}
                        {connection.accountMask && ` ••••${connection.accountMask}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={connection.lastSyncAt ? "default" : "secondary"}
                      className={connection.lastSyncAt ? "bg-green-100 text-green-800" : ""}
                    >
                      {connection.lastSyncAt ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(connection.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Last sync: {formatLastSync(connection.lastSyncAt)}</span>
                  <span className="capitalize">{connection.accountType} Account</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}