import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface OCRResult {
  vendor?: string;
  amount?: string;
  date?: string;
  tax?: string;
  currency?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: string;
    total?: string;
  }>;
  confidence: number;
  rawText?: string;
}

export async function processReceiptOCR(receiptId: string, filePath: string, mimeType: string): Promise<OCRResult> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Receipt file not found");
    }

    // For PDF files, we would need a PDF to image conversion step here
    // For now, we'll handle images only
    if (!mimeType.startsWith('image/')) {
      throw new Error("OCR currently supports image files only");
    }

    console.log(`Processing OCR for receipt ${receiptId}`);

    // Read image file and convert to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    // Use OpenAI Vision API to extract receipt data
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `You are an expert receipt OCR system. Extract structured data from receipt images for Canadian businesses. 

Focus on extracting:
1. Vendor/Merchant name
2. Total amount (before and after tax)
3. Date of transaction
4. Tax amounts (GST, HST, PST if present)
5. Currency (usually CAD for Canadian receipts)
6. Line items if clearly visible

Return data in JSON format with this structure:
{
  "vendor": "Business Name",
  "amount": "25.99",
  "date": "2024-01-15",
  "tax": "3.38",
  "currency": "CAD",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": "22.61",
      "total": "22.61"
    }
  ],
  "confidence": 0.95,
  "rawText": "Raw extracted text if needed"
}

If information is unclear or missing, omit those fields. Be conservative with confidence scores.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract the receipt data from this image:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const ocrData = JSON.parse(response.choices[0].message.content || '{}');
    
    console.log(`OCR completed for receipt ${receiptId}:`, {
      vendor: ocrData.vendor,
      amount: ocrData.amount,
      confidence: ocrData.confidence
    });

    return {
      vendor: ocrData.vendor || undefined,
      amount: ocrData.amount || undefined,
      date: ocrData.date || undefined,
      tax: ocrData.tax || undefined,
      currency: ocrData.currency || "CAD",
      lineItems: ocrData.lineItems || undefined,
      confidence: ocrData.confidence || 0.5,
      rawText: ocrData.rawText || undefined
    };

  } catch (error) {
    console.error(`OCR processing failed for receipt ${receiptId}:`, error);
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function findTransactionMatches(receipt: any, userId: string): Promise<any[]> {
  try {
    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');
    
    if (!receipt.extractedAmount && !receipt.extractedVendor && !receipt.extractedDate) {
      return [];
    }

    // Get recent transactions (last 30 days from receipt date or creation)
    const searchDate = receipt.extractedDate ? new Date(receipt.extractedDate) : new Date(receipt.createdAt);
    const startDate = new Date(searchDate);
    startDate.setDate(startDate.getDate() - 30);
    const endDate = new Date(searchDate);
    endDate.setDate(endDate.getDate() + 3);

    const transactions = await storage.getTransactionsByDateRange(userId, startDate, endDate);
    
    const matches = [];
    
    for (const transaction of transactions) {
      let score = 0;
      const factors = [];
      
      // Skip if transaction already has a receipt
      if (transaction.receiptAttached) {
        continue;
      }
      
      // Amount matching (40 points)
      if (receipt.extractedAmount && transaction.amount) {
        const receiptAmount = parseFloat(receipt.extractedAmount);
        const transactionAmount = Math.abs(parseFloat(transaction.amount));
        const amountDiff = Math.abs(receiptAmount - transactionAmount);
        
        if (amountDiff <= 1.00) {
          score += 40;
          factors.push('Exact amount match');
        } else if (amountDiff <= 5.00) {
          score += 20;
          factors.push('Similar amount');
        }
      }
      
      // Vendor matching (35 points)
      if (receipt.extractedVendor && (transaction.vendor || transaction.description)) {
        const receiptVendor = receipt.extractedVendor.toLowerCase().trim();
        const transactionVendor = (transaction.vendor || transaction.description).toLowerCase().trim();
        
        // Check for substring matches
        if (receiptVendor.includes(transactionVendor) || transactionVendor.includes(receiptVendor)) {
          score += 35;
          factors.push('Vendor match');
        } else {
          // Check for word overlap
          const receiptWords = receiptVendor.split(/\s+/);
          const transactionWords = transactionVendor.split(/\s+/);
          const commonWords = receiptWords.filter(word => 
            word.length > 2 && transactionWords.some(tWord => tWord.includes(word) || word.includes(tWord))
          );
          
          if (commonWords.length > 0) {
            score += 15;
            factors.push('Partial vendor match');
          }
        }
      }
      
      // Date matching (25 points)
      if (receipt.extractedDate && transaction.date) {
        const receiptDate = new Date(receipt.extractedDate);
        const transactionDate = new Date(transaction.date);
        const daysDiff = Math.abs((receiptDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 1) {
          score += 25;
          factors.push('Same date');
        } else if (daysDiff <= 3) {
          score += 15;
          factors.push('Within 3 days');
        }
      }
      
      // Only include matches with reasonable confidence
      if (score >= 30) {
        matches.push({
          ...transaction,
          matchScore: Math.min(score, 100),
          matchFactors: factors
        });
      }
    }
    
    // Sort by match score (highest first) and return top 5
    return matches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
      
  } catch (error) {
    console.error('Error finding transaction matches:', error);
    return [];
  }
}