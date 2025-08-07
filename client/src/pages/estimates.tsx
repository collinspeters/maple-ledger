import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Send, DollarSign, Calendar, User, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import EstimateModal from "@/components/estimates/estimate-modal";

interface Estimate {
  id: string;
  estimateNumber: string;
  clientId: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  totalAmount: string;
  currency: string;
  acceptedAt?: string;
  convertedInvoiceId?: string;
  client?: {
    businessName: string;
    email: string;
  };
}

export default function Estimates() {
  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const queryClient = useQueryClient();

  const { data: estimates, isLoading } = useQuery<Estimate[]>({
    queryKey: ["/api/estimates"],
  });

  const convertToInvoiceMutation = useMutation({
    mutationFn: (estimateId: string) => 
      apiRequest(`/api/estimates/${estimateId}/convert-to-invoice`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const getStatusBadge = (status: string) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      accepted: "bg-green-100 text-green-800", 
      declined: "bg-red-100 text-red-800",
      expired: "bg-orange-100 text-orange-800"
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Estimates</h1>
            <p className="text-gray-600">Create and manage project estimates for your clients</p>
          </div>
          <Button 
            onClick={() => setShowEstimateModal(true)}
            className="bg-primary hover:bg-primary-dark"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Estimate
          </Button>
        </div>

        {/* Estimate Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{estimates?.length || 0}</p>
                  <p className="text-sm text-gray-600">Total Estimates</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Send className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {estimates?.filter(est => est.status === 'sent').length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {estimates?.filter(est => est.status === 'accepted').length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Accepted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {estimates?.filter(est => 
                      est.status !== 'accepted' && isExpired(est.expiryDate)
                    ).length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estimates Grid */}
        {estimates && estimates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {estimates.map((estimate) => (
              <Card key={estimate.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{estimate.estimateNumber}</CardTitle>
                    {getStatusBadge(estimate.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {estimate.client?.businessName || 'Unknown Client'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-lg font-semibold">
                        ${parseFloat(estimate.totalAmount).toLocaleString()} {estimate.currency}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Expires: {new Date(estimate.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {estimate.status === 'sent' && !isExpired(estimate.expiryDate) && (
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          convertToInvoiceMutation.mutate(estimate.id);
                        }}
                        disabled={convertToInvoiceMutation.isPending}
                        className="w-full mt-3"
                      >
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Convert to Invoice
                      </Button>
                    )}
                    
                    {estimate.status === 'accepted' && estimate.acceptedAt && (
                      <div className="text-sm text-green-600 font-medium">
                        Accepted on {new Date(estimate.acceptedAt).toLocaleDateString()}
                        {estimate.convertedInvoiceId && (
                          <div className="text-xs text-gray-500 mt-1">
                            Converted to invoice
                          </div>
                        )}
                      </div>
                    )}
                    
                    {estimate.status !== 'accepted' && isExpired(estimate.expiryDate) && (
                      <div className="text-sm text-red-600 font-medium">
                        Expired on {new Date(estimate.expiryDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No estimates yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first estimate to start proposing projects to clients
              </p>
              <Button onClick={() => setShowEstimateModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Estimate
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {showEstimateModal && (
        <EstimateModal
          estimate={selectedEstimate}
          onClose={() => {
            setShowEstimateModal(false);
            setSelectedEstimate(null);
          }}
        />
      )}
    </>
  );
}