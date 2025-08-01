import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import ReceiptUpload from "@/components/receipts/receipt-upload";
import ReceiptViewer from "@/components/receipts/receipt-viewer";
import ReceiptMatchSuggestions from "@/components/receipts/receipt-match-suggestions";
import {
  Receipt as ReceiptIcon,
  Upload,
  Search,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Link as LinkIcon,
  X,
  Filter
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
  isMatched: boolean;
  matchedTransactionId?: string;
  matchConfidence?: string;
  suggestedMatches?: Transaction[];
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
  receiptAttached: boolean;
};

export default function Receipts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  // Fetch all receipts
  const { data: receipts = [], isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  // Fetch unmatched receipts with suggestions
  const { data: unmatchedReceipts = [] } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts/unmatched"],
  });

  // Fetch matched transaction for selected receipt
  const { data: matchedTransaction } = useQuery<Transaction>({
    queryKey: ["/api/transactions", selectedReceipt?.matchedTransactionId],
    enabled: !!selectedReceipt?.matchedTransactionId,
  });

  // Delete receipt mutation
  const deleteMutation = useMutation({
    mutationFn: (receiptId: string) =>
      fetch(`/api/receipts/${receiptId}`, { 
        method: "DELETE",
        credentials: "include" 
      }),
    onSuccess: () => {
      toast({
        title: "Receipt Deleted",
        description: "Receipt has been successfully deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unmatched"] });
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete receipt. Please try again.",
        variant: "destructive",
      });
    },
  });

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
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
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

  const handleReceiptClick = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setViewerOpen(true);
  };

  const handleMatchConfirmed = (receiptId: string, transactionId: string) => {
    // Refresh data after successful match
    queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/receipts/unmatched"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
  };

  const handleMatchRejected = (receiptId: string, transactionId: string) => {
    // Refresh unmatched receipts after rejection
    queryClient.invalidateQueries({ queryKey: ["/api/receipts/unmatched"] });
  };

  const handleUnmatchTransaction = (receiptId: string) => {
    // Implementation for unlinking receipt from transaction
    // This would call the API to remove the match
  };

  // Categorize receipts
  const matchedReceipts = receipts.filter(r => r.isMatched);
  const processingReceipts = receipts.filter(r => r.status === "processing");
  const failedReceipts = receipts.filter(r => r.status === "failed");
  const processedReceipts = receipts.filter(r => r.status === "processed" && !r.isMatched);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Receipts</h1>
          <p className="text-gray-600 mt-2">
            Upload and manage your business receipts with smart matching
          </p>
        </div>
        <ReceiptUpload onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/receipts/unmatched"] });
        }} />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{matchedReceipts.length}</p>
                <p className="text-sm text-gray-600">Matched</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{processedReceipts.length}</p>
                <p className="text-sm text-gray-600">Processed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{processingReceipts.length}</p>
                <p className="text-sm text-gray-600">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{failedReceipts.length}</p>
                <p className="text-sm text-gray-600">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart Matching Section */}
      {unmatchedReceipts.length > 0 && (
        <ReceiptMatchSuggestions
          receipts={unmatchedReceipts}
          onMatchConfirmed={handleMatchConfirmed}
          onMatchRejected={handleMatchRejected}
        />
      )}

      {/* Receipts Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Receipts ({receipts.length})</TabsTrigger>
          <TabsTrigger value="matched">Matched ({matchedReceipts.length})</TabsTrigger>
          <TabsTrigger value="processed">Processed ({processedReceipts.length})</TabsTrigger>
          <TabsTrigger value="processing">Processing ({processingReceipts.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed ({failedReceipts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ReceiptList 
            receipts={receipts} 
            onReceiptClick={handleReceiptClick}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="matched">
          <ReceiptList 
            receipts={matchedReceipts} 
            onReceiptClick={handleReceiptClick}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="processed">
          <ReceiptList 
            receipts={processedReceipts} 
            onReceiptClick={handleReceiptClick}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="processing">
          <ReceiptList 
            receipts={processingReceipts} 
            onReceiptClick={handleReceiptClick}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="failed">
          <ReceiptList 
            receipts={failedReceipts} 
            onReceiptClick={handleReceiptClick}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>
      </Tabs>

      {/* Receipt Viewer Dialog */}
      <ReceiptViewer
        receipt={selectedReceipt}
        matchedTransaction={matchedTransaction}
        isOpen={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setSelectedReceipt(null);
        }}
        onDelete={(id) => deleteMutation.mutate(id)}
        onUnmatchTransaction={handleUnmatchTransaction}
      />
    </div>
  );
}

// Receipt List Component
function ReceiptList({ 
  receipts, 
  onReceiptClick, 
  onDelete 
}: { 
  receipts: Receipt[]; 
  onReceiptClick: (receipt: Receipt) => void;
  onDelete: (id: string) => void;
}) {
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
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
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

  if (receipts.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <ReceiptIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Receipts Found</h3>
          <p className="text-gray-600 mb-6">
            Upload your first receipt to get started with smart expense tracking.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-gray-200">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Receipt Icon/Preview */}
                  <div className="flex-shrink-0">
                    {receipt.mimeType?.startsWith('image/') ? (
                      <img
                        src={`/api/receipts/${receipt.id}/thumbnail`}
                        alt="Receipt thumbnail"
                        className="w-12 h-12 object-cover rounded border"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-12 h-12 bg-gray-100 rounded flex items-center justify-center ${receipt.mimeType?.startsWith('image/') ? 'hidden' : ''}`}>
                      <FileText className="h-6 w-6 text-gray-500" />
                    </div>
                  </div>

                  {/* Receipt Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 truncate">{receipt.fileName}</p>
                      <Badge variant="outline" className={`text-xs ${getStatusColor(receipt.status)}`}>
                        {getStatusIcon(receipt.status)}
                        <span className="ml-1 capitalize">{receipt.status}</span>
                      </Badge>
                      {receipt.isMatched && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                          <LinkIcon className="h-3 w-3 mr-1" />
                          Linked
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {receipt.extractedVendor && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {receipt.extractedVendor}
                        </span>
                      )}
                      {receipt.extractedAmount && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCurrency(receipt.extractedAmount, receipt.extractedCurrency)}
                        </span>
                      )}
                      {receipt.extractedDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(receipt.extractedDate)}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        Uploaded {formatDate(receipt.createdAt)}
                      </span>
                    </div>

                    {receipt.processingError && (
                      <p className="text-xs text-red-600 mt-1">{receipt.processingError}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReceiptClick(receipt)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(receipt.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}