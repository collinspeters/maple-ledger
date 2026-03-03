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

    // Accept any image file type; tolerate missing/incorrect MIME by falling back to extension.
    const ext = path.extname(filePath).toLowerCase();
    const imageMimeByExt: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".tif": "image/tiff",
      ".tiff": "image/tiff",
      ".heic": "image/heic",
      ".heif": "image/heif",
    };
    const normalizedMime = (mimeType || "").toLowerCase();
    const effectiveMime = normalizedMime.startsWith("image/")
      ? normalizedMime
      : (imageMimeByExt[ext] || "");
    if (!effectiveMime) {
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
                url: `data:${effectiveMime};base64,${base64Image}`
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
      
      // Amount matching — weight 55 pts (spec: 0.55)
      let amountScore = 0;
      if (receipt.extractedAmount && transaction.amount) {
        const receiptAmount = parseFloat(receipt.extractedAmount);
        const transactionAmount = Math.abs(parseFloat(transaction.amount));
        const amountDiff = Math.abs(receiptAmount - transactionAmount);
        const pctDiff = receiptAmount > 0 ? amountDiff / receiptAmount : 1;

        if (amountDiff <= 0.01) {
          amountScore = 55;
          factors.push('Exact amount match');
        } else if (pctDiff <= 0.01) {
          amountScore = Math.round(55 * 0.95);
          factors.push('Amount within 1%');
        } else if (amountDiff <= 1.00) {
          amountScore = Math.round(55 * 0.75);
          factors.push('Amount within $1');
        } else if (amountDiff <= 5.00) {
          amountScore = Math.round(55 * 0.40);
          factors.push('Similar amount');
        }
      }

      // Date matching — weight 25 pts (spec: 0.25)
      let dateScore = 0;
      if (receipt.extractedDate && transaction.date) {
        const receiptDate = new Date(receipt.extractedDate);
        const transactionDate = new Date(transaction.date);
        const daysDiff = Math.abs((receiptDate.getTime() - transactionDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff < 1) {
          dateScore = 25;
          factors.push('Same day');
        } else if (daysDiff <= 1) {
          dateScore = Math.round(25 * 0.8);
          factors.push('Within 1 day');
        } else if (daysDiff <= 3) {
          dateScore = Math.round(25 * 0.5);
          factors.push('Within 3 days');
        } else if (daysDiff <= 7) {
          dateScore = Math.round(25 * 0.2);
          factors.push('Within 7 days');
        }
      }

      // Vendor matching — weight 20 pts (spec: 0.20)
      let vendorScore = 0;
      if (receipt.extractedVendor && (transaction.vendor || transaction.description)) {
        const receiptVendor = receipt.extractedVendor.toLowerCase().trim();
        const transactionVendor = (transaction.vendor || transaction.description).toLowerCase().trim();

        if (receiptVendor === transactionVendor) {
          vendorScore = 20;
          factors.push('Exact vendor match');
        } else if (receiptVendor.includes(transactionVendor) || transactionVendor.includes(receiptVendor)) {
          vendorScore = Math.round(20 * 0.9);
          factors.push('Vendor substring match');
        } else {
          const receiptWords = receiptVendor.split(/\s+/);
          const transactionWords = transactionVendor.split(/\s+/);
          const commonWords = receiptWords.filter(w =>
            w.length > 2 && transactionWords.some(t => t.includes(w) || w.includes(t))
          );
          if (commonWords.length > 0) {
            vendorScore = Math.round(20 * 0.5);
            factors.push('Partial vendor match');
          }
        }
      }

      score = amountScore + dateScore + vendorScore;

      // Include candidates with at least 30% overall confidence
      if (score >= 30) {
        matches.push({
          ...transaction,
          matchScore: Math.min(score, 100),
          scoreAmount: amountScore,
          scoreDate: dateScore,
          scoreVendor: vendorScore,
          matchFactors: factors,
        });
      }
    }

    // Sort by score, return top 5
    const ranked = matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);

    // Auto-link: score >= 90 AND gap between top two >= 10
    const [top1, top2] = ranked;
    if (top1 && top1.matchScore >= 90 && (!top2 || top1.matchScore - top2.matchScore >= 10)) {
      (top1 as any).__autoLink = true;
    }

    return ranked;
      
  } catch (error) {
    console.error('Error finding transaction matches:', error);
    return [];
  }
}
