import { useState } from "react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Receipt as ReceiptIcon,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  ExternalLink,
  Download,
  Trash2,
  Link as LinkIcon,
  Tag,
  Clock,
  CheckCircle,
  AlertCircle,
  X
} from "lucide-react";

type Receipt = {
  id: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  extractedAmount?: string;
  extractedVendor?: string;
  extractedDate?: string;
  extractedTax?: string;
  extractedCurrency?: string;
  extractedLineItems?: any[];
  isMatched: boolean;
  matchedTransactionId?: string;
  matchConfidence?: string;
  suggestedMatches?: any[];
  status: string;
  processingError?: string;
  notes?: string;
  tags?: string[];
  isAuditReady: boolean;
  createdAt: string;
  updatedAt?: string;
};

type Transaction = {
  id: string;
  date: string;
  amount: string;
  description: string;
  vendor?: string;
  category?: string;
};

interface ReceiptViewerProps {
  receipt: Receipt | null;
  matchedTransaction?: Transaction | null;
  suggestedTransactions?: Transaction[];
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (receiptId: string) => void;
  onMatchTransaction?: (receiptId: string, transactionId: string) => void;
  onUnmatchTransaction?: (receiptId: string) => void;
}

export default function ReceiptViewer({
  receipt,
  matchedTransaction,
  suggestedTransactions = [],
  isOpen,
  onClose,
  onDelete,
  onMatchTransaction,
  onUnmatchTransaction
}: ReceiptViewerProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  if (!receipt) return null;

  const formatCurrency = (amount?: string, currency = "CAD") => {
    if (!amount) return "N/A";
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency
    }).format(num);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('en-CA');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "matched":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "processing":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "processed":
        return <FileText className="h-4 w-4 text-blue-600" />;
      default:
        return <ReceiptIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "matched":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "processed":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const isImageFile = (mimeType?: string) => {
    return mimeType?.startsWith('image/');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/receipts/${receipt.id}/download`;
    link.download = receipt.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ReceiptIcon className="h-5 w-5 text-blue-600" />
              Receipt Details
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={getStatusColor(receipt.status)}>
                {getStatusIcon(receipt.status)}
                <span className="ml-1 capitalize">{receipt.status}</span>
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Receipt Preview */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Receipt Preview</h3>
                <Button o> console.log('Button clicked')} aria-label="Small action button"
                  variant="outline"
                  size="sm"
                  o
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>

              {isImageFile(receipt.mimeType) ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <img a a a a a alt="Interface image"lt="Interface image"lt="Interface image"lt="Interface image"lt="Interface image"lt="Interface image"
                    src={`/api/receipts/${receipt.id}/preview`}
                    alt={receipt.fileName}
                    className="w-full h-auto max-h-96 object-contain rounded"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">Preview not available</p>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-900 font-medium">{receipt.fileName}</p>
                  <p className="text-sm text-gray-500 mt-1">PDF Document</p>
                </div>
              )}

              <div className="mt-4 text-sm text-gray-600">
                <p>File: {receipt.fileName}</p>
                {receipt.fileSize && (
                  <p>Size: {(receipt.fileSize / 1024).toFixed(1)} KB</p>
                )}
                <p>Uploaded: {formatDate(receipt.createdAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Extracted Data */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-3">Extracted Information</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Vendor:</span>
                    <span className="font-medium">
                      {receipt.extractedVendor || "Not detected"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Amount:</span>
                    <span className="font-medium">
                      {formatCurrency(receipt.extractedAmount, receipt.extractedCurrency)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Date:</span>
                    <span className="font-medium">
                      {formatDate(receipt.extractedDate)}
                    </span>
                  </div>

                  {receipt.extractedTax && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Tax:</span>
                      <span className="font-medium">
                        {formatCurrency(receipt.extractedTax, receipt.extractedCurrency)}
                      </span>
                    </div>
                  )}
                </div>

                {receipt.processingError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Processing Error</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">{receipt.processingError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transaction Match */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-3">Transaction Match</h3>
                
                {receipt.isMatched && matchedTransaction ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <LinkIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">Linked to Transaction</span>
                      {receipt.matchConfidence && (
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(parseFloat(receipt.matchConfidence) * 100)}% confidence
                        </Badge>
                      )}
                    </div>
                    
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-green-900">
                            {formatCurrency(matchedTransaction.amount)}
                          </p>
                          <p className="text-sm text-green-700">
                            {matchedTransaction.vendor || matchedTransaction.description}
                          </p>
                          <p className="text-xs text-green-600">
                            {formatDate(matchedTransaction.date)}
                          </p>
                        </div>
                        {onUnmatchTransaction && (
                          <Button o> console.log('Button clicked')} aria-label="Small action button"
                            variant="ghost"
                            size="sm"
                            o> onUnmatchTransaction(receipt.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">No transaction linked</span>
                      {suggestedTransactions.length > 0 && (
                        <Button o> console.log('Button clicked')} aria-label="Small action button"
                          variant="outline"
                          size="sm"
                          o> setShowSuggestions(!showSuggestions)}
                        >
                          View Suggestions ({suggestedTransactions.length})
                        </Button>
                      )}
                    </div>

                    {showSuggestions && suggestedTransactions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900">Suggested Matches:</p>
                        {suggestedTransactions.slice(0, 3).map((transaction) => (
                          <div
                            key={transaction.id}
                            className="p-3 bg-gray-50 border rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                            o> onMatchTransaction?.(receipt.id, transaction.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {formatCurrency(transaction.amount)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {transaction.vendor || transaction.description}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(transaction.date)}
                                </p>
                              </div>
                              <Button o> console.log('Button clicked')} aria-label="Small action button" size="sm" variant="ghost">
                                <LinkIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes and Tags */}
            {(receipt.notes || receipt.tags?.length) && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Additional Information</h3>
                  
                  {receipt.notes && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">Notes:</p>
                      <p className="text-sm text-gray-900">{receipt.notes}</p>
                    </div>
                  )}

                  {receipt.tags && receipt.tags.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {receipt.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <Separator />
        <div className="flex justify-between">
          <Button o> console.log('Button clicked')} aria-label="Button action"
            variant="outline"
            o
          >
            Close
          </Button>
          
          {onDelete && (
            <Button o> console.log('Button clicked')} aria-label="Button action"
              variant="destructive"
              o> {
                onDelete(receipt.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Receipt
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}