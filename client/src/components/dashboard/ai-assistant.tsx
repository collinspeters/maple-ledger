import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brain, Send } from "lucide-react";
import { ChatMessage } from "@shared/schema";

export default function AiAssistant() {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const { data: chatHistory } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/history"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat", { message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
      setMessage("");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const recentMessages = chatHistory?.slice(0, 4) || [];

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Brain className="text-primary h-4 w-4" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">AI Assistant</h3>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Chat messages */}
          {recentMessages.length > 0 ? (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {recentMessages.reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 ${
                    msg.isFromUser 
                      ? "bg-gray-50 ml-4" 
                      : "bg-primary/10 mr-4"
                  }`}
                >
                  <p className="text-sm text-gray-700">{msg.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm text-gray-700">
                Hello! I'm your AI assistant. Ask me anything about your business finances, like "How much did I spend on office supplies this month?"
              </p>
            </div>
          )}

          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex space-x-2">
            <Input
              placeholder="Ask about your finances..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={sendMessageMutation.isPending}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={sendMessageMutation.isPending || !message.trim()}
              className="bg-primary hover:bg-primary-dark"
            >
              {sendMessageMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
