import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Receipt } from "@shared/schema";

export default function Receipts() {
  const { data: receipts, isLoading } = useQuery<Receipt[]>({
    queryKey: ["/api/receipts"],
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Receipts</h1>

      <Card className="shadow-card">
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Uploaded Receipts</h2>
        </CardHeader>
        <CardContent>
          {receipts && receipts.length > 0 ? (
            <div className="space-y-4">
              {receipts.map((receipt) => (
                <div key={receipt.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">{receipt.fileName}</p>
                    <p className="text-sm text-gray-600">
                      {receipt.extractedVendor && `${receipt.extractedVendor} • `}
                      {receipt.createdAt && new Date(receipt.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    {receipt.extractedAmount && (
                      <p className="font-semibold">${parseFloat(receipt.extractedAmount).toLocaleString()}</p>
                    )}
                    <p className={`text-xs px-2 py-1 rounded ${
                      receipt.status === "processed" ? "bg-secondary/10 text-secondary" :
                      receipt.status === "processing" ? "bg-accent/10 text-accent" :
                      receipt.status === "matched" ? "bg-primary/10 text-primary" :
                      "bg-gray-200 text-gray-600"
                    }`}>
                      {receipt.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No receipts uploaded yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
