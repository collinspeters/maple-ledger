import { useState, useRef } from "react";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import ErrorBoundary from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { Camera, FileText, Image } from "lucide-react";
import { Receipt } from "@shared/schema";

export default function ReceiptUpload() {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('receipt', file);
      
      const response = await fetch('/api/receipts/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      toast({
        title: "Receipt Uploaded",
        description: "Your receipt is being processed by AI.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload receipt",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive",
        });
        return;
      }
      uploadReceiptMutation.mutate(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const recentReceipts = receipts?.slice(0, 2) || [];

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <Card className="shadow-card border-0 rounded-xl bg-white">
      <ErrorBoundary>
        <CardHeader className="border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Upload Receipt</h3>
          <p className="text-sm text-gray-600">Snap a photo or upload a PDF</p>
        </CardHeader>
        
        <CardContent className="p-6">
          {/* Upload area */}
          <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-gray-300 hover:border-primary"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          
          <div className="space-y-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto flex items-center justify-center">
              <Camera className="text-gray-600 text-lg" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Upload Receipt</p>
              <p className="text-xs text-gray-600">JPG, PNG, PDF up to 10MB</p>
            </div>
            <Button aria-label="Button action"
              disabled={uploadReceiptMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition-colors"
            >
              {uploadReceiptMutation.isPending ? "Uploading..." : "Choose File"}
            </Button>
          </div>
        </div>

        {/* Recent uploads */}
        {recentReceipts.length > 0 && (
          <div className="mt-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Recent Uploads</h4>
            <div className="space-y-2">
              {recentReceipts.map((receipt) => (
                <div key={receipt.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    {receipt.fileName.toLowerCase().includes('.pdf') ? (
                      <FileText className="text-error text-sm h-4 w-4" />
                    ) : (
                      <Image className="text-primary text-sm h-4 w-4" />
                    )}
                    <span className="text-sm text-gray-700 truncate max-w-[150px]">
                      {receipt.fileName}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    receipt.status === "processed" ? "bg-secondary/10 text-secondary" :
                    receipt.status === "processing" ? "bg-accent/10 text-accent" :
                    receipt.status === "matched" ? "bg-primary/10 text-primary" :
                    "bg-gray-200 text-gray-600"
                  }`}>
                    {receipt.status === "matched" ? "Matched" : 
                     receipt.status === "processed" ? "Processed" :
                     receipt.status === "processing" ? "Processing" : "Error"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </CardContent>
      </ErrorBoundary>
    </Card>
  );
}
