import { useState } from "react";
import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/
import ErrorBoundary from "@/components/ui/error-boundary";
button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

interface Client {
  id: string;
  businessName: string;
  currency: string;
}

interface Estimate {
  id: string;
  clientId: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string;
}

interface EstimateItem {
  description: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  taxable: boolean;
}

const estimateSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  issueDate: z.string().min(1, "Issue date is required"),
  expiryDate: z.string().min(1, "Expiry date is required"),
  notes: z.string().optional(),
});

const itemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.string().min(1, "Quantity is required"),
  unitPrice: z.string().min(1, "Unit price is required"),
  taxable: z.boolean(),
});

type EstimateFormData = z.infer<typeof estimateSchema>;
type ItemFormData = z.infer<typeof itemSchema>;

interface EstimateModalProps {
  estimate?: Estimate | null;
  onClose: () => void;
}

export default function EstimateModal({ estimate, onClose }: EstimateModalProps) {
  const [items, setItems] = useState<ItemFormData[]>([
    { description: "", quantity: "1", unitPrice: "0", taxable: true }
  ]);
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const form = useForm<EstimateFormData>({
    resolver: zodResolver(estimateSchema),
    defaultValues: {
      clientId: estimate?.clientId || "",
      issueDate: estimate ? estimate.issueDate.split('T')[0] : new Date().toISOString().split('T')[0],
      expiryDate: estimate ? estimate.expiryDate.split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: estimate?.notes || "",
    },
  });

  const createEstimateMutation = useMutation({
    mutationFn: (data: { estimate: EstimateFormData; items: ItemFormData[] }) =>
      apiRequest("/api/estimates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/estimates"] });
      onClose();
    },
  });

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);

    const taxAmount = items.reduce((sum, item) => {
      if (!item.taxable) return sum;
      const quantity = parseFloat(item.quantity) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (quantity * unitPrice * 0.13); // 13% tax
    }, 0);

    return { subtotal, taxAmount, total: subtotal + taxAmount };
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: "1", unitPrice: "0", taxable: true }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof ItemFormData, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Calculate total price for this item
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = parseFloat(field === 'quantity' ? value as string : newItems[index].quantity) || 0;
      const unitPrice = parseFloat(field === 'unitPrice' ? value as string : newItems[index].unitPrice) || 0;
      newItems[index].totalPrice = (quantity * unitPrice).toFixed(2);
    }
    
    setItems(newItems);
  };

  const onSubmit = (data: EstimateFormData) => {
    const { subtotal, taxAmount, total } = calculateTotals();
    
    const estimateData = {
      ...data,
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: total.toFixed(2),
      currency: "CAD",
      status: "draft",
    };

    const processedItems = items.map(item => ({
      ...item,
      totalPrice: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2),
    }));

    createEstimateMutation.mutate({
      estimate: estimateData,
      items: processedItems,
    });
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    if (isLoading) {
      return <div className="animate-pulse">Loading...</div>;
    }

    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <ErrorBoundary>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {estimate ? "Edit Estimate" : "Create New Estimate"}
          </h2>
          <Button aria-label="Small action button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="clientId">Client</Label>
              <Select onValueChange={(value) => form.setValue("clientId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.businessName}
      </ErrorBoundary>
    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                type="date"
                {...form.register("issueDate")}
              />
            </div>

            <div>
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                type="date"
                {...form.register("expiryDate")}
              />
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-medium">Estimate Items</Label>
              <Button aria-label="Small action button" type="button" onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-sm">Description</Label>
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="Item description"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Total</Label>
                    <Input
                      value={`$${(parseFloat(item.quantity) * parseFloat(item.unitPrice) || 0).toFixed(2)}`}
                      disabled
                    />
                  </div>
                  <div className="col-span-1">
                    <Button aria-label="Small action button"
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (13%):</span>
                  <span>${taxAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>${total.toFixed(2)} CAD</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              {...form.register("notes")}
              placeholder="Additional notes or terms"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button aria-label="Button action" type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button aria-label="Button action" 
              type="submit" 
              disabled={createEstimateMutation.isPending}
              className="bg-primary hover:bg-primary-dark"
            >
              {createEstimateMutation.isPending ? "Creating..." : "Create Estimate"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}