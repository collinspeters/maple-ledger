import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip } from "lucide-react";
import { format } from "date-fns";
import type { Transaction } from "./transaction-row";

type TxnKind = "expense" | "income" | "transfer" | "equity";
type EquityType = "owner_draw" | "owner_contribution";

interface TransactionDrawerProps {
  open: boolean;
  transaction: Transaction | null;
  categories: string[];
  accounts: Array<{ id: string; name: string; source?: "bank" | "chart" }>;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Transaction>) => Promise<void>;
}

export function TransactionDrawer({
  open,
  transaction,
  categories,
  accounts,
  onOpenChange,
  onSave,
}: TransactionDrawerProps) {
  const [draft, setDraft] = useState<Partial<Transaction>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!transaction) {
      setDraft({});
      return;
    }
    setDraft({
      description: transaction.description,
      vendor: transaction.vendor,
      category: transaction.category || transaction.aiCategory || "",
      amount: transaction.amount,
      notes: (transaction as any).notes || "",
      txnKind: transaction.txnKind || (transaction.isTransfer ? "transfer" : transaction.isExpense ? "expense" : "income"),
      equityType: transaction.equityType || null,
      bankConnectionId: transaction.bankConnectionId || "",
      chartAccountId: transaction.chartAccountId || "",
    });
  }, [transaction]);

  const defaultTxnKind = useMemo<TxnKind>(() => {
    const raw = draft.txnKind || transaction?.txnKind;
    if (raw === "expense" || raw === "income" || raw === "transfer" || raw === "equity") {
      return raw;
    }
    if (transaction?.isTransfer) return "transfer";
    return transaction?.isExpense ? "expense" : "income";
  }, [draft.txnKind, transaction]);

  if (!transaction) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates: Partial<Transaction> = {
        description: draft.description ?? transaction.description,
        vendor: draft.vendor ?? transaction.vendor,
        category: draft.category ?? transaction.category,
        amount: draft.amount ?? transaction.amount,
        txnKind: defaultTxnKind,
        equityType: defaultTxnKind === "equity" ? draft.equityType || null : null,
        bankConnectionId: draft.bankConnectionId ?? transaction.bankConnectionId,
        chartAccountId: draft.chartAccountId ?? transaction.chartAccountId,
        notes: (draft as any).notes ?? (transaction as any).notes,
      };
      await onSave(transaction.id, updates);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle>Transaction Details</SheetTitle>
          <SheetDescription>
            Review and update this transaction without leaving the ledger.
          </SheetDescription>
        </SheetHeader>

        <Separator />

        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="p-6 space-y-6">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Date</div>
                <div className="text-sm font-medium">{format(new Date(transaction.date), "MMM d, yyyy")}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Amount</div>
                <div className="text-sm font-medium">${Number(transaction.amount).toFixed(2)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Receipt</div>
                <div className="flex items-center gap-2">
                  {transaction.receiptAttached ? (
                    <>
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">Attached</Badge>
                    </>
                  ) : (
                    <Badge variant="outline">None</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="txn-description">Description</Label>
              <Input
                id="txn-description"
                value={draft.description || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="txn-vendor">Vendor</Label>
              <Input
                id="txn-vendor"
                value={draft.vendor || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, vendor: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Transaction Kind</Label>
                <Select
                  value={defaultTxnKind}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, txnKind: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {defaultTxnKind === "equity" && (
                <div className="space-y-2">
                  <Label>Equity Type</Label>
                  <Select
                    value={draft.equityType || undefined}
                    onValueChange={(value) => setDraft((prev) => ({ ...prev, equityType: value as EquityType }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner_draw">Owner Draw</SelectItem>
                      <SelectItem value="owner_contribution">Owner Contribution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={draft.category || "__empty__"}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value === "__empty__" ? "" : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">Uncategorized</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account</Label>
              <Select
                value={draft.bankConnectionId || draft.chartAccountId || "__none__"}
                onValueChange={(value) => {
                  if (value === "__none__") {
                    setDraft((prev) => ({ ...prev, bankConnectionId: "", chartAccountId: "" }));
                    return;
                  }
                  const selected = accounts.find((account) => account.id === value);
                  if (selected?.source === "chart") {
                    setDraft((prev) => ({ ...prev, chartAccountId: value, bankConnectionId: "" }));
                    return;
                  }
                  setDraft((prev) => ({ ...prev, bankConnectionId: value, chartAccountId: "" }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="txn-notes">Notes</Label>
              <Textarea
                id="txn-notes"
                rows={4}
                value={(draft as any).notes || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
