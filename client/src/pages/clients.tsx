import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Mail, Phone, MapPin, Building, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ClientModal from "@/components/clients/client-modal";

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
  createdAt: string;
}

export default function Clients() {
  const [showClientModal, setShowClientModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const queryClient = useQueryClient();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const deleteClientMutation = useMutation({
    mutationFn: (clientId: string) => 
      apiRequest(`/api/clients/${clientId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
  });

  const handleEditClient = (client: Client) => {
    setSelectedClient(client);
    setShowClientModal(true);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
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
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600">Manage your client relationships and contact information</p>
          </div>
          <Button 
            onClick={() => setShowClientModal(true)}
            className="btn-modern bg-primary hover:bg-primary-dark text-white shadow-md"
            style={{ visibility: 'visible', display: 'flex', alignItems: 'center' }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>

        {/* Client Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{clients?.filter(c => c.isActive).length || 0}</p>
                  <p className="text-sm text-gray-600">Active Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Building className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{clients?.length || 0}</p>
                  <p className="text-sm text-gray-600">Total Clients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">
                    {clients ? Math.round(clients.reduce((sum, client) => sum + client.paymentTerms, 0) / clients.length) : 30}
                  </p>
                  <p className="text-sm text-gray-600">Avg Payment Terms (days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients Grid */}
        {clients && clients.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <Card key={client.id} className="hover:shadow-lg transition-shadow overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg leading-tight break-words min-w-0">{client.businessName}</CardTitle>
                    <Badge variant={client.isActive ? "default" : "secondary"} className="flex-shrink-0">
                      {client.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  {client.contactName && (
                    <p className="text-sm text-gray-600 truncate">{client.contactName}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 min-w-0">
                      <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-600 truncate">{client.email}</span>
                    </div>
                    
                    {client.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{client.phone}</span>
                      </div>
                    )}
                    
                    {(client.city || client.province) && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {[client.city, client.province].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Payment Terms:</span>
                        <span className="font-medium">{client.paymentTerms} days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Currency:</span>
                        <span className="font-medium">{client.currency}</span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 pt-3">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleEditClient(client)}
                        className="flex-1"
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => deleteClientMutation.mutate(client.id)}
                        disabled={deleteClientMutation.isPending}
                        className="flex-1 text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clients yet</h3>
              <p className="text-gray-600 mb-4">
                Add your first client to start creating invoices and managing relationships
              </p>
              <Button onClick={() => setShowClientModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Client
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {showClientModal && (
        <ClientModal
          client={selectedClient}
          onClose={() => {
            setShowClientModal(false);
            setSelectedClient(null);
          }}
        />
      )}
    </>
  );
}