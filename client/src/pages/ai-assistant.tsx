import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, User, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  response: string;
  isFromUser: boolean;
  createdAt: string;
}

export default function AIAssistant() {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch chat history
  const { data: chatHistory = [], refetch } = useQuery({
    queryKey: ["/api/chat/history"],
    refetchOnWindowFocus: false,
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await apiRequest("/api/chat", "POST", { message: userMessage });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
      setMessage("");
      setIsTyping(false);
    },
    onError: (error: any) => {
      console.error("Chat error:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsTyping(false);
    },
  });

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || chatMutation.isPending) return;

    setIsTyping(true);
    chatMutation.mutate(message.trim());
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isTyping]);

  // Flatten and sort messages chronologically
  const allMessages = chatHistory.flatMap((chat: ChatMessage) => [
    {
      id: `${chat.id}-user`,
      content: chat.message,
      isFromUser: true,
      timestamp: chat.createdAt,
    },
    {
      id: `${chat.id}-assistant`,
      content: chat.response,
      isFromUser: false,
      timestamp: chat.createdAt,
    },
  ]).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Assistant</h1>
            <p className="text-gray-600 text-sm">
              Ask questions about your finances, transactions, and business insights
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-4 max-w-4xl mx-auto">
            {allMessages.length === 0 ? (
              <Card className="bg-gradient-to-br from-primary/5 to-blue-50">
                <CardContent className="py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Welcome to AI Assistant</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Ask me anything about your business finances. I can help you understand your transactions, 
                    analyze spending patterns, and provide insights for better financial decisions.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto text-sm">
                    <Button 
                      variant="outline" 
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => setMessage("What were my biggest expenses this month?")}
                    >
                      <span className="text-primary mr-2">💰</span>
                      What were my biggest expenses this month?
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => setMessage("Show me my profit and loss summary")}
                    >
                      <span className="text-primary mr-2">📊</span>
                      Show me my profit and loss summary
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => setMessage("Which transactions need review?")}
                    >
                      <span className="text-primary mr-2">🔍</span>
                      Which transactions need review?
                    </Button>
                    <Button 
                      variant="outline" 
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => setMessage("Help me categorize my expenses")}
                    >
                      <span className="text-primary mr-2">📋</span>
                      Help me categorize my expenses
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {allMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.isFromUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!msg.isFromUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.isFromUser
                          ? 'bg-primary text-primary-foreground ml-12'
                          : 'bg-muted mr-12'
                      }`}
                    >
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <div className="text-xs opacity-70 mt-2">
                        {new Date(msg.timestamp).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    {msg.isFromUser && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary flex-shrink-0 mt-1">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {isTyping && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[80%] rounded-lg p-4 bg-muted mr-12">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-6">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask me about your finances, transactions, or business insights..."
                className="flex-1"
                disabled={chatMutation.isPending}
              />
              <Button 
                type="submit" 
                disabled={!message.trim() || chatMutation.isPending}
                size="default"
              >
                {chatMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}