import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Link as LinkIcon,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle,
  X,
  AlertTriangle,
  Search
} from "lucide-react";

type Transaction = {
  id: string;
  date: string;
  amount: string;
  description: string;
  vendor?: string;
  category?: string;
  receiptAttached: boolean;
};

type Receipt = {
  id: string;
  fileName: string;
  extractedAmount?: string;
  extractedVendor?: string;
  extractedDate?: string;
  suggestedMatches?: Transaction[];
  matchConfidence?: string;
};

interface ReceiptMatchSuggestionsProps {
  receipts: Receipt[];
  onMatchConfirmed: (receiptId: string, transactionId: string) => void;
  onMatchRejected: (receiptId: string, transactionId: string) => void;
}

import React from "react";

const ReceiptMatchSuggestions = React.memo(function ReceiptMatchSuggestions({
  receipts,
  onMatchConfirmed,
  onMatchRejected
}: ReceiptMatchSuggestionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [processingMatches, setProcessingMatches] = useState<Set<string>>(new Set());

  const matchMutation = useMutation({
    mutationFn: async ({ receiptId, transactionId, action }: {
      receiptId: string;
      transactionId: string;
      action: 'confirm' | 'reject';
    }) => {
      const response = await fetch(`/api/receipts/${receiptId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ transactionId, action })
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} match`);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      const { receiptId, transactionId, action } = variables;
      
      if (action === 'confirm') {
        toast({
          title: "Receipt Matched",
          description: "Receipt has been successfully linked to the transaction.",
        });
        onMatchConfirmed(receiptId, transactionId);
      } else {
        toast({
          title: "Match Rejected",
          description: "Match suggestion has been dismissed.",
        });
        onMatchRejected(receiptId, transactionId);
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unmatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Match Failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (data, error, variables) => {
      setProcessingMatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(`${variables.receiptId}-${variables.transactionId}`);
        return newSet;
      });
    }
  });

  const handleMatch = (receiptId: string, transactionId: string, action: 'confirm' | 'reject') => {
    const key = `${receiptId}-${transactionId}`;
    setProcessingMatches(prev => new Set(prev).add(key));
    matchMutation.mutate({ receiptId, transactionId, action });
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA');
  };

  const getMatchScore = (receipt: Receipt, transaction: Transaction) => {
    let score = 0;
    let factors = [];

    // Amount match (within $1.00)
    if (receipt.extractedAmount && transaction.amount) {
      const receiptAmount = parseFloat(receipt.extractedAmount);
      const transactionAmount = Math.abs(parseFloat(transaction.amount));
      const amountDiff = Math.abs(receiptAmount - transactionAmount);
      
      if (amountDiff <= 1.00) {
        score += 40;
        factors.push('Amount match');
      } else if (amountDiff <= 5.00) {
        score += 20;
        factors.push('Similar amount');
      }
    }

    // Vendor match
    if (receipt.extractedVendor && (transaction.vendor || transaction.description)) {
      const receiptVendor = receipt.extractedVendor.toLowerCase();
      const transactionVendor = (transaction.vendor || transaction.description).toLowerCase();
      
      if (receiptVendor.includes(transactionVendor) || transactionVendor.includes(receiptVendor)) {
        score += 35;
        factors.push('Vendor match');
      }
    }

    // Date match (within 3 days)
    if (receipt.extractedDate && transaction.date) {
      const receiptDate = new Date(receipt.extractedDate);
      const transactionDate = new Date(transaction.date);
      const daysDiff = Math.abs((receiptDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) {
        score += 25;
        factors.push('Same date');
      } else if (daysDiff <= 3) {
        score += 15;
        factors.push('Similar date');
      }
    }

    return { score: Math.min(score, 100), factors };
  };

  const unmatched = receipts.filter(r => !r.suggestedMatches || r.suggestedMatches.length === 0);
  const withSuggestions = receipts.filter(r => r.suggestedMatches && r.suggestedMatches.length > 0);

  if (receipts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Receipts with Suggestions */}
      {withSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              Smart Match Suggestions ({withSuggestions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {withSuggestions.map(receipt => (
              <div key={receipt.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{receipt.fileName}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      {receipt.extractedVendor && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {receipt.extractedVendor}
                        </span>
                      )}
                      {receipt.extractedAmount && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(receipt.extractedAmount)}
                        </span>
                      )}
                      {receipt.extractedDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(receipt.extractedDate)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">Suggested matches:</h5>
                  {receipt.suggestedMatches!.slice(0, 3).map(transaction => {
                    const matchKey = `${receipt.id}-${transaction.id}`;
                    const isProcessing = processingMatches.has(matchKey);
                    const { score, factors } = getMatchScore(receipt, transaction);

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">
                              {formatCurrency(transaction.amount)}
                            </span>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                score >= 80 ? 'bg-green-100 text-green-800' :
                                score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {score}% match
                            </Badge>
                            {transaction.receiptAttached && (
                              <Badge variant="outline" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Has receipt
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {transaction.vendor || transaction.description}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(transaction.date)} • {factors.join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleMatch(receipt.id, transaction.id, 'confirm')}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            aria-label="Match receipt to this transaction"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Match
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMatch(receipt.id, transaction.id, 'reject')}
                            disabled={isProcessing}
                            aria-label="Reject this receipt match"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Unmatched Receipts */}
      {unmatched.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Unmatched Receipts ({unmatched.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unmatched.map(receipt => (
                <div key={receipt.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{receipt.fileName}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      {receipt.extractedVendor && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {receipt.extractedVendor}
                        </span>
                      )}
                      {receipt.extractedAmount && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(receipt.extractedAmount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-yellow-700 bg-yellow-50">
                    No matches found
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> These receipts couldn't be automatically matched. 
                You can manually create transactions for them or wait for bank sync to find matches.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}