import { useState } from "react";
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/
import ErrorBoundary from "@/components/ui/error-boundary";
button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ParsedTransaction {
  amount: number;
  description: string;
  vendor?: string;
  category?: string;
  date: string;
  confidence: number;
  action: 'add_transaction' | 'add_expense' | 'query_data';
}

interface NaturalLanguageInputProps {
  onTransactionAdded?: () => void;
}

export default function NaturalLanguageInput({ onTransactionAdded }: NaturalLanguageInputProps) {
  const [input, setInput] = useState("");
  const [lastParsed, setLastParsed] = useState<ParsedTransaction | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const parseInputMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("/api/ai/parse-transaction", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      return response;
    },
    onSuccess: (data) => {
      setLastParsed(data.parsed);
      if (data.parsed.action === 'add_transaction' || data.parsed.action === 'add_expense') {
        // Auto-confirm high confidence transactions
        if (data.parsed.confidence > 0.8) {
          confirmTransactionMutation.mutate(data.parsed);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: "Processing Failed",
        description: error.message || "Could not understand the input",
        variant: "destructive",
      });
    }
  });

  const confirmTransactionMutation = useMutation({
    mutationFn: async (parsedData: ParsedTransaction) => {
      const response = await apiRequest("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          amount: parsedData.amount.toString(),
          description: parsedData.description,
          vendor: parsedData.vendor,
          category: parsedData.category,
          date: parsedData.date,
          aiGenerated: true,
        }),
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/financial-summary"] });
      toast({
        title: "Transaction Added",
        description: "Your transaction has been successfully recorded",
      });
      setInput("");
      setLastParsed(null);
      onTransactionAdded?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Add Transaction",
        description: error.message || "Could not add the transaction",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    parseInputMutation.mutate(input);
  };

  const handleConfirm = () => {
    if (lastParsed) {
      confirmTransactionMutation.mutate(lastParsed);
    }
  };

  const handleReject = () => {
    setLastParsed(null);
  };

  const examples = [
    "Add $58 expense for office supplies from Staples yesterday",
    "I spent $120 on gas at Shell on Monday",
    "Record $2500 invoice payment from ABC Corp",
    "How much did I spend on travel last month?"
  ];

  return (
    if (isLoading) {
      return <div className="animate-pulse">Loading...</div>;
    }

    <div className="space-y-4">
      <ErrorBoundary>
        <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2 mb-3">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Natural Language Entry</h3>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell me about a transaction or ask a question..."
                className="flex-1"
                disabled={parseInputMutation.isPending}
              />
              <Button aria-label="Button action" 
                type="submit" 
                disabled={!input.trim() || parseInputMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {parseInputMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {examples.map((example, index) => (
                <motion.button
                  key={index}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInput(example)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  {example}
      </ErrorBoundary>
    </motion.button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation UI */}
      {lastParsed && (lastParsed.action === 'add_transaction' || lastParsed.action === 'add_expense') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-blue-900">Confirm Transaction</h4>
            <Badge variant="secondary">
              {Math.round(lastParsed.confidence * 100)}% confident
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
            <div>
              <span className="text-gray-600">Amount:</span>
              <p className="font-medium">${lastParsed.amount.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-600">Description:</span>
              <p className="font-medium">{lastParsed.description}</p>
            </div>
            {lastParsed.vendor && (
              <div>
                <span className="text-gray-600">Vendor:</span>
                <p className="font-medium">{lastParsed.vendor}</p>
              </div>
            )}
            <div>
              <span className="text-gray-600">Date:</span>
              <p className="font-medium">{new Date(lastParsed.date).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button aria-label="Small action button" 
              onClick={handleConfirm}
              disabled={confirmTransactionMutation.isPending}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {confirmTransactionMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Confirm & Add
            </Button>
            <Button aria-label="Small action button" 
              onClick={handleReject}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}