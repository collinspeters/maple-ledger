import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Collaborator = {
  id: string;
  invitedEmail: string;
  role: "accountant" | "bookkeeper";
  status: "invited" | "active";
  inviteExpiresAt?: string | null;
  createdAt: string;
};

function getRoleLabel(role: Collaborator["role"]): string {
  return role === "accountant" ? "Accountant/bookkeeper" : "Other";
}

export default function AccessPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"accountant" | "bookkeeper">("accountant");

  const { data, isLoading } = useQuery<{ items: Collaborator[]; data?: { items: Collaborator[] } }>({
    queryKey: ["/api/access/collaborators"],
  });
  const collaborators = useMemo(() => data?.items || data?.data?.items || [], [data]);

  const inviteMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/access/invite", {
        method: "POST",
        body: JSON.stringify({ email, role }),
      }),
    onSuccess: () => {
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["/api/access/collaborators"] });
      toast({ title: "Invite sent", description: "Collaborator invite created." });
    },
    onError: (error: any) => {
      toast({ title: "Invite failed", description: error.message || "Could not send invite", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/access/collaborators/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/collaborators"] });
      toast({ title: "Access removed", description: "Collaborator removed." });
    },
    onError: (error: any) => {
      toast({ title: "Remove failed", description: error.message || "Could not remove collaborator", variant: "destructive" });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/access/collaborators/${id}/resend`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access/collaborators"] });
      toast({ title: "Invite resent", description: "A new invite token has been generated." });
    },
    onError: (error: any) => {
      toast({ title: "Resend failed", description: error.message || "Could not resend invite", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Access</h1>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Invite collaborator</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="accountant@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "accountant" | "bookkeeper")}
            >
              <option value="accountant">Accountant/bookkeeper</option>
              <option value="bookkeeper">Other</option>
            </select>
          </div>
          <div className="md:col-span-3">
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!email || inviteMutation.isPending}
              className="bg-primary hover:bg-primary-dark"
            >
              {inviteMutation.isPending ? "Sending..." : "Send invite"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Collaborators</h2>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-gray-600">Loading collaborators...</p>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-gray-600">No collaborators yet.</p>
          ) : (
            <div className="space-y-3">
              {collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium text-gray-900">{c.invitedEmail}</p>
                    <p className="text-xs text-gray-600 capitalize">
                      {getRoleLabel(c.role)} • {c.status}
                      {c.status === "invited" && c.inviteExpiresAt ? ` • expires ${new Date(c.inviteExpiresAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status === "invited" && (
                      <Button
                        variant="outline"
                        onClick={() => resendMutation.mutate(c.id)}
                        disabled={resendMutation.isPending}
                      >
                        Resend
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => removeMutation.mutate(c.id)}
                      disabled={removeMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
