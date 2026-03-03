import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type ReconAccount = {
  bank_account_id: string;
  name: string;
};

type ReconResponse = {
  statement: any | null;
  book_ending_balance: number;
  difference: number;
  uncleared_transactions: Array<{ id: string; date: string; description: string; amount: string }>;
};

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
}

export default function ReconciliationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [endingBalance, setEndingBalance] = useState("");
  const [statementEndDate, setStatementEndDate] = useState("");

  const { data: accountsData } = useQuery<{ accounts: ReconAccount[] }>({
    queryKey: ["/api/reconciliation/accounts"],
  });
  const accounts = useMemo(() => accountsData?.accounts || [], [accountsData]);

  const activeQueryKey = selectedAccount
    ? [`/api/reconciliation/${selectedAccount}/${selectedMonth}`]
    : ["/api/reconciliation/empty"];

  const { data: reconData, isLoading } = useQuery<ReconResponse>({
    queryKey: activeQueryKey,
    enabled: Boolean(selectedAccount),
  });

  useEffect(() => {
    if (!reconData?.statement) return;
    if (!statementEndDate && reconData.statement.statementEndDate) {
      setStatementEndDate(new Date(reconData.statement.statementEndDate).toISOString().split("T")[0]);
    }
    if (!endingBalance && reconData.statement.endingBalance) {
      setEndingBalance(String(reconData.statement.endingBalance));
    }
  }, [reconData, statementEndDate, endingBalance]);

  const saveStatement = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/reconciliation/${selectedAccount}/${selectedMonth}`, {
        method: "PUT",
        body: JSON.stringify({
          statement_end_date: statementEndDate,
          ending_balance: Number(endingBalance),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
      toast({ title: "Statement saved", description: "Reconciliation statement updated." });
    },
    onError: (error: any) => {
      toast({ title: "Save failed", description: error.message || "Could not save statement", variant: "destructive" });
    },
  });

  const autoClear = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/reconciliation/${selectedAccount}/${selectedMonth}/auto-clear`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
      toast({ title: "Auto-clear complete", description: `Cleared ${data.cleared_count ?? 0} transactions.` });
    },
    onError: (error: any) => {
      toast({ title: "Auto-clear failed", description: error.message || "Could not auto-clear", variant: "destructive" });
    },
  });

  const toggleClear = useMutation({
    mutationFn: async ({ transactionId, cleared }: { transactionId: string; cleared: boolean }) =>
      apiRequest(`/api/reconciliation/${selectedAccount}/${selectedMonth}/clear`, {
        method: "POST",
        body: JSON.stringify({ transaction_id: transactionId, cleared }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Reconciliation</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Statement setup</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="account">Bank account</Label>
            <select
              id="account"
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.bank_account_id} value={a.bank_account_id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="month">Statement month</Label>
            <Input id="month" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="endDate">End date</Label>
            <Input id="endDate" type="date" value={statementEndDate} onChange={(e) => setStatementEndDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="endingBalance">Ending balance</Label>
            <Input id="endingBalance" type="number" step="0.01" value={endingBalance} onChange={(e) => setEndingBalance(e.target.value)} />
          </div>
          <div className="md:col-span-3 flex items-end gap-2">
            <Button
              className="bg-primary hover:bg-primary-dark"
              onClick={() => saveStatement.mutate()}
              disabled={!selectedAccount || !statementEndDate || !endingBalance || saveStatement.isPending}
            >
              Save statement
            </Button>
            <Button variant="outline" onClick={() => autoClear.mutate()} disabled={!selectedAccount || autoClear.isPending}>
              Auto-clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Reconciliation detail</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-600">Loading...</p>
          ) : !selectedAccount ? (
            <p className="text-sm text-gray-600">Select an account to begin.</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-600">Book ending balance</p>
                  <p className="text-lg font-semibold">${(reconData?.book_ending_balance ?? 0).toFixed(2)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-600">Statement difference</p>
                  <p className={`text-lg font-semibold ${Math.abs(reconData?.difference ?? 0) < 0.005 ? "text-green-700" : "text-red-700"}`}>
                    ${(reconData?.difference ?? 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {Math.abs(reconData?.difference ?? 0) < 0.005 ? "Balanced" : "Not balanced"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-600">Uncleared transactions</p>
                  <p className="text-lg font-semibold">{reconData?.uncleared_transactions?.length ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                {Math.abs(reconData?.difference ?? 0) >= 0.005 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Reconciliation is not balanced. Review uncleared transactions or update statement ending balance.
                  </div>
                )}
                {(reconData?.uncleared_transactions || []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-900">{t.description}</p>
                      <p className="text-xs text-gray-600">{new Date(t.date).toLocaleDateString()} • ${Number(t.amount).toFixed(2)}</p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => toggleClear.mutate({ transactionId: t.id, cleared: true })}
                      disabled={toggleClear.isPending}
                    >
                      Mark cleared
                    </Button>
                  </div>
                ))}
                {(reconData?.uncleared_transactions || []).length === 0 && (
                  <p className="text-sm text-gray-600">No uncleared transactions.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
