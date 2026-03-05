import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Brain, Zap, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface BulkCategorizeResult {
  message: string;
  results: Array<{
    id: string;
    status: 'success' | 'error' | 'skipped';
    category?: string;
    confidence?: number;
    error?: string;
    reason?: string;
  }>;
  summary: {
    total: number;
    success: number;
    errors: number;
    skipped: number;
  };
}

export default function BulkCategorizeButton() {
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<BulkCategorizeResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bulkCategorizeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/transactions/bulk-categorize', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: (data) => {
      setResults(data);
      setShowResults(true);
      
      // Refresh transactions data
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      toast({
        title: 'AI Categorization Complete',
        description: `Successfully categorized ${data.summary.success} transactions`,
      });
    },
    onError: (error: any) => {
      console.error('Bulk categorization failed:', error);
      toast({
        title: 'Categorization Failed',
        description: error.message || 'Failed to categorize transactions',
        variant: 'destructive',
      });
    },
  });

  const handleBulkCategorize = () => {
    if (bulkCategorizeMutation.isPending) return;
    
    setShowResults(false);
    setResults(null);
    bulkCategorizeMutation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-0 rounded-xl bg-white">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-primary" />
            <CardTitle>AI Transaction Categorization</CardTitle>
          </div>
          <CardDescription>
            Automatically categorize uncategorized transactions using AI for T2125 tax compliance
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Button
            onClick={handleBulkCategorize}
            disabled={bulkCategorizeMutation.isPending}
            className="btn-modern bg-primary hover:bg-primary-dark text-white shadow-md"
          >
            {bulkCategorizeMutation.isPending ? (
              <>
                <Zap className="mr-2 h-4 w-4 animate-pulse" />
                Categorizing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Categorize All Transactions
              </>
            )}
          </Button>

          {bulkCategorizeMutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Processing transactions...</span>
              </div>
              <Progress value={50} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {showResults && results && (
        <Card className="shadow-card border-0 rounded-xl bg-white">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Categorization Results</span>
            </CardTitle>
            <CardDescription>{results.message}</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{results.summary.success}</div>
                <div className="text-sm text-green-700">Success</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{results.summary.errors}</div>
                <div className="text-sm text-red-700">Errors</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{results.summary.skipped}</div>
                <div className="text-sm text-yellow-700">Skipped</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{results.summary.total}</div>
                <div className="text-sm text-blue-700">Total</div>
              </div>
            </div>

            {/* Detailed Results */}
            {results.results.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Processing Details</h4>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {results.results.slice(0, 20).map((result, index) => (
                    <div key={result.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(result.status)}
                        <span className="font-mono text-xs text-gray-500">
                          {result.id.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {result.category && (
                          <Badge className="text-xs">
                            {result.category}
                          </Badge>
                        )}
                        {result.confidence && (
                          <span className="text-xs text-gray-600">
                            {(result.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        <Badge className={`text-xs ${getStatusColor(result.status)}`}>
                          {result.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {results.results.length > 20 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      ... and {results.results.length - 20} more results
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
