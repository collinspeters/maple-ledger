import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Send, DollarSign, Calendar, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import InvoiceModal from "@/components/invoices/invoice-modal";

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  status: string;
  issueDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  paidAt?: string;
  notes?: string;
  client?: {
    businessName: string;
    email: string;
  };
}

export default function Invoices() {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const queryClient = useQueryClient();

  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });

  const markPaidMutation = useMutation({
    mutationFn: (invoiceId: string) => 
      apiRequest(`/api/invoices/${invoiceId}/mark-paid`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "secondary",
      sent: "default", 
      paid: "default",
      overdue: "destructive"
    } as const;
    
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800", 
      overdue: "bg-red-100 text-red-800"
    };

    return (
      <Badge className={colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
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
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
            <p className="text-gray-600">Manage your client invoices and payments</p>
          </div>
          <Button 
            onClick={() => setShowInvoiceModal(true)}
            className="btn-modern bg-primary hover:bg-primary-dark text-white shadow-md"
            style={{ visibility: 'visible', display: 'flex', alignItems: 'center' }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Invoice
          </Button>
        </div>

        {/* Invoice Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-card border-0 rounded-xl bg-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{invoices?.length || 0}</p>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border-0 rounded-xl bg-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">
                    ${invoices?.filter(inv => inv.status === 'paid')
                      .reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0)
                      .toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-600">Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border-0 rounded-xl bg-white">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Send className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">
                    ${invoices?.filter(inv => inv.status === 'sent')
                      .reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0)
                      .toLocaleString() || '0'}
                  </p>
                  <p className="text-sm text-gray-600">Outstanding</p>
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
                    {invoices?.filter(inv => {
                      const dueDate = new Date(inv.dueDate);
                      return inv.status !== 'paid' && dueDate < new Date();
                    }).length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoices Grid */}
        {invoices && invoices.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {invoices.map((invoice) => (
              <Card key={invoice.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{invoice.invoiceNumber}</CardTitle>
                    {getStatusBadge(invoice.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {invoice.client?.businessName || 'Unknown Client'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="text-lg font-semibold">
                        ${parseFloat(invoice.totalAmount).toLocaleString()} {invoice.currency}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {invoice.status === 'sent' && (
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          markPaidMutation.mutate(invoice.id);
                        }}
                        disabled={markPaidMutation.isPending}
                        className="w-full mt-3"
                      >
                        Mark as Paid
                      </Button>
                    )}
                    
                    {invoice.status === 'paid' && invoice.paidAt && (
                      <div className="text-sm text-green-600 font-medium">
                        Paid on {new Date(invoice.paidAt).toLocaleDateString()}
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first invoice to start tracking payments
              </p>
              <Button onClick={() => setShowInvoiceModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Invoice
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {showInvoiceModal && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </>
  );
}