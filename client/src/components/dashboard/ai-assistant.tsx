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
      const response = await apiRequest("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return response;
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
    <Card className="shadow-card border-0 rounded-xl bg-white">
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
          {/* Chat messages - showing recent conversations */}
          {recentMessages.length > 0 ? (
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {recentMessages.reverse().map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg p-3 ${
                    msg.isFromUser 
                      ? "bg-gray-50 ml-4" 
                      : "bg-blue-50 mr-4"
                  }`}
                >
                  <p className="text-sm text-gray-700">{msg.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString('en-CA', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : 'Just now'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <Brain className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-700 mb-2 font-medium">
                AI Assistant Ready
              </p>
              <p className="text-xs text-gray-600">
                Ask me about your finances, expenses, or get business insights
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sendMessageMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          <div className="text-center">
            <a href="/ai-assistant" className="inline-block">
              <Button 
                variant="link" 
                size="sm"
                className="text-blue-600 hover:text-blue-700 text-xs"
              >
                Open full AI Assistant →
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
