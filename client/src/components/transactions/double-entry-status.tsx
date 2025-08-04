import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, 
  Circle, 
  AlertCircle,
  BookOpen 
} from "lucide-react";

interface DoubleEntryStatusProps {
  transaction: {
    id: string;
    isPosted?: boolean;
    journalEntryId?: string;
    isTransfer: boolean;
    category?: string;
    aiCategory?: string;
  };
  onPost?: (transactionId: string) => void;
  isPosting?: boolean;
}

export function DoubleEntryStatus({ transaction, onPost, isPosting }: DoubleEntryStatusProps) {
  if (transaction.isTransfer) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Circle className="w-3 h-3 mr-1" />
        Transfer
      </Badge>
    );
  }

  if (transaction.isPosted && transaction.journalEntryId) {
    return (
      <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
        <CheckCircle className="w-3 h-3 mr-1" />
        Posted
      </Badge>
    );
  }

  if (!transaction.category && !transaction.aiCategory) {
    return (
      <Badge variant="outline" className="text-orange-600 border-orange-200 text-xs">
        <AlertCircle className="w-3 h-3 mr-1" />
        Needs Category
      </Badge>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="outline" className="text-blue-600 border-blue-200 text-xs">
        <Circle className="w-3 h-3 mr-1" />
        Ready to Post
      </Badge>
      {onPost && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPost(transaction.id)}
          disabled={isPosting}
          className="h-6 px-2 text-xs"
        >
          <BookOpen className="w-3 h-3 mr-1" />
          {isPosting ? 'Posting...' : 'Post'}
        </Button>
      )}
    </div>
  );
}