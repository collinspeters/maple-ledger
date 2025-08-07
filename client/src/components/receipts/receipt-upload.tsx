import { useState, useCallback } from "react";
import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/
import ErrorBoundary from "@/components/ui/error-boundary";
button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  File,
  Image,
  FileText,
  X,
  Plus,
  Camera,
  Tag,
  Loader2
} from "lucide-react";

type UploadFile = {
  file: File;
  preview?: string;
  progress?: number;
  error?: string;
};

interface ReceiptUploadProps {
  onUploadComplete?: () => void;
}

export default function ReceiptUpload({ onUploadComplete }: ReceiptUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/receipts/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Receipt Uploaded Successfully",
        description: `${data.uploadedCount} receipt(s) uploaded and processing started.`,
      });
      
      // Reset form
      setFiles([]);
      setNotes("");
      setTags("");
      setIsOpen(false);
      
      // Refresh receipts list
      queryClient.invalidateQueries({ queryKey: ["/api/receipts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/receipts/unmatched"] });
      
      onUploadComplete?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: true,
    onDropRejected: (fileRejections: any[]) => {
      fileRejections.forEach((rejection: any) => {
        toast({
          title: "File Rejected",
          description: `${rejection.file.name}: ${rejection.errors[0]?.message}`,
          variant: "destructive",
        });
      });
    }
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const file = prev[index];
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select at least one receipt to upload.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    files.forEach(({ file }) => {
      formData.append('receipts', file);
    });
    
    if (notes.trim()) {
      formData.append('notes', notes.trim());
    }
    
    if (tags.trim()) {
      formData.append('tags', tags.trim());
    }

    uploadMutation.mutate(formData);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-6 w-6" />;
    if (file.type === 'application/pdf') return <FileText className="h-6 w-6 text-red-500" />;
    return <File className="h-6 w-6" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <ErrorBoundary>
        <DialogTrigger asChild>
        <Button onClick={() => console.log('Button clicked')} aria-label="Button action" className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
          <Upload className="h-4 w-4 mr-2" />
          Upload Receipt
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Upload Receipts
          </DialogTitle>
        </DialogHeader>
    if (isLoading) {
      return <div className="animate-pulse">Loading...</div>;
    }

    <div className="space-y-4">
          {/* Upload Zone */}
          <Card>
            <CardContent className="p-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 ${
                  isDragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                
                {isDragActive ? (
                  <p className="text-blue-600 font-medium">Drop files here...
      </ErrorBoundary>
    </p>
                ) : (
                  <div>
                    <p className="text-gray-900 font-medium mb-1">
                      Drag & drop receipts here, or <span className="text-blue-600">browse</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports JPG, PNG, PDF up to 10MB each
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* File List */}
          {files.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="font-medium text-gray-900 mb-3">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2">
                  {files.map((uploadFile, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {uploadFile.preview ? (
                        <img a a a alt="Interface image"lt="Interface image"lt="Interface image"lt="Interface image" 
                          src={uploadFile.preview} 
                          alt="Preview" 
                          className="h-10 w-10 object-cover rounded" 
                        />
                      ) : (
                        getFileIcon(uploadFile.file)
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {uploadFile.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                      </div>
                      
                      <Button onClick={() => console.log('Button clicked')} aria-label="Small action button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optional Fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="notes" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Notes (Optional)
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about these receipts..."
                className="mt-1"
                rows={3}
              />
            </div>
            
            <div>
              <Label htmlFor="tags" className="flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Tags (Optional)
              </Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="office-supplies, travel, meals (comma-separated)"
                className="mt-1"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button aria-label="Button action"
              onClick={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Upload {files.length} Receipt{files.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
            
            <Button onClick={() => console.log('Button clicked')} aria-label="Button action"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}