import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";

interface Client {
  id: string;
  businessName: string;
  contactName?: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country: string;
  currency: string;
  paymentTerms: number;
  isActive: boolean;
}

const clientSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  contactName: z.string().optional(),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  currency: z.string().min(1, "Currency is required"),
  paymentTerms: z.number().min(1, "Payment terms must be at least 1 day"),
  isActive: z.boolean(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientModalProps {
  client?: Client | null;
  onClose: () => void;
}

const canadianProvinces = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon"
];

export default function ClientModal({ client, onClose }: ClientModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      businessName: client?.businessName || "",
      contactName: client?.contactName || "",
      email: client?.email || "",
      phone: client?.phone || "",
      address: client?.address || "",
      city: client?.city || "",
      province: client?.province || "",
      postalCode: client?.postalCode || "",
      country: client?.country || "Canada",
      currency: client?.currency || "CAD",
      paymentTerms: client?.paymentTerms || 30,
      isActive: client?.isActive ?? true,
    },
  });

  const createClientMutation = useMutation({
    mutationFn: (data: ClientFormData) =>
      apiRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onClose();
    },
  });

  const updateClientMutation = useMutation({
    mutationFn: (data: ClientFormData) =>
      apiRequest(`/api/clients/${client?.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      onClose();
    },
  });

  const onSubmit = (data: ClientFormData) => {
    if (client) {
      updateClientMutation.mutate(data);
    } else {
      createClientMutation.mutate(data);
    }
  };

  const isPending = createClientMutation.isPending || updateClientMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">
            {client ? "Edit Client" : "Add New Client"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="businessName">Business Name *</Label>
              <Input
                {...form.register("businessName")}
                placeholder="Enter business name"
              />
              {form.formState.errors.businessName && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.businessName.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                {...form.register("contactName")}
                placeholder="Enter contact person"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address *</Label>
              <Input
                type="email"
                {...form.register("email")}
                placeholder="Enter email address"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                {...form.register("phone")}
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                {...form.register("address")}
                placeholder="Enter street address"
              />
            </div>

            <div>
              <Label htmlFor="city">City</Label>
              <Input
                {...form.register("city")}
                placeholder="Enter city"
              />
            </div>

            <div>
              <Label htmlFor="province">Province</Label>
              <Select onValueChange={(value) => form.setValue("province", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {canadianProvinces.map((province) => (
                    <SelectItem key={province} value={province}>
                      {province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="postalCode">Postal Code</Label>
              <Input
                {...form.register("postalCode")}
                placeholder="Enter postal code"
              />
            </div>

            <div>
              <Label htmlFor="country">Country</Label>
              <Select onValueChange={(value) => form.setValue("country", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="United States">United States</SelectItem>
                  <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select onValueChange={(value) => form.setValue("currency", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paymentTerms">Payment Terms (days)</Label>
              <Input
                type="number"
                {...form.register("paymentTerms", { valueAsNumber: true })}
                placeholder="30"
              />
              {form.formState.errors.paymentTerms && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.paymentTerms.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                {...form.register("isActive")}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Active Client</Label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending}
              className="bg-primary hover:bg-primary-dark"
            >
              {isPending ? "Saving..." : client ? "Update Client" : "Add Client"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}