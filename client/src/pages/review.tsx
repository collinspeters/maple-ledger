import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, MessageSquare } from "lucide-react";

type ReviewItem = {
  id: string;
  kind: "txn_kind" | "category" | "receipt_match" | "reconciliation";
  entityType: "transaction" | "receipt" | "bank_statement";
  entityId: string;
  prompt: string;
  optionsJson?: Array<{ label: string; value: string }> | null;
  createdAt: string;
};

type ReviewMessage = {
  id: string;
  role: "system" | "user";
  content: string;
  createdAt: string;
};

type ResolveResponse = {
  ok: boolean;
  item?: ReviewItem;
  data?: { item?: ReviewItem };
  requires_follow_up?: boolean;
  follow_up_message?: string | null;
};

export default function ReviewPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lastAction, setLastAction] = useState<{ id: string; action: "resolved" | "skipped" } | null>(null);

  const { data, isLoading, error } = useQuery<{ items: ReviewItem[]; data?: { items: ReviewItem[] } }>({
    queryKey: ["/api/review/items"],
  });
  const items = data?.items || data?.data?.items || [];

  useEffect(() => {
    if (!items.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !items.some((i) => i.id === selectedId)) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || items[0] || null,
    [items, selectedId]
  );

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ messages: ReviewMessage[]; data?: { messages: ReviewMessage[] } }>({
    queryKey: selected ? [`/api/review/items/${selected.id}/messages`] : ["/api/review/items/messages/empty"],
    enabled: Boolean(selected),
  });
  const messages = messagesData?.messages || messagesData?.data?.messages || [];
  const selectedIndex = selected ? items.findIndex((item) => item.id === selected.id) : -1;

  const getNextItemId = (currentId: string): string | null => {
    const idx = items.findIndex((i) => i.id === currentId);
    if (idx === -1) return items[0]?.id || null;
    return items[idx + 1]?.id || items[idx - 1]?.id || null;
  };

  const resolveMutation = useMutation({
    mutationFn: async ({ id, selectedOption }: { id: string; selectedOption?: string }) =>
      apiRequest(`/api/review/items/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify(selectedOption ? { selectedOption } : {}),
      }),
    onSuccess: (payload: ResolveResponse) => {
      if (payload?.requires_follow_up) {
        toast({
          title: "Action needed",
          description: payload.follow_up_message || "Finish the related step, then resolve this item.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
        if (selected) {
          queryClient.invalidateQueries({ queryKey: [`/api/review/items/${selected.id}/messages`] });
        }
        return;
      }
      if (selected) {
        setLastAction({ id: selected.id, action: "resolved" });
        setSelectedId(getNextItemId(selected.id));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
      toast({ title: "Resolved", description: "Item resolved and moved to the next one." });
    },
    onError: (error: any) => {
      toast({ title: "Resolve failed", description: error?.message || "Please try again.", variant: "destructive" });
    }
  });

  const skipMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/review/items/${id}/skip`, { method: "POST" }),
    onSuccess: () => {
      if (selected) {
        setLastAction({ id: selected.id, action: "skipped" });
        setSelectedId(getNextItemId(selected.id));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
      toast({ title: "Skipped", description: "Item skipped and moved to the next one." });
    },
    onError: (error: any) => {
      toast({ title: "Skip failed", description: error?.message || "Please try again.", variant: "destructive" });
    }
  });

  const undoMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/review/items/${id}/reopen`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/review/items"] });
      if (lastAction?.id) setSelectedId(lastAction.id);
      setLastAction(null);
      toast({ title: "Undone", description: "Review item moved back to open." });
    },
    onError: (error: any) => {
      toast({
        title: "Undo failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) =>
      apiRequest(`/api/review/items/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ role: "user", content }),
      }),
    onSuccess: () => {
      if (!selected) return;
      setMessage("");
      queryClient.invalidateQueries({ queryKey: [`/api/review/items/${selected.id}/messages`] });
    },
    onError: (error: any) => {
      toast({
        title: "Could not send message",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Review</h1>
        <p className="text-sm text-gray-600">Resolve ambiguous items quickly and keep books finalized.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load review items. Refresh and try again.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Queue</span>
              <Badge variant="secondary">{items.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
            {isLoading && <p className="text-sm text-gray-500">Loading queue...</p>}
            {!isLoading && items.length === 0 && (
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                All caught up. No open review items.
              </div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                className={`w-full text-left border rounded-md p-3 transition ${
                  selected?.id === item.id ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                }`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="outline">
                    {item.kind === "txn_kind"
                      ? "Kind"
                      : item.kind === "receipt_match"
                        ? "Receipt Match"
                        : item.kind === "reconciliation"
                          ? "Reconciliation"
                          : "Category"}
                  </Badge>
                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm mt-2 line-clamp-2">{item.prompt}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selected ? `Review Item ${selectedIndex + 1} of ${items.length}` : "Select an item"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selected && <p className="text-sm text-gray-500">Choose an item from the queue.</p>}
            {selected && (
              <div className="space-y-4">
                <div className="border rounded-md p-3 bg-gray-50">
                  <p className="text-sm">{selected.prompt}</p>
                </div>

                {!!selected.optionsJson?.length && (
                  <div className="flex flex-wrap gap-2">
                    {selected.optionsJson.map((opt) => (
                      <Button
                        key={`${selected.id}-${opt.value}`}
                        variant="outline"
                        size="sm"
                        onClick={() => resolveMutation.mutate({ id: selected.id, selectedOption: opt.value })}
                        disabled={resolveMutation.isPending}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3 bg-white">
                    {messagesLoading && <p className="text-sm text-gray-500">Loading messages...</p>}
                    {!messagesLoading && messages.length === 0 && (
                      <p className="text-sm text-gray-500 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        No messages yet.
                      </p>
                    )}
                    {messages.map((m) => (
                      <div key={m.id} className="text-sm">
                        <span className="font-medium capitalize">{m.role}:</span> {m.content}
                      </div>
                    ))}
                  </div>
                  <textarea
                    className="w-full border rounded-md p-2 text-sm min-h-20"
                    placeholder="Add context or note..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => selected && sendMessageMutation.mutate({ id: selected.id, content: message.trim() })}
                      disabled={!message.trim() || sendMessageMutation.isPending}
                    >
                      Send Note
                    </Button>
                    <Button onClick={() => resolveMutation.mutate({ id: selected.id })} disabled={resolveMutation.isPending}>
                      Resolve
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => skipMutation.mutate(selected.id)}
                      disabled={skipMutation.isPending}
                    >
                      Skip
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => lastAction?.id && undoMutation.mutate(lastAction.id)}
                      disabled={!lastAction || undoMutation.isPending}
                    >
                      Undo last
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Tip: choose an option chip for fastest Apply & Next flow.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
