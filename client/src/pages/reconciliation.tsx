import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

type ReconAccount = {
  bank_account_id: string;
  name: string;
};

type ReconResponse = {
  statement: any | null;
  book_ending_balance: number;
  difference: number;
  uncleared_transactions: Array<{ id: string; date: string; description: string; amount: string }>;
  cleared_transactions?: Array<{ id: string; date: string; description: string; amount: string }>;
};

type PeriodCloseResponse = {
  status: "open" | "closed";
  closed_at?: string | null;
  closed_by?: string | null;
  reopen_reason?: string | null;
};

type CloseChecklist = {
  balanced: boolean;
  unresolved_critical_review_items: number;
  uncategorized_expense_transactions: number;
};

type CloseErrorPayload = {
  message?: string;
  difference?: number;
  checklist?: CloseChecklist;
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
  const [showReopenDialog, setShowReopenDialog] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [closeError, setCloseError] = useState<CloseErrorPayload | null>(null);

  const { data: accountsData, isLoading: accountsLoading, error: accountsError } = useQuery<{ accounts: ReconAccount[]; data?: { accounts: ReconAccount[] } }>({
    queryKey: ["/api/reconciliation/accounts"],
  });
  const accounts = useMemo(() => accountsData?.accounts || accountsData?.data?.accounts || [], [accountsData]);

  const activeQueryKey = selectedAccount
    ? [`/api/reconciliation/${selectedAccount}/${selectedMonth}`]
    : ["/api/reconciliation/empty"];

  const { data: reconDataRaw, isLoading, error: reconError } = useQuery<ReconResponse | { data: ReconResponse }>({
    queryKey: activeQueryKey,
    enabled: Boolean(selectedAccount),
  });
  const reconData: ReconResponse | undefined = (reconDataRaw as any)?.data || (reconDataRaw as any);
  const { data: periodCloseRaw } = useQuery<PeriodCloseResponse | { data: PeriodCloseResponse }>({
    queryKey: selectedAccount ? [`/api/period-close/${selectedAccount}/${selectedMonth}`] : ["/api/period-close/empty"],
    enabled: Boolean(selectedAccount),
  });
  const periodClose: PeriodCloseResponse = ((periodCloseRaw as any)?.data || (periodCloseRaw as any) || { status: "open" }) as PeriodCloseResponse;
  const isPeriodClosed = periodClose?.status === "closed";

  useEffect(() => {
    if (!reconData?.statement) return;
    if (!statementEndDate && reconData.statement.statementEndDate) {
      setStatementEndDate(new Date(reconData.statement.statementEndDate).toISOString().split("T")[0]);
    }
    if (!endingBalance && reconData.statement.endingBalance !== undefined && reconData.statement.endingBalance !== null) {
      setEndingBalance(String(reconData.statement.endingBalance));
    }
  }, [reconData, statementEndDate, endingBalance]);

  useEffect(() => {
    setEndingBalance("");
    setStatementEndDate("");
  }, [selectedAccount, selectedMonth]);

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
      setCloseError(null);
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
      toast({ title: "Statement saved", description: "Reconciliation statement updated." });
    },
    onError: (error: any) => {
      toast({
        title: "Save failed",
        description: error?.message || "Could not save statement",
        variant: "destructive",
      });
    },
  });

  const autoClear = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/reconciliation/${selectedAccount}/${selectedMonth}/auto-clear`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: (data) => {
      setCloseError(null);
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
      toast({ title: "Auto-clear complete", description: `Cleared ${data.cleared_count ?? 0} transactions.` });
    },
    onError: (error: any) => {
      toast({
        title: "Auto-clear failed",
        description: error?.message || "Could not auto-clear",
        variant: "destructive",
      });
    },
  });

  const toggleClear = useMutation({
    mutationFn: async ({ transactionId, cleared }: { transactionId: string; cleared: boolean }) =>
      apiRequest(`/api/reconciliation/${selectedAccount}/${selectedMonth}/clear`, {
        method: "POST",
        body: JSON.stringify({ transaction_id: transactionId, cleared }),
      }),
    onSuccess: () => {
      setCloseError(null);
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error?.message || "Could not update clear status", variant: "destructive" });
    },
  });

  const handleFinish = () => {
    finishReconciliation.mutate();
  };

  const finishReconciliation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/reconciliation/${selectedAccount}/${selectedMonth}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw payload;
      }
      return payload;
    },
    onSuccess: () => {
      setCloseError(null);
      queryClient.invalidateQueries({ queryKey: activeQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
      queryClient.invalidateQueries({ queryKey: [`/api/period-close/${selectedAccount}/${selectedMonth}`] });
      toast({
        title: "Reconciliation complete",
        description: "Close checklist passed for this statement period.",
      });
    },
    onError: (error: any) => {
      setCloseError({
        message: error?.message,
        difference: error?.difference,
        checklist: error?.checklist,
      });
      toast({
        title: "Cannot finish yet",
        description: error?.message || "Resolve remaining checklist items first.",
        variant: "destructive",
      });
    },
  });

  const closePeriod = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/period-close/${selectedAccount}/${selectedMonth}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw payload;
      }
      return payload;
    },
    onSuccess: () => {
      setCloseError(null);
      queryClient.invalidateQueries({ queryKey: [`/api/period-close/${selectedAccount}/${selectedMonth}`] });
      toast({ title: "Period closed", description: "Writes are now locked for this month/account." });
    },
    onError: (error: any) => {
      setCloseError({
        message: error?.message,
        difference: error?.difference,
        checklist: error?.checklist,
      });
      toast({ title: "Close failed", description: error?.message || "Could not close period", variant: "destructive" });
    },
  });

  const reopenPeriod = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/period-close/${selectedAccount}/${selectedMonth}/reopen`, {
        method: "POST",
        body: JSON.stringify({ reason: reopenReason.trim() }),
      }),
    onSuccess: () => {
      setShowReopenDialog(false);
      setReopenReason("");
      setCloseError(null);
      queryClient.invalidateQueries({ queryKey: [`/api/period-close/${selectedAccount}/${selectedMonth}`] });
      toast({ title: "Period reopened", description: "You can edit this period again." });
    },
    onError: (error: any) => {
      toast({ title: "Reopen failed", description: error?.message || "Could not reopen period", variant: "destructive" });
    },
  });

  const difference = reconData?.difference ?? 0;
  const isBalanced = Math.abs(difference) < 0.005;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Reconciliation</h1>

      {accountsError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load bank accounts for reconciliation.
        </div>
      )}

      {reconError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load reconciliation data for this account/month.
        </div>
      )}

      {isPeriodClosed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This period is closed. Reopen it to edit statement values or clear flags.
        </div>
      )}

      {closeError?.checklist && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
          <p className="font-medium">{closeError.message || "Cannot close this period yet."}</p>
          {!closeError.checklist.balanced && (
            <p>- Reconciliation difference must be zero (current: ${(closeError.difference ?? difference).toFixed(2)}).</p>
          )}
          {closeError.checklist.unresolved_critical_review_items > 0 && (
            <p>- Resolve {closeError.checklist.unresolved_critical_review_items} critical review item(s) in `/review`.</p>
          )}
          {closeError.checklist.uncategorized_expense_transactions > 0 && (
            <p>- Categorize {closeError.checklist.uncategorized_expense_transactions} expense transaction(s) for this period.</p>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900">Statement setup</h2>
            <span className={`text-xs px-2 py-1 rounded-full border ${isPeriodClosed ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-green-100 text-green-800 border-green-200"}`}>
              Period {isPeriodClosed ? "Closed" : "Open"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label htmlFor="account">Bank account</Label>
            <select
              id="account"
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              disabled={accountsLoading || accounts.length === 0}
            >
              <option value="">
                {accountsLoading ? "Loading accounts..." : accounts.length === 0 ? "No bank accounts found" : "Select account"}
              </option>
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
              disabled={!selectedAccount || !statementEndDate || !endingBalance || saveStatement.isPending || isPeriodClosed}
            >
              Save statement
            </Button>
            <Button variant="outline" onClick={() => autoClear.mutate()} disabled={!selectedAccount || autoClear.isPending || isPeriodClosed}>
              Auto-clear
            </Button>
            <Button
              variant="ghost"
              onClick={() => queryClient.invalidateQueries({ queryKey: activeQueryKey })}
              disabled={!selectedAccount}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => closePeriod.mutate()}
              disabled={!selectedAccount || closePeriod.isPending || isPeriodClosed}
            >
              Close period
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReopenDialog(true)}
              disabled={!selectedAccount || reopenPeriod.isPending || !isPeriodClosed}
            >
              Reopen period
            </Button>
          </div>
        </CardContent>
      </Card>

      {accounts.length === 0 && !accountsLoading && (
        <Card>
          <CardContent className="py-8 text-sm text-gray-600">
            Connect a bank account first to run reconciliation.
          </CardContent>
        </Card>
      )}

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
                  <p className={`text-lg font-semibold ${isBalanced ? "text-green-700" : "text-red-700"}`}>
                    ${difference.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isBalanced ? "Balanced" : "Not balanced"}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-600">Uncleared transactions</p>
                  <p className="text-lg font-semibold">{reconData?.uncleared_transactions?.length ?? 0}</p>
                </div>
              </div>

              <div className="space-y-2">
                {isBalanced ? (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Reconciliation is balanced.
                    </div>
                    <Button size="sm" onClick={handleFinish} disabled={finishReconciliation.isPending || isPeriodClosed}>
                      Finish reconciliation
                    </Button>
                  </div>
                ) : (
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
                      disabled={toggleClear.isPending || isPeriodClosed}
                    >
                      Mark cleared
                    </Button>
                  </div>
                ))}
                {(reconData?.uncleared_transactions || []).length === 0 && (
                  <p className="text-sm text-gray-600">No uncleared transactions.</p>
                )}

                {(reconData?.cleared_transactions || []).length > 0 && (
                  <div className="pt-3 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">Cleared transactions</p>
                    <div className="space-y-2">
                      {(reconData?.cleared_transactions || []).map((t) => (
                        <div key={`cleared-${t.id}`} className="flex items-center justify-between border rounded-lg px-3 py-2 bg-green-50/40">
                          <div>
                            <p className="font-medium text-gray-900">{t.description}</p>
                            <p className="text-xs text-gray-600">{new Date(t.date).toLocaleDateString()} • ${Number(t.amount).toFixed(2)}</p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => toggleClear.mutate({ transactionId: t.id, cleared: false })}
                            disabled={toggleClear.isPending || isPeriodClosed}
                          >
                            Mark uncleared
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReopenDialog} onOpenChange={setShowReopenDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reopen period</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reopen-reason">Reason (required)</Label>
            <Textarea
              id="reopen-reason"
              placeholder="Why are you reopening this closed period?"
              value={reopenReason}
              maxLength={500}
              onChange={(e) => setReopenReason(e.target.value)}
            />
            <p className="text-xs text-gray-500 text-right">{reopenReason.length}/500</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowReopenDialog(false)}>Cancel</Button>
              <Button
                onClick={() => reopenPeriod.mutate()}
                disabled={!reopenReason.trim() || reopenPeriod.isPending}
              >
                Reopen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
