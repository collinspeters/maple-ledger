import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Download, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxable: boolean;
}

interface Client {
  id: string;
  businessName: string;
  contactName?: string;
  email: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country: string;
}

interface InvoicePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  invoice: {
    invoiceNumber: string;
    client: Client;
    issueDate: string;
    dueDate: string;
    items: InvoiceItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    notes?: string;
    status: string;
  };
  businessInfo: {
    businessName: string;
    address?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    email?: string;
    phone?: string;
  };
}

export default function InvoicePreview({ 
  isOpen, 
  onClose, 
  onSend, 
  invoice, 
  businessInfo 
}: InvoicePreviewProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'paid': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ 
              scale: isMinimized ? 0.3 : 1, 
              opacity: 1, 
              y: isMinimized ? 300 : 0,
              x: isMinimized ? 400 : 0
            }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden ${
              isMinimized ? 'cursor-pointer' : ''
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (isMinimized) setIsMinimized(false);
            }}
          >
            {/* Header with controls */}
            <motion.div 
              className="bg-gray-50 border-b px-6 py-4 flex items-center justify-between"
              layout
            >
              <div className="flex items-center space-x-3">
                <Eye className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Invoice Preview
                </h3>
                <Badge className={getStatusColor(invoice.status)}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                  title={isMinimized ? "Expand Preview" : "Minimize Preview"}
                >
                  {isMinimized ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </motion.button>
                
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    onClick={onSend}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Invoice
                  </Button>
                </motion.div>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>
            </motion.div>

            {/* Invoice content */}
            <AnimatePresence>
              {!isMinimized && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="overflow-y-auto max-h-[calc(90vh-80px)]"
                >
                  <div className="p-8 bg-white">
                    {/* Invoice Header */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="flex justify-between items-start mb-8"
                    >
                      <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">INVOICE</h1>
                        <p className="text-xl text-gray-600">#{invoice.invoiceNumber}</p>
                      </div>
                      
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-blue-600 mb-2">
                          {businessInfo.businessName}
                        </h2>
                        {businessInfo.address && (
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>{businessInfo.address}</p>
                            <p>
                              {businessInfo.city}, {businessInfo.province} {businessInfo.postalCode}
                            </p>
                            <p>{businessInfo.country}</p>
                            {businessInfo.email && <p>{businessInfo.email}</p>}
                            {businessInfo.phone && <p>{businessInfo.phone}</p>}
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Bill To & Invoice Details */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8"
                    >
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Bill To:</h3>
                        <div className="text-gray-700">
                          <p className="font-semibold">{invoice.client.businessName}</p>
                          {invoice.client.contactName && (
                            <p>{invoice.client.contactName}</p>
                          )}
                          <p>{invoice.client.email}</p>
                          {invoice.client.address && (
                            <div className="mt-2 space-y-1 text-sm">
                              <p>{invoice.client.address}</p>
                              <p>
                                {invoice.client.city}, {invoice.client.province} {invoice.client.postalCode}
                              </p>
                              <p>{invoice.client.country}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Issue Date:</span>
                            <span className="font-medium">{formatDate(invoice.issueDate)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Due Date:</span>
                            <span className="font-medium">{formatDate(invoice.dueDate)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Amount Due:</span>
                            <span className="text-2xl font-bold text-blue-600">
                              {formatCurrency(invoice.totalAmount)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Invoice Items */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mb-8"
                    >
                      <Card>
                        <CardHeader>
                          <h3 className="text-lg font-semibold">Items</h3>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Description
                                  </th>
                                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Qty
                                  </th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Rate
                                  </th>
                                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Amount
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {invoice.items.map((item, index) => (
                                  <motion.tr
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + index * 0.1 }}
                                  >
                                    <td className="px-6 py-4 text-sm text-gray-900">
                                      {item.description}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 text-center">
                                      {item.quantity}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 text-right">
                                      {formatCurrency(item.unitPrice)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">
                                      {formatCurrency(item.totalPrice)}
                                    </td>
                                  </motion.tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>

                    {/* Totals */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex justify-end mb-8"
                    >
                      <div className="w-80">
                        <div className="space-y-3">
                          <div className="flex justify-between text-gray-700">
                            <span>Subtotal:</span>
                            <span>{formatCurrency(invoice.subtotal)}</span>
                          </div>
                          {invoice.taxAmount > 0 && (
                            <div className="flex justify-between text-gray-700">
                              <span>Tax:</span>
                              <span>{formatCurrency(invoice.taxAmount)}</span>
                            </div>
                          )}
                          <div className="border-t pt-3">
                            <div className="flex justify-between text-xl font-bold text-gray-900">
                              <span>Total:</span>
                              <span>{formatCurrency(invoice.totalAmount)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>

                    {/* Notes */}
                    {invoice.notes && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="border-t pt-6"
                      >
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Notes</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</p>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}