import { motion } from "framer-motion";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InvoicePreviewButtonProps {
  o> void;
  disabled?: boolean;
}

export default function InvoicePreviewButton({ o
  return (
    <motion.div
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <Button aria-label="Button action" 
        type="button" 
        variant="outline" 
        o
        disabled={disabled}
        className={`relative overflow-hidden ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-blue-50 hover:border-blue-300 group'
        }`}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-10"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6 }}
        />
        <Eye className="h-4 w-4 mr-2" />
        <span>Preview</span>
      </Button>
    </motion.div>
  );
}