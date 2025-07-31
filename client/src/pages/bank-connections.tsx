import { useState } from "react";
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
      apiRequest("DELETE", `/api/bank-connections/${connectionId}`, {}),
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
    mutationFn: () => apiRequest("POST", "/api/plaid/sync-transactions", {}),
    onSuccess: (data: { syncedCount: number }) => {
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
      const response = await apiRequest("POST", "/api/plaid/exchange-public-token", {
        body: JSON.stringify({ public_token }),
      }) as { connections: number };

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

  // Initialize Plaid Link
  const { open, ready } = usePlaidLink({
    token: (linkTokenData as { link_token?: string })?.link_token || null,
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
      const tokenResponse = await apiRequest("POST", "/api/plaid/create-link-token", {}) as { link_token: string };
      
      // Re-enable the query to fetch the token
      queryClient.setQueryData(["/api/plaid/create-link-token"], tokenResponse);
      
      // Small delay to ensure token is set
      setTimeout(() => {
        if (ready) {
          open();
        }
      }, 100);
    } catch (error) {
      setIsConnecting(false);
      toast({
        title: "Error",
        description: "Failed to initialize bank connection. Please try again.",
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bank Connections</h1>
          <p className="text-muted-foreground">
            Connect your Canadian bank accounts for automatic transaction import
          </p>
        </div>
        <div className="flex space-x-2">
          {connections.length > 0 && (
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Transactions
            </Button>
          )}
          <Button
            onClick={startConnection}
            disabled={isConnecting || !ready}
          >
            <Plus className="h-4 w-4 mr-2" />
            {isConnecting ? "Connecting..." : "Connect Bank Account"}
          </Button>
        </div>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Bank Accounts Connected</h3>
              <p className="text-muted-foreground mb-4">
                Connect your Canadian bank accounts to automatically import transactions
                and keep your books up to date.
              </p>
              <Button onClick={startConnection} disabled={isConnecting}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Your First Bank Account
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {connections.map((connection: BankConnection) => (
            <Card key={connection.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  {getAccountTypeIcon(connection.accountType)}
                  <span className="ml-2">{connection.accountName}</span>
                  {connection.accountMask && (
                    <span className="ml-2 text-muted-foreground">
                      ****{connection.accountMask}
                    </span>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(connection.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Bank: {connection.bankName}</p>
                    <p className="text-muted-foreground">
                      Type: {connection.accountType.charAt(0).toUpperCase() + connection.accountType.slice(1)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">
                      Last Sync: {formatLastSync(connection.lastSyncAt)}
                    </p>
                    <div className="flex items-center mt-1">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        connection.isActive ? "bg-green-500" : "bg-red-500"
                      }`} />
                      <span className="text-xs">
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

      <Card>
        <CardHeader>
          <CardTitle>Supported Canadian Banks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>• Royal Bank of Canada (RBC)</div>
            <div>• TD Canada Trust</div>
            <div>• Bank of Nova Scotia</div>
            <div>• Bank of Montreal (BMO)</div>
            <div>• CIBC</div>
            <div>• National Bank of Canada</div>
            <div>• Desjardins</div>
            <div>• And many more...</div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Your banking credentials are securely handled by Plaid and never stored on our servers.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}